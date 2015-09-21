import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import sh from 'shelljs';
import assert from 'assert';

import {
    execAndLog, timeStrFromPath, parseTimeStr, niceDate,
    findGaps, makeSessions, sessionsFromFiles,
    makeVideoCmd, makeButterflowCmd
} from './utils.js';

import {
    imgPath, outPath, cropCoords, imgInterval, maxFrameGap,
    origFPS, speed, finalFPS, maxSessions
} from './config.js';


// get all full-res image paths
const files = sh.ls(`${imgPath}/*.jpg`);
// make dates from the image file names
//const fileMoments = files.map(_.flow(timeStrFromPath, parseTimeStr));
// look for gaps in the dates > the expected interval
//const gaps = findGaps(fileMoments, imgInterval);
// split files into sessions wherever gaps are > maxFrameGap
// mostly happens at night between local days (data source is missing ~8 hrs of data / day)
//const sessions = makeSessions(files, gaps, maxFrameGap);
const sessions = sessionsFromFiles(files, imgInterval, maxFrameGap);
assert(files.length, _.reduce(sessions, (total, session) => total + session.files.length, 0));

const sessionsToRun = _.takeRight(sessions, maxSessions).reverse();

// crop the images
sessionsToRun.forEach((session, i) => {
    const dirName = `${timeStrFromPath(_.first(session.files))}-${timeStrFromPath(_.last(session.files))}`;
    const dirPath = `${outPath}/${dirName}`;
    sh.mkdir(dirPath);

    cropCoords.forEach((cropCoord, j) => {
        const cropDir = `${dirPath}/${cropCoord}`;
        sh.mkdir(cropDir);

        // make cropped images
        const imgDir = `${cropDir}/img`;
        sh.mkdir(imgDir);
        session.files.forEach((file, k) => {
            const croppedPath = `${imgDir}/${timeStrFromPath(file)}.jpg`;
            if(sh.ls(croppedPath).length) return; // don't redo crops
            console.log(`cropping session ${i+1} of ${sessionsToRun.length}, crop ${j+1} of ${cropCoords.length}, ` +
                `file ${k+1} of ${session.files.length}, ${croppedPath}`);
            execAndLog(`convert '${file}' -crop ${cropCoord} '${croppedPath}'`);
        });

        // make video
        const videoDir = `${cropDir}/video`;
        const origVideoPath = `${videoDir}/original-${origFPS}fps-lossless.mp4`;
        sh.mkdir(videoDir);
        if(!sh.ls(origVideoPath).length) {
            execAndLog(makeVideoCmd(imgDir, origFPS, origVideoPath), true, 'original video');
        }

        const interpVideoPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x-lossless.mp4`;
        if(!sh.ls(interpVideoPath).length) {
            const butterflowCmd = makeButterflowCmd(origVideoPath, interpVideoPath, session.files, speed, origFPS, finalFPS);
            execAndLog(butterflowCmd, true, 'butterflow');
        }

        const interpCompressedPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x.mp4`;
        if(!sh.ls(interpCompressedPath).length) {
            const compressCmd = `ffmpeg -i ${interpVideoPath} ${interpCompressedPath}`;
            console.log('compressing lossless file...');
            execAndLog(compressCmd, true, 'compression');
        }
    });
});

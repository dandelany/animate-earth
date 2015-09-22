import fs from 'fs';
import _ from 'lodash';
import moment from 'moment';
import sh from 'shelljs';
import assert from 'assert';

import {
    ensureDir, dirExists, fileExists,
    execAndLog, timeStrFromPath, parseTimeStr, niceDate,
    findGaps, makeSessions, sessionsFromFiles,
    makeVideoCmd, makeButterflowCmd, makeCompressVideoCmd
} from './utils.js';

import {
    imgPath, outPath, cropCoords, imgInterval, maxFrameGap,
    origFPS, speed, finalFPS, maxSessions
} from './config.js';


// get all full-res image paths
const files = sh.ls(`${imgPath}/*.jpg`);
// look for gaps in the dates > the expected interval
// split files into sessions wherever gaps are > maxFrameGap
// mostly happens at night between local days (data source is missing ~8 hrs of data / day)
const sessions = sessionsFromFiles(files, imgInterval, maxFrameGap);
assert(files.length, _.reduce(sessions, (total, session) => total + session.files.length, 0));

const sessionsToRun = _.take(sessions.reverse(), maxSessions);

sessionsToRun.forEach((session, i) => {
    const dirName = `${timeStrFromPath(_.first(session.files))}-${timeStrFromPath(_.last(session.files))}`;
    const sessionDir = `${outPath}/${dirName}`;
    ensureDir(sessionDir);

    cropCoords.forEach((cropCoord, j) => {
        const cropDir = `${sessionDir}/${cropCoord}`;
        const imgDir = `${cropDir}/img`;
        const videoDir = `${cropDir}/video`;
        const origVideoPath = `${videoDir}/original-${origFPS}fps-lossless.mp4`;
        const origCompressedPath = `${videoDir}/original-${origFPS}fps.mp4`;
        const interpVideoPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x-lossless.mp4`;
        const interpCompressedPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x.mp4`;

        ensureDir(cropDir);
        if(fileExists(interpCompressedPath)) return; // already made this one

        // make cropped images
        ensureDir(imgDir);
        session.files.forEach((file, k) => {
            const croppedPath = `${imgDir}/${timeStrFromPath(file)}.jpg`;
            if(fileExists(croppedPath)) return; // don't redo crops
            console.log(`cropping session ${i+1} of ${sessionsToRun.length}, crop ${j+1} of ${cropCoords.length}, ` +
                `file ${k+1} of ${session.files.length}, ${croppedPath}`);
            execAndLog(`convert '${file}' -crop ${cropCoord} '${croppedPath}'`);
        });

        // make original lossless video from frames
        ensureDir(videoDir);
        if(fileExists(origVideoPath)) sh.rm(origVideoPath);
        execAndLog(makeVideoCmd(imgDir, origFPS, origVideoPath), true, 'original video');

        // use butterflow to interpolate original video to smooth lossless video
        if(fileExists(interpVideoPath)) sh.rm(interpVideoPath);
        execAndLog(
            makeButterflowCmd(origVideoPath, interpVideoPath, session.files, speed, origFPS, finalFPS),
        true, 'butterflow');

        // compress/encode the interpolated video
        execAndLog(makeCompressVideoCmd(interpVideoPath, interpCompressedPath), true, 'compression');
        // compress/encode the original video
        if(fileExists(origCompressedPath)) sh.rm(origCompressedPath);
        execAndLog(makeCompressVideoCmd(origVideoPath, origCompressedPath), true, 'compression');

        // delete the original images and lossless video files since we're done with them
        // only save compressed videos because images & lossless files are too big
        console.log('removing images & lossless files...')
        sh.rm('-rf', imgDir);
        sh.rm(origVideoPath);
        sh.rm(interpVideoPath);
    });
});

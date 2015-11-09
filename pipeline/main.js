import _ from 'lodash';
import moment from 'moment';
import sh from 'shelljs';
import assert from 'assert';
require('moment-range');

import {
    ensureDir, dirExists, fileExists,
    execAndLog, timeStrFromPath, parseTimeStr, niceDate,
    findGaps, makeSessions, sessionsFromFiles,
    fdupes,
    makeVideoCmd, makeButterflowCmd, makeCompressVideoCmd
} from './utils.js';

//import {
//    imgPath, outPath, cropCoords, products, imgInterval, maxFrameGap,
//    origFPS, speed, finalFPS, maxSessions
//} from './config.js';

import config from './config.js';
const {
    imgPath, outPath, tmpPath,
    cropCoords, products, imgInterval, maxFrameGap,
    origFPS, speed, finalFPS, maxSessions,
} = config;

// get all full-res image paths
const files = sh.ls(`${imgPath}/*.jpg`);
// look for gaps in the dates > the expected interval
// split files into sessions wherever gaps are > maxFrameGap
// mostly happens at night between local days (data source is missing ~8 hrs of data / day)

//const sessions = sessionsFromFiles(files, imgInterval, maxFrameGap);
const sessions = sessionsFromFiles(files, imgInterval, maxFrameGap);

//const sessions2 = sessionsFromFiles2(files, imgInterval, maxFrameGap);
//
//function sessionsFromFiles2(files, startTime, endTime, startDate, endDate) {
//    const startMoment = moment(`${startDate}T${startTime}`);
//    console.log(startMoment);
//}

function makeProductSessions(product, files) {
    let {startDate, endDate, startTime, endTime} = product;
    startTime = product.startTime || '00:00:00Z';
    endTime = product.endTime || '00:00:00Z';
    startDate  = product.startDate || '2015-01-01';
    endDate  = product.endDate || '2115-01-01';
    const startMoment = moment.utc(`${startDate}T${startTime}`);
    const endsNextDay = moment.utc(`${startDate}T${endTime}`).isBefore(startMoment);
    const endMoment = moment.utc(`${endDate}T${endTime}`).add(endsNextDay ? 1 : 0, 'day');

    const filesInRange = files.filter(f => {
        const fileTime = parseTimeStr(timeStrFromPath(f));
        return ((fileTime.isAfter(startMoment) || fileTime.isSame(startMoment)) &&
        (fileTime.isBefore(endMoment) || fileTime.isSame(endMoment)))
    });

    let sessions = [];
    let dayStart = startMoment;
    let isDone = false;
    while(!isDone) {
        let dayEnd = moment.utc(`${dayStart.format('YYYY-MM-DD')}T${endTime}`)
            .add(endsNextDay ? 1 : 0, 'day');
        let dayRange = moment.range(dayStart, dayEnd);
        let dayFiles = filesInRange.filter(f => {
            const fileTime = parseTimeStr(timeStrFromPath(f));
            return dayRange.contains(fileTime);
        });
        sessions.push(dayFiles);
        dayStart = dayStart.add(1, 'day');
        if(dayStart.isAfter(endMoment)) isDone = true;
    }
    return sessions;
}

function runSession(product, i, session, j) {
    const dirName = `${timeStrFromPath(_.first(session))}-${timeStrFromPath(_.last(session))}`;
    const tmpDir = `${tmpPath}/${product.id}/${dirName}`;
    const sessionDir = `${outPath}/${product.id}/${dirName}`;
    const cropCoord = product.crop;
    //const cropDir = `${sessionDir}/${cropCoord}`;
    const imgDir = `${tmpDir}/img`;
    const videoDir = `${sessionDir}/video`;
    const origVideoPath = `${tmpDir}/original-${origFPS}fps-lossless.mp4`;
    const origCompressedPath = `${videoDir}/original-${origFPS}fps.mp4`;
    // const interpVideoPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x-lossless.mp4`;
    const interpCompressedPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x.mp4`;

    console.log(sessionDir);
    ensureDir(tmpDir);
    ensureDir(sessionDir);

    if(fileExists(interpCompressedPath)) return; // already made this one

    // make cropped images
    ensureDir(imgDir);
    session.forEach((file, k) => {
        const croppedPath = `${imgDir}/${timeStrFromPath(file)}.jpg`;
        if(fileExists(croppedPath)) return; // don't redo crops
        console.log(`cropping product ${i+1} of ${products.length}, session ${j+1}, ` +
            `file ${k+1} of ${session.length}, ${croppedPath}`);
        execAndLog(`convert '${file}' -crop ${cropCoord} '${croppedPath}'`);
    });

    // find duplicate image files and remove them (removes all pure black frames)
    //const dupeSets = execAndLog(fdupes(`${imgDir}`))
    //    .output.split('\n').filter(s => s.length)
    //    .map(s => s.split(' ').filter(d => d = d.length));
    //console.log(`${dupeSets.length} sets of duplicate images`);
    //dupeSets.forEach(dupes => {
    //    const fileSize = parseInt(sh.exec(`wc -c ${dupes[0]}`).output.split(' ')[0]);
    //    console.log('fileSize', fileSize);
    //    if(fileSize < 20000) { // detect pure black images and delete them all
    //        dupes.forEach(dupe => execAndLog(`rm ${dupe}`));
    //    } else {
    //        // if not all black, keep 1st dupe, ie. dont delete real data in weird cases where we have dupes
    //        dupes.splice(1).forEach(dupe => execAndLog(`rm ${dupe}`));
    //    }
    //});

    // make original lossless video from frames
    ensureDir(videoDir);
    if(fileExists(origVideoPath)) sh.rm(origVideoPath);
    execAndLog(makeVideoCmd(imgDir, origFPS, origVideoPath), true, 'original video');

    // use butterflow to interpolate original video to smooth lossless video
    // if(fileExists(interpVideoPath)) sh.rm(interpVideoPath);
    execAndLog(
        makeButterflowCmd(origVideoPath, interpCompressedPath, session, speed, origFPS, finalFPS),
        true, 'butterflow');

    // compress/encode the interpolated video
    // execAndLog(makeCompressVideoCmd(interpVideoPath, interpCompressedPath), true, 'compression');
    // compress/encode the original video
    if(fileExists(origCompressedPath)) sh.rm(origCompressedPath);
    execAndLog(makeCompressVideoCmd(origVideoPath, origCompressedPath), true, 'compression');

    // delete the original images and lossless video files since we're done with them
    // only save compressed videos because images & lossless files are too big
    console.log('removing temporary files...');
    sh.rm('-rf', tmpDir);
}

products.forEach((product, i) => {
    const sessions = makeProductSessions(product, files).reverse();
        //todo only do full days?
        //.filter(session => { // filter out sessions < 15 hours long
        //    const startDate = parseTimeStr(timeStrFromPath(_.first(session.files)));
        //    const endDate = parseTimeStr(timeStrFromPath(_.last(session.files)));
        //    const sessionHours = endDate.diff(startDate, 'hours');
        //    if(sessionHours < 15) console.log(startDate.format('YYYY-MM-DD'), 'session too short,', sessionHours, 'hours');
        //    return (sessionHours >= 15);
        //});

    sessions.forEach(runSession.bind(this, product, i));

    console.log(sessions);
});






//assert.equal(files.length, _.reduce(sessions, (total, session) => total + session.files.length, 0));
//
//
//const sessionsToRun = _(sessions)
//    .reverse()
//    .filter(session => { // filter out sessions < 15 hours long
//        const startDate = parseTimeStr(timeStrFromPath(_.first(session.files)));
//        const endDate = parseTimeStr(timeStrFromPath(_.last(session.files)));
//        const sessionHours = endDate.diff(startDate, 'hours');
//        if(sessionHours < 15) console.log(startDate.format('YYYY-MM-DD'), 'session too short,', sessionHours, 'hours');
//        return (sessionHours >= 15);
//    })
//    .take(maxSessions)
//    .value();

//console.log(sessionsToRun);

//sessionsToRun.forEach((session, i) => {
[].forEach((session, i) => {
    return;
    const dirName = `${timeStrFromPath(_.first(session.files))}-${timeStrFromPath(_.last(session.files))}`;
    const sessionDir = `${outPath}/${dirName}`;
    ensureDir(sessionDir);

    products.forEach((product, j) => {
        const cropCoord = product.crop;
        const cropDir = `${sessionDir}/${cropCoord}`;
        const imgDir = `${cropDir}/img`;
        const videoDir = `${cropDir}/video`;
        const origVideoPath = `${videoDir}/original-${origFPS}fps-lossless.mp4`;
        const origCompressedPath = `${videoDir}/original-${origFPS}fps.mp4`;
        // const interpVideoPath = `${videoDir}/interpolated-${origFPS}-${finalFPS}fps-${speed}x-lossless.mp4`;
        const interpCompressedPath = `${videoDir}/interpolated-sm2-${origFPS}-${finalFPS}fps-${speed}x.mp4`;

        ensureDir(cropDir);
        if(fileExists(interpCompressedPath)) return; // already made this one

        // make cropped images
        ensureDir(imgDir);
        session.files.forEach((file, k) => {
            const croppedPath = `${imgDir}/${timeStrFromPath(file)}.jpg`;
            if(fileExists(croppedPath)) return; // don't redo crops
            console.log(`cropping session ${i+1} of ${sessionsToRun.length}, crop ${j+1} of ${products.length}, ` +
                `file ${k+1} of ${session.files.length}, ${croppedPath}`);
            execAndLog(`convert '${file}' -crop ${cropCoord} '${croppedPath}'`);
        });

        // find duplicate image files and remove them (removes all pure black frames)
        const dupeSets = execAndLog(fdupes(`${imgDir}`))
            .output.split('\n').filter(s => s.length)
            .map(s => s.split(' ').filter(d => d = d.length));
        console.log(`${dupeSets.length} sets of duplicate images`);
        dupeSets.forEach(dupes => {
            const fileSize = parseInt(sh.exec(`wc -c ${dupes[0]}`).output.split(' ')[0]);
            console.log('fileSize', fileSize);
            if(fileSize < 20000) { // detect pure black images and delete them all
                dupes.forEach(dupe => execAndLog(`rm ${dupe}`));
            } else { 
                // if not all black, keep 1st dupe, ie. dont delete real data in weird cases where we have dupes
                dupes.splice(1).forEach(dupe => execAndLog(`rm ${dupe}`));
            }
        });

        // make original lossless video from frames
        ensureDir(videoDir);
        if(fileExists(origVideoPath)) sh.rm(origVideoPath);
        execAndLog(makeVideoCmd(imgDir, origFPS, origVideoPath), true, 'original video');

        // use butterflow to interpolate original video to smooth lossless video
        // if(fileExists(interpVideoPath)) sh.rm(interpVideoPath);
        execAndLog(
            makeButterflowCmd(origVideoPath, interpCompressedPath, session.files, speed, origFPS, finalFPS),
        true, 'butterflow');

        // compress/encode the interpolated video
        // execAndLog(makeCompressVideoCmd(interpVideoPath, interpCompressedPath), true, 'compression');
        // compress/encode the original video
        if(fileExists(origCompressedPath)) sh.rm(origCompressedPath);
        execAndLog(makeCompressVideoCmd(origVideoPath, origCompressedPath), true, 'compression');

        // delete the original images and lossless video files since we're done with them
        // only save compressed videos because images & lossless files are too big
        console.log('removing images & lossless files...');
        sh.rm('-rf', imgDir);
        sh.rm(origVideoPath);
        // sh.rm(interpVideoPath);
    });
});

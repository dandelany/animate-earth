import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import glob from 'glob';
import moment from 'moment';

// path containing full-sized jpgs
const imgPath = '/Volumes/Galactica/earth/img/full-disk-true-color/high';

// output path for finished video
const outPath = '/Volumes/Galactica/earth/output/';

// expected time between images, in seconds. 10 minutes for himawari-8
const imgInterval = 60 * 10;

// max # of missing frames to try to adjust for via extra interpolation
// gaps > than this number of frames will ne split into separate sessions
const maxFrameGap = 5;

// the speed of the finished video in terms of real world seconds per video second
// ie. (seconds of real time elapsed in images) / (seconds in final video)
const speed = imgInterval / 1; // 1 second of video per 10 minute image (1fps uninterpolated)

// fps of the intermediate uninterpolated video
// only really matters if you plan to use it as well (ie. for comparison)
const origFPS = 2;

// desired fps of final interpolated video
const finalFPS = 30;

//const speed = 60 * 10;
const normalSpd = 0.05;
const fps = 30;

// max # of sessions to make video from, starting from most recent
const maxSessions = 1;

getJpgsInPath(imgPath, function (err, files) {
    // make dates from the image file names
    const fileMoments = files.map(_.flow(timeStrFromFileName, parseTimeStr));
    // look for gaps in the dates > the expected interval
    const gaps = findGaps(fileMoments, imgInterval);
    // gaps > allowed max will be split into separate sessions
    // mostly happens at night between local days (data source is missing ~8 hrs of data / day)
    const sessionEndIndices = _(gaps)
        .filter(gap => gap.skipped > maxFrameGap).pluck('i').value()
        .concat([files.length - 1]);

    const sessions = _.map(sessionEndIndices, (endI, j) => {
        const startI = (j === 0) ? 0 : sessionEndIndices[j-1] + 1;
        return {
            startI, endI,
            startFile: files[startI],
            endFile: files[endI],
        }
    });
    console.log(sessions);



    //console.log(gaps);
    //console.log(sessionIndices);
    //console.log(sessionIndices.map(i => niceDate(fileMoments[i]) + ' - ' + niceDate(fileMoments[i+1])));

    return;

    let last = 0;
    console.log('butterflow -l -r 30 -o adj3.mp4 -s \\');
    for(let i=1; i < fileMoments.length; i++) {
        //console.log(fileMoments[i] - fileMoments[i-1]);
        const minuteDiff = fileMoments[i].diff(fileMoments[i-1], 'minutes');
        if(minuteDiff > 10) {

            //console.log(`skipped ${minuteDiff} minutes:\t ${fd(fileMoments[i-1])} to ${fd(fileMoments[i])}`);
            const skippedFrames = Math.round(minuteDiff / 10);
            const adjustedSpd = normalSpd * (1 / skippedFrames);

            console.log(`a=${(last)/fps},b=${(i)/fps},spd=${normalSpd}:` + '\\');
            console.log(`a=${(i)/fps},b=${(i+1)/fps},spd=${adjustedSpd}:` + '\\');
            last = i+1;
        }
    }
    if(last > 0 && last < fileMoments.length - 1)
        console.log(`a=${last/fps},b=end,spd=${normalSpd} ` + '\\');
    console.log('30fps-orig.mp4')
});

function getJpgsInPath(path, callback) {
    return glob(`${path}/*.jpg`, {}, callback);
}
function timeStrFromFileName(path) {
    return _.first(_.last(path.split('_')).split('.'));
}
function parseTimeStr(timeStr) {
    // closest time zone is Cairns, Australia - UTC+10
    return moment.utc(timeStr, 'YYYYMMDDHHmmSS').utcOffset(10);
}
function niceDate(d) { return d.format('MM/DD/YY HH:mm'); }

function findGaps(moments, expectedInterval) {
    let gaps = [];
    for(var i=1; i < moments.length; i++) {
        const dSeconds = moments[i].diff(moments[i-1], 'seconds');
        if(dSeconds > expectedInterval) {
            const skipped = Math.round(dSeconds / expectedInterval);
            gaps.push({i: i-1, skipped});
        }
    }
    return gaps;
}
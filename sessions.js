import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import glob from 'glob';
import moment from 'moment';

//const imgPath = './img/full-disk-true-color/high/';
//const imgPath = '/media/dan/Galactica/earth/img/full-disk-true-color/high/';
//const imgPath = '/Volumes/Galactica/earth/img/full-disk-true-color/high/';
const imgPath = '/Volumes/Galactica/earth/img/full-disk-true-color/skiptest/crop/';

glob(`${imgPath}/*.jpg`, {}, function (err, files) {
    const fileMoments = files.map(_.flow(timeStrFromPath, parseTimeStr));
    //fileMoments.forEach((m,i) => console.log(timeStrFromPath(files[i]), m.format()))
    for(var i=1; i < fileMoments.length; i++) {
        //console.log(fileMoments[i] - fileMoments[i-1]);
        const minuteDiff = fileMoments[i].diff(fileMoments[i-1], 'minutes');
        if(minuteDiff > 10) {
            const fd = d => d.format('MM/DD/YY HH:mm');
            console.log(`skipped ${minuteDiff} minutes:\t ${fd(fileMoments[i-1])} to ${fd(fileMoments[i])}`);
            const skippedFrames = Math.round(minuteDiff / 10);
            const adjustedSpd = 0.5 * (1/skippedFrames);
            console.log(`a=${(i-1)*0.2},b=${((i-1)*0.2) + 0.2},spd=${adjustedSpd}:`)
        }
    }
});

function parseTimeStr(timeStr) {
    return moment.utc(timeStr, 'YYYYMMDDHHmmSS')
}
function timeStrFromPath(path) {
    return _.first(_.last(path.split('_')).split('.'));
}
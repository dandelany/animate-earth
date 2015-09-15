import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import glob from 'glob';
import moment from 'moment';

//const imgPath = './img/full-disk-true-color/high/';
//const imgPath = '/media/dan/Galactica/earth/img/full-disk-true-color/high/';
//const imgPath = '/Volumes/Galactica/earth/img/full-disk-true-color/high/';
const imgPath = '/Volumes/Galactica/earth/img/full-disk-true-color/skiptest2/img/';

glob(`${imgPath}/*.jpg`, {}, function (err, files) {
    const fileMoments = files.map(_.flow(timeStrFromPath, parseTimeStr));
    //fileMoments.forEach((m,i) => console.log(timeStrFromPath(files[i]), m.format()))
    const normalSpd = 0.05;
    const fps = 30;
    let last = 0;
    console.log('butterflow -l -r 30 -o adj3.mp4 -s \\');
    for(var i=1; i < fileMoments.length; i++) {
        //console.log(fileMoments[i] - fileMoments[i-1]);
        const minuteDiff = fileMoments[i].diff(fileMoments[i-1], 'minutes');
        if(minuteDiff > 10) {
            const fd = d => d.format('MM/DD/YY HH:mm');
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

function parseTimeStr(timeStr) {
    return moment.utc(timeStr, 'YYYYMMDDHHmmSS')
}
function timeStrFromPath(path) {
    return _.first(_.last(path.split('_')).split('.'));
}
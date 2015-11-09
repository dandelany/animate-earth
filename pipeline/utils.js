import _ from 'lodash';
import moment from 'moment';
import sh from 'shelljs';
import os from 'os';

export function fileExists(path) { return sh.test('-f', path); }
export function dirExists(path) { return sh.test('-d', path); }
export function ensureDir(path) {
    if(!dirExists(path)) sh.mkdir('-p', path);
}

export function getOS() {
    return os.type();
}

export function absoluteURI(baseURI, relativeURI) { return `${baseURI}/${relativeURI}`; }
export function fileNameFromURI(url) { return _.last(url.split('/')); }

export function execAndLog(cmd, shouldTime=false, label='') {
    // log a shell command, then execute it.
    // optionally time it and log its runtime
    console.log(cmd);
    return shouldTime ?
        runAndLogTime(() => sh.exec(cmd), {label}) :
        sh.exec(cmd);
}

export function runAndLogTime(func, {args=[], ctx=null, units='minutes', label=''} = {}) {
    // run a function, time it, and log the time it took to run
    const start = new Date();
    const output = func.apply(ctx, args);
    const took = moment().diff(start, units, true);
    console.log(`${label ? label + ' ' : ''}took ${took} ${units}`);
    return output;
}

export function timeStrFromPath(path) {
    return _.first(_.last(path.split('_')).split('.'));
}

export function parseTimeStr(timeStr) {
    // closest time zone is Cairns, Australia - UTC+10
    return moment.utc(timeStr, 'YYYYMMDDHHmmSS').utcOffset(10);
}

export function niceDate(d) { return d.format('MM/DD/YY HH:mm'); }

export function findGaps(moments, expectedInterval) {
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

export function makeSessions(files, gaps, maxGap) {
    // whenever time gaps between files > allowed max, split into separate sessions
    const sessionEndIndices = _(gaps)
        .filter(gap => gap.skipped > maxGap).pluck('i').value()
        .concat([files.length - 1]);

    return sessionEndIndices.map((endI, j) => {
        const startI = (j === 0) ? 0 : sessionEndIndices[j-1] + 1;
        return {
            startI, endI,
            files: files.slice(startI, endI+1)
        }
    });
}

export function sessionsFromFiles(files, interval, maxGap) {
    const moments = files.map(_.flow(timeStrFromPath, parseTimeStr));
    // look for gaps in the dates > the expected interval
    const gaps = findGaps(moments, interval * maxGap);
    // split files into sessions wherever gaps are > maxFrameGap
    // mostly happens at night between local days (data source is missing ~8 hrs of data / day)
    const sessions = makeSessions(files, gaps, maxGap);
    return sessions;
}

export function wget(uri, savePath) {
    return `wget -O ${savePath} ${uri}`;
}

export function fdupes(dir) {
    dir = dir || './';
    return `fdupes -1 -q ${dir}`;
}

export function makeVideoCmd(imgDir, fps, videoPath) {
    return `ffmpeg -y -framerate ${fps}\ -pattern_type glob -i '${imgDir}/*.jpg'\
            -c:v libx264 -preset ultrafast -qp 0 -r ${fps} -pix_fmt yuv420p ${videoPath}`;
}

export function makeCompressVideoCmd(inPath, outPath, {preset='veryslow', crf='21', encoder='libx264'} = {}) {
    return `ffmpeg -y -i ${inPath} -c:v ${encoder} -crf ${crf} -preset ${preset} ${outPath}`;
}

export function makeButterflowCmd(inPath, outPath, files, speed, inFPS, outFPS){
    const fileMoments = files.map(_.flow(timeStrFromPath, parseTimeStr));
    let last = 0;
    let segments = [];
    for(var i=1; i < fileMoments.length; i++) {
        const minuteDiff = fileMoments[i].diff(fileMoments[i-1], 'minutes');
        if(minuteDiff > 10) {
            //const fd = d => d.format('MM/DD/YY HH:mm');
            //console.log(`skipped ${minuteDiff} minutes:\t ${fd(fileMoments[i-1])} to ${fd(fileMoments[i])}`);
            const skippedFrames = Math.round(minuteDiff / 10);
            const adjustedSpd = speed * (1 / skippedFrames);
            segments.push(`a=${(last)/inFPS},b=${(i)/inFPS},spd=${speed}:`);
            segments.push(`a=${(i)/inFPS},b=${(i+1)/inFPS},spd=${adjustedSpd}:`);
            last = i+1;
        }
    }
    if(last > 0 && last < fileMoments.length - 1)
        segments.push(`a=${last/inFPS},b=end,spd=${speed}`);
    if(!segments.length)
        segments.push(`full,spd=${speed}`);

    //return [`butterflow -l -r ${outFPS} -o ${outPath} -s `].concat(segments).concat(` ${inPath}`).join('');
    //return [`butterflow -l -v --no-preview -r ${outFPS} -o ${outPath} -s `].concat(segments).concat(` ${inPath}`).join('');
    return [`butterflow -v --poly-s 0.9 -r ${outFPS} -o ${outPath} -s `].concat(segments).concat(` ${inPath}`).join('');
}

import fs from 'fs';
import _ from 'lodash';
import sh from 'shelljs';

import {fileNameFromURI, fileExists, execAndLog} from './utils';
import config from './config';
const {imgPath} = config;

function isBadJpeg(jpeginfoOutput) {
    return _.contains(jpeginfoOutput, '[WARNING]') || _.contains(jpeginfoOutput, '[ERROR]');
}

function jpeginfo(file) {
    const {output} = execAndLog(`jpeginfo -c ${file}`);
    const isOK = !isBadJpeg(output);
    return {file, output, isOK};
}

const jpgsInPath = sh.ls(`${imgPath}/*.jpg`);

fs.readFile('./newlog.txt', (err, data) => {
    const logLines = (data+'').split('\n');
    // find lines in logs which are good (ie. jpgs that aren't corrupted)
    const goodLines = logLines.filter(line => !isBadJpeg(line));
    console.log(`${goodLines.length} good jpegs in log`);
    const goodFiles = goodLines.map(line => `${imgPath}/${fileNameFromURI(line.split(' ')[0])}`);

    // run jpeginfo on any files not in goodFiles
    const imgsToCheck = jpgsInPath.filter(img => !_.contains(goodFiles, img));
    console.log(`${imgsToCheck.length} new or bad images to check`);
    console.log(imgsToCheck);

    const imgInfo = imgsToCheck.map(jpeginfo);
    const newLogLines = _.pluck(imgInfo, 'output').map(line => line.replace(/\n/, ''));
    console.log(newLogLines);

    fs.writeFile('./newlog.txt', goodLines.concat(newLogLines).join('\n'));
});
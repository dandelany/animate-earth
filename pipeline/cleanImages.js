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
    const badLines = (data+'').split('\n').filter(isBadJpeg);
    console.log(badLines);
    const badFiles = badLines.map(line => `${imgPath}/${fileNameFromURI(line.split(' ')[0])}`);

    if(badFiles.length > 100) {
        console.log('more than 100 bad files! something is wrong. not deleting.');
        return;
    }
    badFiles.forEach(file => {
        if(fileExists(file)) {
            console.log(`deleting corrupted image file: ${file}`);
            sh.rm(file);
        }
    })
});
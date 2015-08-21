import _ from 'lodash';
import Jimp from 'jimp';
import glob from 'glob';

import sys from 'sys';
const exec = require('child_process').exec;


const imgPath = '/Volumes/Galactica/earth/img/full-disk-true-color/high/';
const outPath = '/Volumes/Galactica/earth/img/full-disk-true-color/cropped/';

glob(`${imgPath}/*.jpg`, {}, function (err, files) {
    const commands = files.map(function(path) {
        return `convert --verbose '${path}' -crop 1000x600+2000+200 '${outPath}${fileNameFromUrl(path)}'`;
    });
    console.log(commands);
    exec(commands.join('; '));
});

function fileNameFromUrl(url) { return _.last(url.split('/')); }

function puts(error, stdout, stderr) { sys.puts(stdout) }
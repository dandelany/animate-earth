import _ from 'lodash';
import sh from 'shelljs';
import moment from 'moment';
import request from 'request';
import cheerio from 'cheerio';
import sleep from 'sleep';
import JSFtp from 'jsftp';
import queue from 'queue';

import {
    //baseSrcURI, srcIndexPage,
    //scrapeSleep, scrapeLimit,
    //imgPath
} from './config.js';

import {
    fileExists, dirExists, ensureDir,
    fileNameFromURI, execAndLog,
    makeVideoCmd, makeCompressVideoCmd
} from './utils.js';

const ftpHost = 'public.sos.noaa.gov';
const srcDir = '/rt/grids/fimvis/4096';
const imgPath = '/media/dan/Galactica/earth/img/fimvis';
const scrapeLimit = 500;
const scrapeSleep = 0;

const ftp = new JSFtp({host: ftpHost});

const crops = ['2048x1024+0+0'];

function main(callback) {
    const q = queue({concurrency: 1});
    q.push(
        //cb => retrieveImages(cb),
        // cb => resizeImages(cb),
        cb => {
            makeVideos(`${imgPath}/50%`, `${imgPath}/50%/video`);
            cb();
        },
        // cb => cropImages(crops, cb),
        // cb => makeCroppedVideos(crops, cb),
        
        cb => { console.log('all done!'); cb(); }
    );
    q.start(callback);
}
main();

function retrieveImages(callback) {
    console.log(`checking for new image URLs on ${ftpHost}`);
    ftp.ls(srcDir, (err, response) => {
        const q = queue({concurrency: 1});
        // find URIs of images linked to from the index page
        const imgNames = _.pluck(response, 'name').filter(name => name.indexOf('.jpg') > -1);
        console.log(`${imgNames.length} images found`);
        console.log(`${imgNames.filter(imgFileExistsForURI).length} of ${imgNames.length} already downloaded`);
        console.log(`limited to last ${scrapeLimit} images`);

        const imgNamesToSave = _(imgNames).take(scrapeLimit) // limit to maximum #
            .reject(imgFileExistsForURI).value(); // don't save images that exist
        console.log(`${imgNamesToSave.length} new images to download`);
        if(!imgNamesToSave.length) { callback(); return; }
        console.log("estimated time with " + scrapeSleep + " second sleep:");
        console.log(moment().add((scrapeSleep+2) * imgNamesToSave.length, 'seconds').diff(moment(), 'minutes') + " minutes");

        const saveDir = `${imgPath}/100%`;
        ensureDir(saveDir)
        imgNamesToSave.forEach((imgName, i) => { // download the files
            q.push(next => {
                ftp.get(`${srcDir}/${imgName}`, `${saveDir}/${fileNameFromURI(imgName)}`, (err, response) => {
                    if(err) throw err;
                    console.log(`saved image ${i+1} of ${imgNamesToSave.length}: ${fileNameFromURI(imgName)}`);
                    // sleep before requesting next image
                    if(i+1 !== imgNamesToSave.length) execAndLog(`sleep ${scrapeSleep}`);
                    next();
                });
            });
        });

        q.start(callback);
    });
}

function resizeImages(callback) {
    // have to downscale the images so butterflow doesn't explode
    const scale = '50%';
    const fullDir = `${imgPath}/100%`;
    const scaledDir = `${imgPath}/${scale}`;
    const mogrifyCmd = `mogrify -path ${scaledDir} -resize ${scale} ${fullDir}/*.jpg`;
    ensureDir(scaledDir);
    const isJpg = name => name.indexOf('.jpg') > -1;
    const hasResized = (sh.ls(fullDir).filter(isJpg).length === sh.ls(scaledDir).filter(isJpg).length);
    if(!hasResized) execAndLog(mogrifyCmd, true, 'mogrify resize');
    else console.log(`already have images scaled at ${scale}`);
    callback();
}

function cropImages(crops, callback) {
    crops.forEach(cropCoords => {
        const fullDir = `${imgPath}/100%`;
        const cropDir = `${imgPath}/${cropCoords}`;
        const mogrifyCmd = `mogrify -path ${cropDir} -crop ${cropCoords} ${fullDir}/*.jpg`;
        const isJpg = name => name.indexOf('.jpg') > -1;
        ensureDir(cropDir);
        const hasCropped = (sh.ls(fullDir).filter(isJpg).length === sh.ls(cropDir).filter(isJpg).length);
        if(!hasCropped) execAndLog(mogrifyCmd, true, 'mogrify crop');
        else console.log(`already have images cropped at ${cropCoords}`);
    });
    callback();
}


function makeVideos(imgDir, videoDir) {
    const origPath = `${videoDir}/orig-4fps.mp4`;
    const interpPath = `${videoDir}/interpolated-lossless.mp4`;
    const compressedPath = `${videoDir}/interpolated.mp4`;
    if(fileExists(compressedPath)) { console.log(`already have video for ${cropCoords}`); return; }

    ensureDir(videoDir);
    execAndLog(makeVideoCmd(imgDir, 4, origPath), true, 'make video');
    execAndLog(`butterflow -l -v -s full,spd=1 -r 60 -o ${interpPath} ${origPath}`);
    execAndLog(makeCompressVideoCmd(interpPath, compressedPath));
    sh.rm(interpPath);
}



function makeScaledVideos(callback) {
    const scale = '50%';
    const scaledDir = `${imgPath}/${scale}`;
    const videoDir = `${imgPath}/${scale}/video`;
    makeVideos(scaledDir, videoDir);
    callback();
}

function makeCroppedVideos(crops, callback) {
    crops.forEach(cropCoords => {
        const cropDir = `${imgPath}/${cropCoords}`;
        const videoDir = `${imgPath}/video/${cropCoords}`;
        const losslessPath = `${videoDir}/interpolated-lossless.mp4`;
        const compressedPath = `${videoDir}/interpolated.mp4`;
        if(fileExists(compressedPath)) { console.log(`already have video for ${cropCoords}`); return; }
        ensureDir(videoDir);
        execAndLog(makeVideoCmd(cropDir, 4, `${videoDir}/orig-4fps.mp4`), true, 'make video');
        // execAndLog(`butterflow -l -v -s full,spd=1 -r 60 -o ${losslessPath} ${videoDir}/orig-4fps.mp4`);
        execAndLog(makeCompressVideoCmd(losslessPath, compressedPath));
    });
    callback();
}

function absoluteImgURI(imgURI) { return absoluteURI(baseSrcURI, imgURI); }
function imgPathFromURI(imgURI) { return `${imgPath}/${fileNameFromURI(imgURI)}`; }
function imgFileExistsForURI(imgURI) { return fileExists(imgPathFromURI(imgURI)); }

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

const ftpHost = 'rammftp.cira.colostate.edu';
const srcDir = '/Lindsey/delaney/';
const imgPath = '../testimg/geocolortest';
// const imgPath = '/media/dan/Galactica/earth/img/geocolortest';
const scrapeLimit = 500;
const scrapeSleep = 0;

const ftp = new JSFtp({host: ftpHost});

function absoluteImgURI(imgURI) { return absoluteURI(baseSrcURI, imgURI); }
function imgPathFromURI(imgURI) { return `${imgPath}/${fileNameFromURI(imgURI)}`; }
function imgFileExistsForURI(imgURI) { return fileExists(imgPathFromURI(imgURI)); }

function doThenCallback(func) {
	return function(cb) { func(); cb(); }
}

function main(callback) {
    const q = queue({concurrency: 1});
    q.push(
        // cb => retrieveImages(cb),
        doThenCallback(() => makeVideos(`${imgPath}/japan/100%`, `${imgPath}/japan/video`)),
        doThenCallback(() => makeVideos(`${imgPath}/korea/100%`, `${imgPath}/korea/video`)),

        // doThenCallback(() => resizeImages(`${imgPath}/korea/100%`, `${imgPath}/korea/50%`)),
        // doThenCallback(() => makeVideos(`${imgPath}/korea/50%`, `${imgPath}/korea/50%/video`)),

        // cb => {
        //     makeVideos(`${imgPath}/japan`, `${imgPath}/japan/video`);
        //     cb();
        // },
        // cb => {
        //     makeVideos(`${imgPath}/korea`, `${imgPath}/korea/video`);
        //     cb();
        // },
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
        console.log(imgNamesToSave);
        if(!imgNamesToSave.length) { callback(); return; }
        console.log("estimated time with " + scrapeSleep + " second sleep:");
        console.log(moment().add((scrapeSleep+2) * imgNamesToSave.length, 'seconds').diff(moment(), 'minutes') + " minutes");

        // const saveDir = `${imgPath}/100%`;
        // ensureDir(saveDir);

        // return;

        imgNamesToSave.forEach((imgName, i) => { // download the files
            q.push(next => {
            	const country = imgName.split('_')[1];
            	const saveDir = `${imgPath}/${country}/100%`;
            	ensureDir(saveDir);

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

function resizeImages(fullDir, scaledDir, {scale='50%'}={}) {
    // have to downscale the images so butterflow doesn't explode
    ensureDir(scaledDir);
    const mogrifyCmd = `mogrify -path ${scaledDir} -resize ${scale} ${fullDir}/*.jpg`;
    //const isJpg = name => name.indexOf('.jpg') > -1;
    //const hasResized = (sh.ls(fullDir).filter(isJpg).length === sh.ls(scaledDir).filter(isJpg).length);
    execAndLog(mogrifyCmd, true, 'mogrify resize');
    //else console.log(`already have images scaled at ${scale}`);
    
}

function makeVideos(imgDir, videoDir) {
    const origPath = `${videoDir}/orig-4fps.mp4`;
    const interpPath = `${videoDir}/interpolated-lossless.mp4`;
    const compressedPath = `${videoDir}/interpolated.mp4`;
    if(fileExists(compressedPath)) { console.log(`already have video for ${compressedPath}`); return; }

    ensureDir(videoDir);
    execAndLog(makeVideoCmd(imgDir, 4, origPath), true, 'make video');
    execAndLog(`butterflow -l -v -hw --poly-s 0.8 -s full,spd=1 -r 60 -o ${interpPath} ${origPath}`);
    execAndLog(makeCompressVideoCmd(interpPath, compressedPath, {preset: 'ultrafast'}));
    sh.rm(interpPath);
}


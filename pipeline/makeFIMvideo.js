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
    makeVideoCmd
} from './utils.js';

const ftpHost = 'public.sos.noaa.gov';
const srcDir = '/rt/grids/fimvis/4096';
const imgPath = '/Volumes/Galactica/earth/img/fimvis';
const scrapeLimit = 500;
const scrapeSleep = 0;

const ftp = new JSFtp({host: ftpHost});

function main(callback) {
    const q = queue({concurrency: 1});
    q.push(
        cb => retrieveImages(cb),
        cb => resizeImages(cb),
        cb => makeVideos(cb),
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

        imgNamesToSave.forEach((imgName, i) => { // download the files
            q.push(next => {
                ftp.get(`${srcDir}/${imgName}`, imgPathFromURI(imgName), (err, response) => {
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
    const scaledDir = `${imgPath}/${scale}`;
    const mogrifyCmd = `mogrify -path ${scaledDir} -resize ${scale} ${imgPath}/*.jpg`;
    ensureDir(scaledDir);
    const isJpg = name => name.indexOf('.jpg') > -1;
    const hasResized = (sh.ls(imgPath).filter(isJpg).length === sh.ls(scaledDir).filter(isJpg).length);
    if(!hasResized) execAndLog(mogrifyCmd, true, 'mogrify resize');
    else console.log(`already have images scaled at ${scale}`);
    callback();
}

function makeVideos(callback) {
    const scale = '50%';
    const scaledDir = `${imgPath}/${scale}`;
    const videoDir = `${imgPath}/video`;
    ensureDir(videoDir);
    sh.exec(makeVideoCmd(scaledDir, 4, `${videoDir}/orig-4fps.mp4`), true, 'make video');

    sh.exec(`butterflow -s full,spd=1 -r 60 -o ${videoDir}/interpolated.mp4 ${videoDir}/orig-4fps.mp4`);
    callback();
}

function absoluteImgURI(imgURI) { return absoluteURI(baseSrcURI, imgURI); }
function imgPathFromURI(imgURI) { return `${imgPath}/${fileNameFromURI(imgURI)}`; }
function imgFileExistsForURI(imgURI) { return fileExists(imgPathFromURI(imgURI)); }

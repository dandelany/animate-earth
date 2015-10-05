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
    wget,
    fileExists, dirExists, ensureDir,
    fileNameFromURI, execAndLog, absoluteURI,
    makeVideoCmd
} from './utils.js';


const baseURI = "http://sdo.gsfc.nasa.gov/assets/img/browse";

//const imgPath = '/Volumes/Galactica/earth/img/sdo';
// const imgPath = '../img/sdo';
const imgPath = '/media/dan/Galactica/earth/img/sdo'
// const outPath = '../testout/sdo';
const outPath = '/media/dan/Galactica/earth/output/sdo'

const saveResolution = '4096';
const saveBands = ['0131', '0171'];
// const saveBands = ['0131']
const crops = ['1920x1080+2096+2200'];

function main(callback) {
    const date = moment.utc('2015-10-01');
    console.log(dayURIFromDate(date));
    // retrieveSDOImages(baseURI, date, {bands: saveBands, resolution: saveResolution}, () => {
    //    cropSDOImages(date, saveBands, crops, outPath);
    //    makeSDOVideo(date, saveBands, crops, outPath);
    // });
    cropSDOImages(date, saveBands, crops, outPath);
    makeSDOVideo(date, saveBands, crops, outPath);
}
main();

function retrieveSDOImages(baseURI, date, {bands=[], resolution='4096'}, callback=_.noop) {
    const dayURI = dayURIFromDate(date);
    const dayPath = `${imgPath}/${dateToPath(date)}`;
    ensureDir(dayPath);

    request(dayURI, (error, response, body) => {
        const dayImgURIs = sdoImgURIsFromHtml(body, dayURI);
        const dayImages = dayImgURIs
            .map(parseSDOURI)
            .filter(img => img.resolution === resolution);

        bands.forEach(band => {
            const bandPath = `${dayPath}/${band}`;
            const bandImages = dayImages.filter(img => img.band === band);
            if(!bandImages.length) return;
            ensureDir(bandPath);

            bandImages.forEach(img => {
                const imgPath = `${bandPath}/${img.fileName}`;
                if(fileExists(imgPath)) { console.log(`image exists at ${imgPath}`); return; }
                execAndLog(wget(img.uri, imgPath), true, 'wget');
                execAndLog(`sleep 1`);
            });
        });
        callback();
    });
}

function cropSDOImages(date, bands, crops, outPath) {
    // crop the images based on given coordinates
    const dayPath = `${imgPath}/${dateToPath(date)}`;
    if(!dirExists(dayPath)) return;

    bands.forEach(band => {
        const bandPath = `${dayPath}/${band}`;
        if(!dirExists(bandPath)) return;
        const imgFiles = sh.ls(bandPath);
        if(!imgFiles.length) return;

        crops.forEach(crop => {
            const cropDir = `${outPath}/${dateToPath(date)}/${band}/${crop}/img`;
            console.log(cropDir);
            // const mogrifyCmd = `mogrify -path ${cropDir} -crop ${crop} ${bandPath}/*.jpg`;
            const mogrifyCmd = `mogrify -path ${cropDir} -crop ${crop} `+
                `-type Grayscale -contrast-stretch 0 -unsharp 0  ${bandPath}/*.jpg`;
            ensureDir(cropDir);
            execAndLog(mogrifyCmd, true, 'mogrify');
        })
    })
}

function makeSDOVideo(date, bands, crops, outPath) {
    const dayPath = `${imgPath}/${dateToPath(date)}`;
    if(!dirExists(dayPath)) return;

    bands.forEach(band => {
        crops.forEach(crop => {
            const cropDir = `${outPath}/${dateToPath(date)}/${band}/${crop}`;
            const cropImgDir = `${cropDir}/img`;
            const videoDir = `${cropDir}/video`;
            const videoPath = `${videoDir}/${date.format('YYYY-MM-DD')}-${band}.mp4`;
            const interpPath = `${videoDir}/${date.format('YYYY-MM-DD')}-${band}-interpolated.mp4`;
            if(!dirExists(cropImgDir) || !sh.ls(cropImgDir).length) return;

            ensureDir(videoDir);
            execAndLog(makeVideoCmd(cropImgDir, 3, videoPath), true, 'video creation');
            execAndLog(`butterflow -v -s full,spd=1 -r 60 -o ${interpPath} ${videoPath}`);
        })
    })
}


function sdoImgURIsFromHtml(htmlText, dayURI) {
    const $ = cheerio.load(htmlText);
    return Array.from(
        $('a') // find links with known text on the index page
            .filter((i, el) => isJpg(fileNameFromURI($(el).attr('href'))))
            .map((i, el) => $(el).attr('href'))
    )
    .map(imgURI => absoluteURI(dayURI, imgURI)); // convert to absolute URIs
}

function parseSDOURI(uri) {
    const fileName = fileNameFromURI(uri);
    const name = fileName.split('.')[0];
    const [dateStr, timeStr, resolution, band] = name.split('_');
    const date = parseSDODateStr(dateStr, timeStr);
    return {uri, fileName, name, date, resolution, band};
}

function parseSDODateStr(dateStr, timeStr) {
    return moment.utc([dateStr, timeStr].join('-'), 'YYYYMMDD-HHmmss').utcOffset(0);
}

function dayURIFromDate(date) {
    return `${baseURI}/${dateToPath(date)}`;
}
function dateToPath(date) { return date.format('YYYY/MM/DD'); }

function isJpg(name) { return name.indexOf('.jpg') > -1; }


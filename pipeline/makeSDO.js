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

const dayURI = date => `${baseURI}/${dateToPath(date)}`;
const dayImgPath = date => `${imgPath}/${dateToPath(date)}`;
const bandImgPath = (date, band) => `${dayImgPath(date)}/${band}`;
const dayOutPath = date => `${outPath}/${dateToPath(date)}`;
const bandOutPath = (date, band) => `${dayOutPath(date)}/${band}`;

const saveResolution = '4096';
// const saveBands = ['0131', '0171'];
const saveBands = ['0171']
const crops = ['1920x1080+2096+2200'];

const products = [
    {
        name: 'active-region-2015-10-01',
        start: moment.utc('2015-09-28'),
        days: 6,
        bands: ['0171'],
        crops: ['1920x1080+2096+2200'],
        resolution: '4096'
    }
];

function main(callback) {
    products.forEach(makeSDOProduct);

    return;

    const date = moment.utc('2015-09-28');
    console.log(dayURIFromDate(date));
    retrieveSDOImages(baseURI, date, saveBands, {resolution: saveResolution}, () => {
       cropSDOImages(date, saveBands, crops, outPath);
       makeSDOVideo([date], saveBands, crops, outPath);
    });
    // cropSDOImages(date, saveBands, crops, outPath);
    // makeSDOVideo(date, saveBands, crops, outPath);
}

function makeSDOProduct(product, callback=_.noop) {
    const q = queue({concurrency: 1});
    const {start, days, bands, crops, resolution} = product;
    const dates = _.range(days).map(i => start.clone().add(i, 'days'));
    const productPath = `${outPath}/products/${product.name || 'untitled'}`;
    const productImgPath = `${productPath}/img`;
    const productVideoPath = `${productPath}/video`;

    // for each day in this product, request all images for required bands
    ensureDir(productImgPath);
    dates.forEach(date => {
        q.push(cb => retrieveSDOImages(date, bands, {resolution}, cb));
        
    });
    dates.forEach(date => {
        q.push(cb => { cropSDOImages(date, bands[0], crops, productImgPath); cb(); })
    });

    q.push(cb => makeSDOVideo(productImgPath, productVideoPath, product.name));

    q.start(callback);
}

main();


function retrieveSDOImages(date, bands, {resolution='4096', expected=96}, callback=_.noop) {
    // check if we already have all images for this day + bands & short circuit if so
    const isDone = _.all(bands, band => dirHasJpgs(bandImgPath(date, band), expected));
    if(isDone) { 
        console.log(`already have images for ${dateToPath(date)}`); 
        callback(); 
        return;
    } else console.log(`requesting image list for ${dateToPath(date)}...`)

    // get the index page for this date and parse the URLs listed in it to get image details
    const uri = dayURI(date);
    request(uri, (error, response, body) => {
        const dayImgURIs = sdoImgURIsFromHtml(body, uri);
        const dayImages = dayImgURIs
            .map(parseSDOURI)
            .filter(img => img.resolution === resolution);
        console.log(`available AIA bands: ${_.uniq(_.pluck(dayImages, 'band'))}`);

        // check each requested band
        bands.forEach(band => {
            const bandPath = bandImgPath(date, band);
            const bandImages = dayImages.filter(img => img.band === band);
            if(!bandImages.length) { console.log(`no images for band ${band} ${date}`); return; }
            if(dirHasJpgs(bandPath, expected)) { console.log(`already done with ${bandPath}`); return; }

            // the server has images for this band that we don't have, so request them
            ensureDir(bandPath);
            bandImages.forEach(img => {
                const imgPath = `${bandPath}/${img.fileName}`;
                if(fileExists(imgPath)) { console.log(`image exists for ${imgPath}`); return; }
                execAndLog(wget(img.uri, imgPath), true, 'wget');
                execAndLog(`sleep 1`);
            });
        });
        callback();
    });
}


// function cropSDOImages(date, bands, crops) {
//     // crop the images based on given coordinates
//     bands.forEach(band => {
//         const bandPath = bandImgPath(date, band);
//         if(!dirHasJpgs(bandPath)) { console.log(`no images for ${dateToPath(date)} ${band}`); return; }

//         crops.forEach(crop => {
//             const cropDir = `${bandOutPath(date, band)}/${crop}/img`;
//             const isDone = (sh.ls(bandPath).filter(isJpg).length === sh.ls(cropDir).filter(isJpg).length);
//             if(isDone) { console.log(`crops exist for ${dateToPath(date)} ${band} ${crop}`); return; }

//             // const mogrifyCmd = `mogrify -path ${cropDir} -crop ${crop} ${bandPath}/*.jpg`;
//             const mogrifyCmd = `mogrify -path ${cropDir} -crop ${crop} `+
//                 `-type Grayscale -contrast-stretch 0 -unsharp 0  ${bandPath}/*.jpg`;
//             ensureDir(cropDir);
//             execAndLog(mogrifyCmd, true, 'mogrify');
//         })
//     })
// }

function cropSDOImages(date, band, crop, cropDir) {
    // crop the images based on given coordinates
    const bandPath = bandImgPath(date, band);
    if(!dirHasJpgs(bandPath)) { console.log(`no images for ${dateToPath(date)} ${band}`); return; }

    if(!cropDir) cropDir = `${bandOutPath(date, band)}/${crop}/img`;
    const mogrifyCmd = `mogrify -path ${cropDir} -crop ${crop} `+
        `-type Grayscale -contrast-stretch 0 -unsharp 0  ${bandPath}/*.jpg`;
    ensureDir(cropDir);
    execAndLog(mogrifyCmd, true, 'mogrify');
}

// function makeSDOVideo(dates, bands, crops, outPath) {
//     const dayPath = `${imgPath}/${dateToPath(date)}`;
//     if(!dirExists(dayPath)) return;

//     bands.forEach(band => {
//         crops.forEach(crop => {
//             const cropDir = `${outPath}/${dateToPath(date)}/${band}/${crop}`;
//             const cropImgDir = `${cropDir}/img`;
//             const videoDir = `${cropDir}/video`;
//             const videoPath = `${videoDir}/${date.format('YYYY-MM-DD')}-${band}.mp4`;
//             const interpPath = `${videoDir}/${date.format('YYYY-MM-DD')}-${band}-interpolated.mp4`;
//             if(!dirExists(cropImgDir) || !sh.ls(cropImgDir).length) return;

//             ensureDir(videoDir);
//             execAndLog(makeVideoCmd(cropImgDir, 3, videoPath), true, 'video creation');
//             execAndLog(`butterflow -v -s full,spd=1 -r 60 -o ${interpPath} ${videoPath}`);
//         })
//     })
// }

function makeSDOVideo(imgDir, outDir, name, {origFPS=3, finalFPS=60, speed=1}={}) {
    if(!dirExists(imgDir) || !sh.ls(imgDir).length) return;
    const videoPath = `${outDir}/${name}-original.mp4`;
    const interpPath = `${outDir}/${name}-interpolated.mp4`;
    if(fileExists(interpPath)) { console.log(`already made video for ${outDir}`); return; }

    ensureDir(outDir);
    execAndLog(makeVideoCmd(imgDir, origFPS, videoPath), true, 'video creation');
    execAndLog(
        `butterflow -v -s full,spd=${speed} -r ${finalFPS} -o ${interpPath} ${videoPath}`,
    true, 'butterflow');
}



function sdoImgURIsFromHtml(htmlText, uri) {
    const $ = cheerio.load(htmlText);
    return Array.from(
        $('a') // find links with known text on the index page
            .filter((i, el) => isJpg(fileNameFromURI($(el).attr('href'))))
            .map((i, el) => $(el).attr('href'))
    )
    .map(imgURI => absoluteURI(uri, imgURI)); // convert to absolute URIs
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

function dirHasJpgs(path, expected=1) {
    return dirExists(path) && sh.ls(path).filter(isJpg).length >= expected;
}

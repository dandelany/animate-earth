import _ from 'lodash';
import sh from 'shelljs';
import moment from 'moment';
import request from 'request';
import cheerio from 'cheerio';
import sleep from 'sleep';

import {
    baseSrcURI, srcIndexPage,
    scrapeSleep, scrapeLimit,
    imgPath
} from './config.js';

import {
    fileExists, absoluteURI, fileNameFromURI,
    execAndLog
} from './utils.js';

const indexURI = `${baseSrcURI}/${srcIndexPage}`;
console.log(`checking for new image URLs on ${indexURI}`);

request(indexURI, (error, response, body) => {
    // find URIs of images linked to from the index page
    const imgURIs = imgURIsFromIndexHtml(body);
    console.log(`${imgURIs.length} image URIs found`);
    console.log(`${imgURIs.filter(imgFileExistsForURI).length} of ${imgURIs.length} already downloaded`);
    console.log(`limited to last ${scrapeLimit} images`);

    const imgURIsToSave = _(imgURIs)
        .take(scrapeLimit) // limit to maximum #
        .reject(imgFileExistsForURI) // don't save images that exist
        .value();

    console.log(`${imgURIsToSave.length} new images to download`);
    if(!imgURIsToSave.length) return;
    console.log("estimated time with " + scrapeSleep + " second sleep:");
    console.log(moment().add((scrapeSleep+5) * imgURIsToSave.length, 'seconds').diff(moment(), 'minutes') + " minutes");

    // go through each of the image URIs and download them
    imgURIsToSave.forEach((imgURI, i) => {
        // download the image at imgURI
        execAndLog(makeWgetCmd(imgURI, imgPathFromURI(imgURI)), true, 'download');
        console.log(`saved image ${i+1} of ${imgURIsToSave.length}: ${fileNameFromURI(imgURI)}`);
        // sleep before requesting next image
        if(i+1 === imgURIsToSave.length) return;
        execAndLog(`sleep ${scrapeSleep}`);
    });
});

function imgURIsFromIndexHtml(htmlText, resolution='high') {
    const $ = cheerio.load(htmlText);
    return Array.from(
        $('a') // find links with known text on the index page
            .filter((i, el) => $(el).text() === (resolution === 'high' ? 'Hi-Res Image' : 'Image'))
            .map((i, el) => $(el).attr('href'))
    ).map(absoluteImgURI); // convert to absolute URIs
}

function absoluteImgURI(imgURI) { return absoluteURI(baseSrcURI, imgURI); }
function imgPathFromURI(imgURI) { return `${imgPath}/${fileNameFromURI(imgURI)}`; }
function imgFileExistsForURI(imgURI) { return fileExists(imgPathFromURI(imgURI)); }

function makeWgetCmd(uri, savePath) {
    return `wget -O ${savePath} ${uri}`;
}

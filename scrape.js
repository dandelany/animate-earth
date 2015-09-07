import fs from 'fs';
import path from 'path';
import sleep from 'sleep';
import _ from 'lodash';
import moment from 'moment';
import request from 'request';
import cheerio from 'cheerio';
import fileExists from 'file-exists';
const throttledRequest = require('throttled-request')(request);

const baseUrl = 'http://rammb.cira.colostate.edu/ramsdis/online/';
const indexPage = 'archive_hi_res.asp?data_folder=himawari-8/full_disk_ahi_true_color';
//const savePath = 'img/full-disk-true-color/';
const savePath = '/Volumes/Galactica/earth/img/full-disk-true-color/';
const resolution = 'high';
const sleepSeconds = 9;
const limit = 5000;

let timers = {};
throttledRequest.configure({requests: 1, milliseconds: sleepSeconds * 1000});
throttledRequest.on('request', function(url) {
    console.log(`requesting ${fileNameFromUrl(url)}`);
    timers[url] = new Date().getTime();
});

console.log('checking rammb.cira.colostate for ' + resolution + ' resolution image URLs...');
request(baseUrl + indexPage, (error, response, body) => {
    let imgUrls = getImgUrls(body);
    console.log(`${imgUrls.length} image URLs found`);
    console.log(imgUrls.filter(fileExistsForUrl).length + " of " + imgUrls.length + " already downloaded");
    console.log("limited to first " + limit + " images");

    const newImgUrls = _(imgUrls)
        .take(limit) // take it to the limit
        .reject(fileExistsForUrl)
        .map(makeAbsoluteUrl)
        .value();

    console.log(newImgUrls.length + " new images to download");
    if(newImgUrls.length === 0) return;
    console.log("estimated time with " + sleepSeconds + " second sleep:");
    console.log(moment().add(sleepSeconds * newImgUrls.length, 'seconds').diff(moment(), 'minutes') + " minutes");

    let savedCount = 0;
    newImgUrls.forEach((url, i) => {
        download(
            url,
            makeSavePath(fileNameFromUrl(url)),
            (timer) => {
                const started = _.has(timers, url) ? timers[url] : null;
                const timeTaken = started ? ((new Date().getTime() - started) / 1000).toFixed(2) : "??";
                savedCount++;
                console.log(`saved ${savedCount} of ${newImgUrls.length} in ${timeTaken}s : ${fileNameFromUrl(url)}`)
            }
        );
    });
});

function getImgUrls(htmlText) {
    const $ = cheerio.load(htmlText);
    return Array.from(
        $('a')
            .filter((i, el) => $(el).text() === (resolution === 'high' ? 'Hi-Res Image' : 'Image'))
            .map((i, el) => $(el).attr('href'))
    ).reverse();
}

function fileExistsForUrl(url) {
    return fileExists(makeSavePath(fileNameFromUrl(url)));
}
function makeSavePath(fileName) { return savePath + resolution + '/' + fileName; }
function makeAbsoluteUrl(url) { return baseUrl + url; }
function fileNameFromUrl(url) { return _.last(url.split('/')); }

function download(url, filename, callback=_.noop) {
    let timer = new Date().getTime();
    throttledRequest(url).pipe(fs.createWriteStream(filename)).on('close', _.partial(callback, timer));
}

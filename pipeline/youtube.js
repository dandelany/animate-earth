import Youtube from 'youtube-api';
import fs from 'fs';
import ReadJson from 'r-json';
import ReadLine from 'readline';
import Lien from 'lien';
import opn from 'opn';

import Google from 'googleapis';
const {OAuth2} = Google.auth;

import {fileExists} from './utils.js';

// get from https://console.developers.google.com/project
//const CREDENTIALS = ReadJson("./secret/credentials.json");
import CREDENTIALS from "./secret/credentials.json";

const vidPath = '../testout/20150921221000-20150922014000/640x480+1000+1000/video/interpolated-2-60fps-0.666667x.mp4';

//Youtube.videos.insert({
//    resource: {
//        // Video title and description
//        snippet: {
//            title: "Testing YouTube API NodeJS module",
//            description: "Test video upload via YouTube API"
//        },
//        // I don't want to spam my subscribers
//        status: {
//            privacyStatus: "private"
//        }
//    },
//    // This is for the callback function
//    part: "snippet,status",
//
//    // Create the readable stream to upload the video
//    media: {
//        body: fs.createReadStream(vidPath)
//    }
//}, function (err, data) {
//    if (err) { return lien.end(err, 400); }
//    lien.end(data);
//});

authenticateYoutube((Youtube, oauth2Client) => {
    Youtube.playlists.list({
            part: 'contentDetails,snippet',
            mine: true
        },
        function (err, data) {
            if(err) throw err;
            console.log(data.items[0].snippet);
        });
});

function authenticateYoutube(callback) {
    const oauth2Client = new OAuth2(
        CREDENTIALS.web.client_id,
        CREDENTIALS.web.client_secret,
        CREDENTIALS.web.redirect_uris[0]
    );
    const Youtube = Google.youtube("v3");
    Google.options({auth: oauth2Client});

    if(fileExists('./secret/tokens.json')) {
        // tokens already exist
        const tokens = require('./secret/tokens.json');
        oauth2Client.setCredentials(tokens);
        callback(Youtube, oauth2Client);
    } else {
        // open the consent page to get token
        opn(oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: ["https://www.googleapis.com/auth/youtube"]
        }));
        // Init lien server
        var server = new Lien({host: "localhost", port: 5000});
        server.page.add("/oauth2callback", function (lien) {
            console.log("Trying to get the token using the following code: " + lien.search.code);
            oauth2Client.getToken(lien.search.code, function(err, tokens) {
                if (err) { lien(err, 400); return console.log(err); }
                oauth2Client.setCredentials(tokens);
                fs.writeFile('./secret/tokens.json', JSON.stringify(tokens), err => {
                    lien.end("authorized!");
                    callback(Youtube, oauth2Client);
                });
            });
        });
    }
}
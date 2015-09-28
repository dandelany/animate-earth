import _ from 'lodash';
import fs from 'fs';
import Lien from 'lien';
import express from 'express';
import opn from 'opn';
import sh from 'shelljs';
import queue from 'queue';
import Google from 'googleapis';
const {OAuth2} = Google.auth;

import {fileExists} from './utils.js';
import credentials from "./secret/credentials.json";
import {
    products,
    projectTitle, playlistDescription, videoTitle, videoDescription, videoTags,
    outPath, origFPS, finalFPS, speed
} from './config.js';
import {parseTimeStr, niceDate} from './utils.js';

// shared Youtube singleton
const Youtube = Google.youtube("v3");

makePlaylists();

function makePlaylists() {
    //const makePlaylistTitle = (product) => `${projectTitle}: ${product.title}`;
    //const makePlaylistDescription = product => `${playlistDescription.replace("<TITLE>", product.title)}`;

    authenticateYoutube(credentials, './secret/token.json', (oauth2Client) => {
        const makeTitle = (product) => `${projectTitle}: ${product.title}`;
        const makeDescription = product => `${playlistDescription.replace("<TITLE>", product.title)}`;
        ensurePlaylistsForProducts(products, () => {
            uploadVideosForProducts(products);
        }, {makeTitle, makeDescription});
    });
}

function ensurePlaylistsForProducts(products, callback, {makeTitle, makeDescription=()=>''}={}) {
    const q = queue({concurrency: 1});
    if(!makeTitle) makeTitle = (product) => product.title;

    // first get playlists from Youtube API
    listPlaylists((err, data) => {
        catchErr(err);
        // and find their associated product IDs (via the 'id:x' tag)
        const playlistsByProductId = _.omit(_.indexBy(data.items, getIdFromTag), null);

        // for each expected product, ensure a playlist exists and has the correct information
        products.forEach(product => {
            const productPlaylist = playlistsByProductId[product.id];
            const updatedPlaylist = {
                title: makeTitle(product),
                description: makeDescription(product),
                tags: [`id:${product.id}`].concat(product.tags || [])
            };
            if(!productPlaylist) { // youtube playlist doesn't exist, create it
                q.push(function(next) {
                    addPlaylist(updatedPlaylist, (err, data) => {
                        catchErr(err);
                        console.log('created playlist', updatedPlaylist);
                        next();
                    });
                });
            } else if(!_.every(updatedPlaylist, (val, key) => _.isEqual(productPlaylist.snippet[key], val))) {
                // youtube playlist doesn't match expected title/description/tags, update it
                q.push(function(next) {
                    updatePlaylist(productPlaylist.id, updatedPlaylist, (err, data) => {
                        catchErr(err);
                        console.log('updated playlist', updatedPlaylist);
                        next();
                    })
                });
            } else console.log(`playlist ${updatedPlaylist.title} is OK.`);
        });

        q.start(callback);
    });
}

function uploadVideosForProducts(products) {
    // get playlists from Youtube API
    listPlaylists((err, data) => {
        catchErr(err);
        // and find their associated product IDs (via the 'id:x' tag)
        const playlistsByProductId = _.omit(_.indexBy(data.items, getIdFromTag), null);
        const sessionDirs = sh.ls(outPath);

        // then ensure videos exist for each product
        products.forEach(product => {
            const productPlaylist = playlistsByProductId[product.id];
            if(!productPlaylist) return; // assume playlists exist
            ensureVideosForProduct(product, productPlaylist, () => { console.log('all uploaded')});
        });
    });
}

function ensureVideosForProduct(product, playlist, callback) {
    const q = queue({concurrency: 1});
    // ensures that all videos which exist in outPath for this product are uploaded to Youtube with the correct info
    // get the list of items in the playlist from API
    listPlaylistItems(playlist.id, (err, data) => {
        catchErr(err);
        const playlistItems = data.items;
        console.log(`got ${playlistItems.length} items in playlist`);
        const videoIds = _.pluck(playlistItems, 'snippet.resourceId.videoId');
        // have to get video information with videos.list because playlistItems doesn't return tags
        getVideoById(videoIds.join(','), (err, data) => {
            catchErr(err);
            console.log(`got info for ${data.items.length} videos`);
            // video id:x tags contain the sessionId, ie. directory name, eg. '20150920210000-20150921123000'
            const videosBySessionId = _.omit(_.indexBy(data.items, getIdFromTag), null);
            const sessionDirs = sh.ls(outPath);

            sessionDirs.forEach(sessionId => {
                const videoFileName = `interpolated-${origFPS}-${finalFPS}fps-${speed}x.mp4`;
                const videoPath = `${outPath}/${sessionId}/${product.crop}/video/${videoFileName}`;
                if(fileExists(videoPath) && !videosBySessionId[sessionId]) {
                    // file exists for this product, and video is not in playlist, so upload it
                    q.push(function(next) {
                        const dateStr = parseTimeStr(sessionId.split('-')[0]).format('MMM D, YYYY');
                        const videoInfo = {projectTitle, product, date: dateStr};
                        const snippet = {
                            title: _.template(videoTitle)(videoInfo),
                            description: _.template(videoDescription)(videoInfo),
                            tags: (product.tags || []).concat(videoTags || []).concat(`id:${sessionId}`)
                        };
                        
                        // upload the video
                        console.log('uploading', snippet.title, 'from', videoPath);
                        uploadVideo(videoPath, snippet, (err, data) => {
                            catchErr(err);
                            console.log('uploaded successfully!');
                            // then add it to the correct playlist
                            addVideoToPlaylist(data.id, playlist.id, (err, data) => {
                                catchErr(err);
                                console.log(`added video ${data.snippet.title} to playlist ${playlist.snippet.title}`);
                                next();
                            }); // todo figure out position
                        }, {privacyStatus: 'private'})
                    });
                } else if(videosBySessionId[sessionId]) {
                    // todo ensure correct information
                    console.log('video already exists for', sessionId);
                }
            });

            q.start(callback);
        });
    });
}

function getIdFromTag(playlist) {
    const idRegex = /^id:(.+)/;
    const idTag = _.find(playlist.snippet.tags || [], tag => tag.match(idRegex));
    return idTag ? idTag.match(idRegex)[1] : null;
}

function catchErr(err) {
    if(err) { console.log(err); throw err; }
}

function listPlaylists(callback, {part='id,contentDetails,snippet,status'}={}) {
    callback = callback || catchErr;
    // todo handle > 50 results with pagination
    Youtube.playlists.list({part, mine: true, maxResults: 50}, callback);
}

function listPlaylistItems(playlistId, callback, {part='id,contentDetails,snippet,status'}={}) {
    callback = callback || catchErr;
    // todo handle > 50 results with pagination
    Youtube.playlistItems.list({part, playlistId, maxResults: 50}, callback);
}

function getVideoById(videoId, callback, {part='id,contentDetails,snippet,status'}={}) {
    callback = callback || catchErr;
    // todo handle > 50 results with pagination
    Youtube.videos.list({part, id: videoId, maxResults: 50}, callback);
}

function updatePlaylist(id, snippet, callback, {privacyStatus='public'}={}) {
    callback = callback || catchErr;
    Youtube.playlists.update({
        part: 'snippet,status',
        resource: {id, snippet, status: {privacyStatus}}
    }, callback);
}

function addPlaylist(snippet, callback, {privacyStatus='public'}={}) {
    callback = callback || catchErr;
    // insert new playlist via Youtube api
    Youtube.playlists.insert({
        part: 'snippet,status',
        resource: {snippet, status: {privacyStatus}}
    }, callback);
}

function addVideoToPlaylist(videoId, playlistId, callback, {position}={}) {
    callback = callback || catchErr;
    // add an existing video to an existing playlist via Youtube api
    Youtube.playlistItems.insert({
        part: 'snippet,id',
        resource: {snippet: {resourceId: {kind: 'youtube#video', videoId}, playlistId}}
    }, callback);
}

function uploadVideo(videoPath, snippet, callback, {privacyStatus='public'}={}) {
    // Upload video via the Youtube API
    callback = callback || catchErr;
    Youtube.videos.insert({
        part: 'snippet,status',
        resource: {snippet, status: {privacyStatus}},
        media: {body: fs.createReadStream(videoPath)}
    }, callback);
}

function authenticateYoutube(credentials, tokenPath, callback) {
    const {client_id, client_secret, redirect_uris} = credentials.web;
    const oauth2Client = new OAuth2(client_id, client_secret, redirect_uris[0]);
    Google.options({auth: oauth2Client});

    if(fileExists(tokenPath)) {
        console.log('youtube token already exists');
        const tokens = JSON.parse(sh.cat(tokenPath));
        oauth2Client.setCredentials(tokens);
        // get playlists to check if token is really valid or not
        listPlaylists((err, data) => {
            if(err) {
                console.log('youtube token invalid, getting a new one');
                getYoutubeTokens(oauth2Client, tokenPath, callback);
            } else {
                console.log('youtube token is still valid');
                callback(oauth2Client);
            }
        }, {part: 'id'});
    } else {
        getYoutubeTokens(oauth2Client, tokenPath, callback);
    }
}

function getYoutubeTokens(oauth2Client, tokenPath, callback) {
    // open the consent page to get token
    opn(oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/youtube"]
    }));
    // create a server to listen for response after user gives consent
    const app = express();
    const server = app.listen(5000);
    app.get('/oauth2callback', (req, res) => {
        console.log('trying with code', req.query.code);
        oauth2Client.getToken(req.query.code, function(err, token) {
            if (err) { res.send('error :( ' + err); throw err; }
            oauth2Client.setCredentials(token);
            fs.writeFile(tokenPath, JSON.stringify(token), err => {
                console.log('saved new google token');
                res.send("authorized!");
                server.close();
                callback(oauth2Client);
            });
        });
    });
}

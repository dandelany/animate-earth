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
import { projectTitle, playlistDescription, products } from './config.js'

makePlaylists();

function makePlaylists() {
    authenticateYoutube(credentials, './secret/token.json', (Youtube, oauth2Client) => {
        const makeTitle = (product) => `${projectTitle}: ${product.title}`;
        const makeDescription = product => playlistDescription.replace("<TITLE>", product.title);
        ensurePlaylistsForProducts(Youtube, products, makeTitle, makeDescription);
    });
}

function ensurePlaylistsForProducts(Youtube, products, makeTitle, makeDescription=()=>'') {
    const q = queue({concurrency: 1});
    if(!makeTitle) makeTitle = (product) => product.title;

    listPlaylists(Youtube, (err, data) => {
        const playlists = data.items;
        const playlistsById = _.indexBy(playlists, 'id');
        const log = getYoutubeLog();
        const logPlaylistsByProductId = _.indexBy(log.playlists, 'productId');

        products.forEach(product => {
            const playlistInLog = logPlaylistsByProductId[product.id];
            // todo update title or description if changed
            // check if playlist for this product exists in youtube-log
            if(!playlistInLog || !_.has(playlistsById, playlistInLog.id)) {
                if(playlistInLog && !_.has(playlistsById, playlistInLog.id)) {
                    // playlist exists in the log but not in real life, so it was deleted, delete from logs
                    console.log(`removing deleted playlist ${playlistInLog.id} from log`);
                    delete log.playlists[playlistInLog.id];
                    saveYoutubeLog(log);
                }
                q.push(function(next) {
                    const playlist = {
                        title: makeTitle(product),
                        description: makeDescription(product)
                    };
                    addPlaylist(Youtube, playlist, (err, data) => {
                        if(err) throw err;
                        console.log('created playlist', playlist);
                        next();
                    }, {logData: {productId: product.id}});
                });
            } else console.log('playlist exists for', product.title);
        });

        q.start();
    });
}

function listPlaylists(Youtube, callback, {part='id,contentDetails,snippet,status'}={}) {
    if(!callback) callback = (err) => { throw err; };
    Youtube.playlists.list({part, mine: true}, callback);
}

function addPlaylist(Youtube, playlist, callback, {status='public', logData={}}={}) {
    if(!callback) callback = (err) => { throw err; };
    // insert new playlist via Youtube api
    Youtube.playlists.insert(
        {
            part: 'snippet,status',
            resource: {
                snippet: playlist,
                status: {privacyStatus: status}
            }
        },
        (err, data) => {
            if(!err) {
                // then save record of playlist to youtube-log.json
                const log = getYoutubeLog();
                _.assign(log.playlists, {
                    [data.id]: _.assign({
                        id: data.id,
                        title: data.snippet.title,
                        description: data.snippet.description
                    }, logData)
                });
                saveYoutubeLog(log);
            }
            callback(err, data);
        }
    );
}

function getYoutubeLog() {
    return JSON.parse(sh.cat('./youtube-log.json'));
}
function saveYoutubeLog(log) {
    return JSON.stringify(log, true, 2).to('./youtube-log.json'); // sh.to
}

function authenticateYoutube(credentials, tokenPath, callback) {
    const {client_id, client_secret, redirect_uris} = credentials.web;
    const oauth2Client = new OAuth2(client_id, client_secret, redirect_uris[0]);
    const Youtube = Google.youtube("v3");
    Google.options({auth: oauth2Client});

    if(fileExists(tokenPath)) {
        console.log('youtube token already exists');
        const tokens = JSON.parse(sh.cat(tokenPath));
        oauth2Client.setCredentials(tokens);
        // get playlists to check if token is really valid or not
        listPlaylists(Youtube, (err, data) => {
            if(err) {
                console.log('youtube token invalid, getting a new one');
                getYoutubeTokens(oauth2Client, tokenPath, _.partial(callback, Youtube));
            } else {
                console.log('youtube token is still valid');
                callback(Youtube, oauth2Client);
            }
        }, {part: 'id'});
    } else {
        getYoutubeTokens(oauth2Client, tokenPath, _.partial(callback, Youtube));
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

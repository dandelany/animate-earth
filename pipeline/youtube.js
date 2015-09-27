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

// shared Youtube singleton
const Youtube = Google.youtube("v3");

makePlaylists();

function makePlaylists() {
    //const makePlaylistTitle = (product) => `${projectTitle}: ${product.title}`;
    //const makePlaylistDescription = product => `${playlistDescription.replace("<TITLE>", product.title)}`;

    authenticateYoutube(credentials, './secret/token.json', (oauth2Client) => {
        const makeTitle = (product) => `${projectTitle}: ${product.title}`;
        const makeDescription = product => `${playlistDescription.replace("<TITLE>", product.title)}`;
        ensurePlaylistsForProducts(products, _.noop(), {makeTitle, makeDescription});
    });
}

function uploadVideosForProducts(products) {


    //const log = getYoutubeLog();
    //const logPlaylistsByProductId = _.indexBy(log.playlists, 'productId');
    //
    //products.forEach(product => {
    //     playlists assumed to already exist in log
        //const logPlaylist = logPlaylistsByProductId[product.id];
        //if(!logPlaylist) return;
        //const logItemsById = _.indexBy(logPlaylist.items || [], 'id');
        //
        //listPlaylistItems(logPlaylist.id, (err, data) => {
        //    const {items} = data;
        //    console.log(data);
        //    const itemInLog =
        //})
    //});
}

function ensurePlaylistsForProducts(products, callback, {makeTitle, makeDescription=()=>''}={}) {
    const q = queue({concurrency: 1});
    if(!makeTitle) makeTitle = (product) => product.title;

    listPlaylists((err, data) => {
        const playlistsByProductId = _.omit(_.indexBy(data.items, getPlaylistProductId), null);

        products.forEach(product => {
            const productPlaylist = playlistsByProductId[product.id];
            const updatedPlaylist = {
                title: makeTitle(product),
                description: makeDescription(product),
                tags: [`id:${product.id}`].concat(product.tags || [])
            };
            if(!productPlaylist) {
                q.push(function(next) {
                    addPlaylist(updatedPlaylist, (err, data) => {
                        if(err) throw err;
                        console.log('created playlist', updatedPlaylist);
                        next();
                    });
                });
            } else if(!_.every(updatedPlaylist, (val, key) => _.isEqual(productPlaylist.snippet[key], val))) {
                // youtube playlist doesn't match expected title/description/tags, so update it
                q.push(function(next) {
                    updatePlaylist(productPlaylist.id, updatedPlaylist, (err, data) => {
                        if(err) throw err;
                        console.log('updated playlist', updatedPlaylist);
                        next();
                    })
                });
            } else console.log(`playlist ${updatedPlaylist.title} is OK.`);
        });

        q.start();
    });
}

function getPlaylistProductId(playlist) {
    const idRegex = /^id:(.+)/;
    const idTag = _.find(playlist.snippet.tags || [], tag => tag.match(idRegex));
    return idTag ? idTag.match(idRegex)[1] : null;
}

function listPlaylists(callback, {part='id,contentDetails,snippet,status'}={}) {
    if(!callback) callback = (err) => { throw err; };
    Youtube.playlists.list({part, mine: true, maxResults: 50}, callback);
}

function listPlaylistItems(playlistId, callback, {part='id,contentDetails,snippet,status'}={}) {
    if(!callback) callback = (err) => { throw err; };
    Youtube.playlistItems.list({part, playlistId, maxResults: 50}, callback);
}

function updatePlaylist(id, snippet, callback, {privacyStatus='public'}={}) {
    if(!callback) callback = (err) => { throw err; };
    Youtube.playlists.update({
        part: 'snippet,status',
        resource: {id, snippet, status: {privacyStatus}}
    }, callback);
}

function addPlaylist(snippet, callback, {privacyStatus='public'}={}) {
    if(!callback) callback = (err) => { throw err; };
    // insert new playlist via Youtube api
    Youtube.playlists.insert({
        part: 'snippet,status',
        resource: {snippet, status: {privacyStatus}}
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

'use strict';

const { createClient } = require('microcms-js-sdk');
const fs = require('fs').promises;
const fsd = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const sharp = require('sharp');
const async = require('async');
require('dotenv').config();

const buildPath = path.join(__dirname, 'public');
const assetsPath = path.join(buildPath, 'assets');

const settings = {
    feed: {
        serviceDomain: 'sto',
        apiKey: process.env.sto,
        endpoints: ['news', 'events']
    },
    affiliate: {
        serviceDomain: 'stoaffiliatesinfo',
        apiKey: process.env.stoaffiliatesinfo,
        endpoints: ['affiliates']
    }
}
async.series([
    async () => await fileExists(buildPath),
    async () => await fileExists(assetsPath),
    async () => await feed(),
    async () => await affiliate(),
    async () => await optimizeImage(assetsPath, assetsPath)
]);
/*
Promise.all([
    fileExists(buildPath),
    fileExists(assetsPath),
    feed(),
    affiliate(),
    optimizeImage(assetsPath, assetsPath)
])
    .then(() => console.log('All operations completed.'))
    .catch(error => console.error(error));
*/

async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(path);
            return false;
        } else {
            throw error;
        }
    }
}

async function feed() {
    const client = createClient({ serviceDomain: settings.feed.serviceDomain, apiKey: settings.feed.apiKey });
    const promises = settings.feed.endpoints.map(async endpoint => {
        try {
            const res = await client.getAllContents({ endpoint });
            const saveImagePromises = res.map(async content => {
                const thumbnail = content["thumbnail"]["url"];
                await saveImage(thumbnail, assetsPath);
            });
            await Promise.all(saveImagePromises);

            await fs.writeFile(`${buildPath}/${endpoint}.json`, JSON.stringify(res));
        } catch (err) {
            console.error(err);
        }
    });

    return Promise.all(promises);
}

async function affiliate() {
    const client = createClient({ serviceDomain: settings.affiliate.serviceDomain, apiKey: settings.affiliate.apiKey });
    const promises = settings.affiliate.endpoints.map(async endpoint => {
        try {
            const res = await client.getAllContents({ endpoint });
            const saveImagePromises = res.map(async content => {
                const thumbnail = content["icon"]["url"];
                await saveImage(thumbnail, assetsPath);
            });
            await Promise.all(saveImagePromises);

            await fs.writeFile(`${buildPath}/${endpoint}.json`, JSON.stringify(res));
        } catch (err) {
            console.error(err);
        }
    });

    return Promise.all(promises);
}

async function saveImage(url, destPath) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTPエラー: ${response.status}`);
        }

        const fileStream = fsd.createWriteStream(path.join(destPath, path.basename(url)));

        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);

            response.body.on('end', () => {
                resolve();
            });

            response.body.on('error', (err) => {
                reject(err);
            });
        });
    } catch (err) {
        console.error(err);
    }
}

async function optimizeImage(importDir, exportDir) {
    try {
        const files = await fs.readdir(importDir);

        for (const file of files) {
            const imagePath = path.join(importDir, file);

            if (imagePath.endsWith('.svg')) {
                console.log(`Skipping SVG file: ${imagePath}`);
                continue;
            }

            await sharp(imagePath)
                .resize({
                    width: 200,
                    height: 200,
                    fit: 'outside',
                })
                .webp({
                    quality: 50,
                })
                .toFile(`${exportDir}/${path.basename(imagePath, path.extname(imagePath))}.webp`);

            await sharp(imagePath)
                .resize({
                    width: 200,
                    height: 200,
                    fit: 'outside',
                })
                .avif({
                    quality: 50,
                })
                .toFile(`${exportDir}/${path.basename(imagePath, path.extname(imagePath))}.avif`);
        }
    } catch (err) {
        console.error(err);
    }
}
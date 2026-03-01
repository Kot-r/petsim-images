const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(__dirname, 'images');

async function download(url, name) {
    const p = path.join(IMAGE_DIR, name);
    if (await fs.pathExists(p)) return;
    const res = await axios({ url, method: 'GET', responseType: 'stream' }).catch(() => null);
    if (!res) return;
    const w = fs.createWriteStream(p);
    res.data.pipe(w);
    return new Promise((resolve) => { w.on('finish', resolve); w.on('error', resolve); });
}

async function run() {
    await fs.ensureDir(IMAGE_DIR);
    for (const g of GAMES) {
        const { data } = await axios.get(`https://${g}.biggamesapi.io/api/collection/Pets`);
        for (const p of data.data) {
            const ids = [
                p.configData.thumbnail?.split('://')[1],
                p.configData.goldenThumbnail?.split('://')[1]
            ].filter(Boolean);

            for (const id of ids) {
                await download(`https://${g}.biggamesapi.io/image/${id}`, `${id}.png`);
            }
        }
    }
}

run();

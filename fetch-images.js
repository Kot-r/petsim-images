const https = require('https');
const fs = require('fs');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(process.cwd(), 'images');
const SLEEP = (ms) => new Promise(res => setTimeout(res, ms));

const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

const extractId = (val) => {
    if (!val || val === 0 || val === "0") return null;
    let str = String(val).trim();
    const match = str.match(/rbxasset(?:id)?:\/\/(\d+)/i);
    if (match) return match[1];
    return null;
};

const findAllAssetIds = (obj) => {
    const ids = new Set();
    function traverse(o, key = null) {
        if (o == null) return;

        if (key === 'Sounds') {
            return;
        }

        if (typeof o === 'object') {
            if (Array.isArray(o)) {
                o.forEach(item => traverse(item));
            } else {
                Object.entries(o).forEach(([k, v]) => traverse(v, k));
            }
        } else if (typeof o === 'string' || typeof o === 'number') {
            const id = extractId(o);
            if (id) ids.add(id);
        }
    }
    traverse(obj);
    return Array.from(ids);
};

const get = (url) => new Promise((res, rej) => {
    https.get(url, (r) => {
        if ([301, 302].includes(r.statusCode)) return get(r.headers.location).then(res).catch(rej);
        let d = '';
        r.on('data', (c) => d += c);
        r.on('end', () => {
            try { res(JSON.parse(d)); } catch { res(null); }
        });
    }).on('error', rej);
});

const download = (url, p) => new Promise((res) => {
    if (fs.existsSync(p)) return res(true);
    https.get(url, (r) => {
        if (r.statusCode !== 200) return res(false);
        const w = fs.createWriteStream(p);
        r.pipe(w);
        w.on('finish', () => { w.close(); res(true); });
    }).on('error', () => res(false));
});

async function run() {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

    for (const g of GAMES) {
        console.log(`\n--- Game: ${g.toUpperCase()} ---`);

        console.log(`Fetching collections list for ${g.toUpperCase()}...`);
        const collectionsData = await get(`https://${g}.biggamesapi.io/api/collections`);
        await SLEEP(1000);

        if (!collectionsData || !Array.isArray(collectionsData.data)) {
            console.error(`Could not fetch collections for ${g.toUpperCase()} or data format is unexpected. Skipping.`);
            continue;
        }

        const COLLECTIONS = collectionsData.data

        for (const collName of COLLECTIONS) {
            console.log(`Fetching: ${collName}...`);
            const data = await get(`https://${g}.biggamesapi.io/api/collection/${collName}`);
            await SLEEP(1000);

            if (!data?.data) {
                console.warn(`No data found for collection: ${collName}. Skipping.`);
                continue;
            }

            for (const item of data.data) {
                const config = item.configData;
                if (!config) continue;

                const ids = findAllAssetIds(config);

                for (const id of ids) {
                    const pathFile = path.join(IMAGE_DIR, `${id}.png`);
                    if (fs.existsSync(pathFile)) continue;

                    let success = false;

                    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                        const ok = await download(`https://${g}.biggamesapi.io/image/${id}`, pathFile);
                        
                        if (ok) {
                            console.log(`[${collName}] Saved: ${id}.png`);
                            success = true;
                            break; 
                        } else {
                            if (attempt < MAX_RETRIES) {
                                console.warn(`[${collName}] Fail ${attempt}/${MAX_RETRIES} for ${id}. Retrying...`);
                                await SLEEP(RETRY_DELAY);
                            } else {
                                console.error(`[${collName}] Final failure for ${id}. Skipping.`);
                            }
                        }
                    }
                    await SLEEP(750); 
                }
            }
        }
    }
    console.log("\n✅ Done.");
}

run();

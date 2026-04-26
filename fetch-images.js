const https = require('https');
const fs = require('fs');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(process.cwd(), 'images');
const DB_FILE = path.join(process.cwd(), 'sizes.json'); // База размеров
const SLEEP = (ms) => new Promise(res => setTimeout(res, ms));

const RATE_LIMIT_DELAY = 650; 
let lastReqTime = 0;

let sizeDb = {};
if (fs.existsSync(DB_FILE)) {
    try { sizeDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { sizeDb = {}; }
}

async function throttle() {
    const now = Date.now();
    const diff = now - lastReqTime;
    if (diff < RATE_LIMIT_DELAY) await SLEEP(RATE_LIMIT_DELAY - diff);
    lastReqTime = Date.now();
}

const extractId = (val) => {
    if (!val || val === 0 || val === "0") return null;
    let str = String(val).trim();
    const match = str.match(/rbxasset(?:id)?:\/\/(\d+)/i);
    return match ? match[1] : null;
};

const findAllAssetIds = (obj) => {
    const ids = new Set();
    function traverse(o, key = null) {
        if (o == null || key === 'Sounds') return;
        if (typeof o === 'object') {
            if (Array.isArray(o)) o.forEach(item => traverse(item));
            else Object.entries(o).forEach(([k, v]) => traverse(v, k));
        } else if (typeof o === 'string' || typeof o === 'number') {
            const id = extractId(o);
            if (id) ids.add(id);
        }
    }
    traverse(obj);
    return Array.from(ids);
};

const getJSON = async (url) => {
    await throttle();
    return new Promise((res, rej) => {
        https.get(url, (r) => {
            let d = '';
            r.on('data', (c) => d += c);
            r.on('end', () => { try { res(JSON.parse(d)); } catch { res(null); } });
        }).on('error', rej);
    });
};

const smartDownload = async (id, p) => {
    const localExists = fs.existsSync(p);
    const localSize = localExists ? fs.statSync(p).size : 0;

    if (localExists && localSize > 0 && sizeDb[id] === localSize) {
        return 'skipped';
    }
    await throttle();
    return new Promise((res) => {
        const url = `https://ps99.biggamesapi.io/image/${id}`;
        const req = https.get(url, (r) => {
            if (r.statusCode !== 200) { r.resume(); return res(false); }

            const remoteSize = parseInt(r.headers['content-length'], 10);
            
            if (localExists && remoteSize === localSize) {
                sizeDb[id] = remoteSize;
                r.destroy();
                return res('updated_db');
            }

            const w = fs.createWriteStream(p);
            r.pipe(w);
            w.on('finish', () => {
                w.close();
                sizeDb[id] = remoteSize;
                res('downloaded');
            });
        });
        req.on('error', () => res(false));
    });
};

async function run() {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

    for (const g of GAMES) {
        console.log(`\n--- Game: ${g.toUpperCase()} ---`);
        const collectionsData = await getJSON(`https://${g}.biggamesapi.io/api/collections`);
        if (!collectionsData?.data) continue;

        for (const collName of collectionsData.data) {
            if (collName === 'Zones') continue;
            const data = await getJSON(`https://${g}.biggamesapi.io/api/collection/${collName}`);
            if (!data?.data) continue;

            const allIds = Array.from(new Set(data.data.flatMap(item => findAllAssetIds(item.configData))));
            console.log(`Processing ${collName} (${allIds.length} items)...`);

            for (const id of allIds) {
                const status = await smartDownload(id, path.join(IMAGE_DIR, `${id}.png`));
                if (status === 'downloaded') console.log(`  [+] New/Updated: ${id}.png`);
            }
        }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(sizeDb, null, 2));
    console.log("\n✅ Done. Database updated.");
}

run();

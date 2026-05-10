const https = require('https');
const fs = require('fs');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(process.cwd(), 'images');
const PLACEHOLDER_FILE = 'placeholder_size.txt';
const SLEEP = (ms) => new Promise(res => setTimeout(res, ms));

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const getPlaceholderSize = () => {
    try {
        if (fs.existsSync(PLACEHOLDER_FILE)) {
            const content = fs.readFileSync(PLACEHOLDER_FILE, 'utf8').trim();
            const size = Number(content); 
            if (!isNaN(size) && size > 0) return size;
        }
    } catch (e) {
        console.error("Error reading placeholder_size.txt:", e.message);
    }
    return null;
};

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
        if (key === 'Sounds') return;
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
    https.get(url, (r) => {
        if ([301, 302].includes(r.statusCode)) return download(r.headers.location, p).then(res);
        if (r.statusCode !== 200) return res(false);
        
        const w = fs.createWriteStream(p);
        r.pipe(w);
        w.on('finish', () => {
            w.close();
            setTimeout(() => res(true), 50); 
        });
    }).on('error', () => res(false));
});

async function run() {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

    const placeholderSize = getPlaceholderSize();
    if (placeholderSize !== null) {
        console.log(`[System] Excluding images with exact size: ${placeholderSize} bytes.`);
    } else {
        console.warn(`[System] No valid placeholder_size.txt found. Proceeding without exclusion.`);
    }

    for (const g of GAMES) {
        console.log(`\n--- Game: ${g.toUpperCase()} ---`);
        const collectionsData = await get(`https://${g}.biggamesapi.io/api/collections`);
        await SLEEP(1000);

        if (!collectionsData?.data) continue;

        for (const collName of collectionsData.data) {
            if (collName === 'Zones') continue;
            
            console.log(`Fetching: ${collName}...`);
            const data = await get(`https://${g}.biggamesapi.io/api/collection/${collName}`);
            await SLEEP(1000);

            if (!data?.data) continue;

            for (const item of data.data) {
                const ids = findAllAssetIds(item.configData);

                for (const id of ids) {
                    const pathFile = path.join(IMAGE_DIR, `${id}.png`);

                    if (fs.existsSync(pathFile)) {
                        const stats = fs.statSync(pathFile);
                        if (placeholderSize !== null && stats.size === placeholderSize) {
                            console.log(`[Purge] Found placeholder: ${id}.png (${stats.size} bytes). Deleting.`);
                            fs.unlinkSync(pathFile);
                        } else {
                            continue; // Valid file already exists, skip
                        }
                    }

                    let success = false;
                    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                        // The magic happens right here: ?v=Timestamp
                        const cacheBuster = `?v=${Date.now()}`;
                        const ok = await download(`https://${g}.biggamesapi.io/image/${id}${cacheBuster}`, pathFile);
                        
                        if (ok) {
                            const stats = fs.statSync(pathFile);
                            if (placeholderSize !== null && stats.size === placeholderSize) {
                                console.warn(`[!] API still serving placeholder for ${id} (${stats.size}b). Removing.`);
                                fs.unlinkSync(pathFile);
                                break; 
                            }

                            console.log(`[${collName}] Saved: ${id}.png (Size: ${stats.size}b)`);
                            success = true;
                            break; 
                        } else {
                            await SLEEP(RETRY_DELAY);
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

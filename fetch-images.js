const https = require('https');
const fs = require('fs');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(process.cwd(), 'images');
const SLEEP = (ms) => new Promise(res => setTimeout(res, ms));

const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

const COLLECTIONS = [
    'Boosts', 'Boxes', 'Charms', 'Currency', 'Eggs', 'Enchants', 'FishingRods',
    'Fruits', 'Hoverboards', 'Lootboxes', 'Mastery', 'MiscItems', 'Pets', 'Potions',
    'Seeds', 'Shovels', 'Sprinklers', 'Ultimates', 'Upgrades', 'WateringCans', 'XPPotions'
];

const IMAGE_FIELDS = {
    'Boosts': ['Icon'], 'Boxes': [], 'Charms': ['Icon'], 'Currency': ['orbImage', 'imageOutline', 'tinyImage'],
    'Eggs': ['icon'], 'Enchants': ['Icon', 'PageIcon'], 'FishingRods': ['Icon'], 'Fruits': ['Icon', 'ShinyIcon'],
    'Hoverboards': ['Icon'], 'Lootboxes': ['Icon'], 'Mastery': ['Icon'], 'MiscItems': ['Icon', 'AltIcon'],
    'Pets': ['thumbnail', 'goldenThumbnail'], 'Potions': [], 'Seeds': ['Icon'], 'Shovels': ['Icon'],
    'Sprinklers': ['Icon'], 'Ultimates': ['Icon'], 'Upgrades': ['Icon', 'orbImage', 'imageOutline', 'tinyImage'],
    'WateringCans': ['Icon'], 'XPPotions': ['Icon']
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

const extractId = (val) => {
    if (!val || val === 0 || val === "0") return null;
    let str = String(val);
    return str.includes('://') ? str.split('://')[1] : str;
};

async function run() {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

    for (const g of GAMES) {
        console.log(`\n--- Game: ${g.toUpperCase()} ---`);
        
        for (const collName of COLLECTIONS) {
            console.log(`Fetching: ${collName}...`);
            const data = await get(`https://${g}.biggamesapi.io/api/collection/${collName}`);
            await SLEEP(1000);

            if (!data?.data) continue;

            for (const item of data.data) {
                const config = item.configData;
                if (!config) continue;

                let potentialIds = [];
                const fields = IMAGE_FIELDS[collName] || [];
                fields.forEach(f => potentialIds.push(extractId(config[f])));

                if (collName === 'Boxes' && config.Icons) {
                    config.Icons.forEach(ico => potentialIds.push(extractId(ico.Icon)));
                } else if (collName === 'Potions' && config.Tiers) {
                    config.Tiers.forEach(t => potentialIds.push(extractId(t.Icon)));
                } else if (['Currency', 'Upgrades'].includes(collName) && config.BagTiers) {
                    config.BagTiers.forEach(t => potentialIds.push(extractId(t.image)));
                }

                const ids = [...new Set(potentialIds.filter(Boolean))];

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

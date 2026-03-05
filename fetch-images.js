const https = require('https');
const fs = require('fs');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(process.cwd(), 'images');
const SLEEP = (ms) => new Promise(res => setTimeout(res, ms));

const COLLECTIONS = [
    'Boosts', 'Boxes', 'Charms', 'Currency', 'Eggs', 'Enchants', 'FishingRods',
    'Fruits', 'Hoverboards', 'Lootboxes', 'Mastery', 'MiscItems', 'Pets', 'Potions',
    'Seeds', 'Shovels', 'Sprinklers', 'Ultimates', 'Upgrades', 'WateringCans', 'XPPotions'
];

const IMAGE_FIELDS = {
    'Boosts': ['Icon'],
    'Boxes': [], // handled specially
    'Charms': ['Icon'],
    'Currency': ['orbImage', 'imageOutline', 'tinyImage'],
    'Eggs': ['icon'],
    'Enchants': ['Icon', 'PageIcon'],
    'FishingRods': ['Icon'],
    'Fruits': ['Icon', 'ShinyIcon'],
    'Hoverboards': ['Icon'],
    'Lootboxes': ['Icon'],
    'Mastery': ['Icon'],
    'MiscItems': ['Icon', 'AltIcon'],
    'Pets': ['thumbnail', 'goldenThumbnail'],
    'Potions': [], // handled specially
    'Seeds': ['Icon'],
    'Shovels': ['Icon'],
    'Sprinklers': ['Icon'],
    'Ultimates': ['Icon'],
    'Upgrades': ['Icon', 'orbImage', 'imageOutline', 'tinyImage'],
    'WateringCans': ['Icon'],
    'XPPotions': ['Icon']
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
    if (fs.existsSync(p)) return res(false);
    https.get(url, (r) => {
        if (r.statusCode !== 200) return res(false);
        const w = fs.createWriteStream(p);
        r.pipe(w);
        w.on('finish', () => { w.close(); res(true); });
    }).on('error', () => res(false));
});

const extractId = (str) => {
    if (!str || typeof str !== 'string') return null;
    return str.includes('://') ? str.split('://')[1] : str;
};

async function run() {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

    for (const g of GAMES) {
        console.log(`\n--- Processing Game: ${g.toUpperCase()} ---`);
        
        for (const collName of COLLECTIONS) {
            console.log(`Fetching collection: ${collName}...`);
            const data = await get(`https://${g}.biggamesapi.io/api/collection/${collName}`);
            await SLEEP(700);

            if (!data?.data) {
                console.warn(`No data found for collection: ${collName}`);
                continue;
            }

            for (const item of data.data) {
                const config = item.configData;
                if (!config) continue;

                let potentialIds = [];

                // Standard fields
                const fields = IMAGE_FIELDS[collName] || [];
                for (const field of fields) {
                    const val = config[field];
                    if (val) potentialIds.push(extractId(val));
                }

                // Special nested logic
                if (collName === 'Boxes') {
                    const iconsArr = config.Icons || [];
                    for (const ico of iconsArr) {
                        if (ico.Icon) potentialIds.push(extractId(ico.Icon));
                    }
                } else if (collName === 'Potions') {
                    const tiers = config.Tiers || [];
                    for (const tier of tiers) {
                        if (tier.Icon) potentialIds.push(extractId(tier.Icon));
                    }
                } else if (['Currency', 'Upgrades'].includes(collName)) {
                    const bagTiers = config.BagTiers || [];
                    for (const tier of bagTiers) {
                        if (tier.image) potentialIds.push(extractId(tier.image));
                    }
                }

                const ids = [...new Set(potentialIds.filter(Boolean))];

                for (const id of ids) {
                    const pathFile = path.join(IMAGE_DIR, `${id}.png`);
                    if (fs.existsSync(pathFile)) continue;

                    const ok = await download(`https://${g}.biggamesapi.io/image/${id}`, pathFile);
                    if (ok) {
                        console.log(`[${collName}] Downloaded: ${id}.png`);
                        await SLEEP(650);
                    } else {
                        console.log(`[${collName}] Failed to download: ${id}`);
                    }
                }
            }
        }
    }
    console.log("\n✅ Finished!.");
}

run();

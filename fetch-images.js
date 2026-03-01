const fs = require('fs');
const path = require('path');

const GAMES = [
    { name: 'ps99', api: 'https://ps99.biggamesapi.io' },
    { name: 'petsgo', api: 'https://petsgo.biggamesapi.io' }
];

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function saveImage(gameApi, imageId, folder, filename) {
    if (!imageId || imageId === "") return;
    
    const filePath = path.join(__dirname, 'public/images', folder, filename);
    if (fs.existsSync(filePath)) return;

    const imageUrl = `${gameApi}/image/${imageId}`; 
    
    try {
        const res = await fetch(imageUrl);
        if (!res.ok) return;
        
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        console.log(`Saved ${filename} from ID: ${imageId}`);
      
        await sleep(800); 
    } catch (e) { console.error(`Error on ID ${imageId}:`, e.message); }
}

async function run() {
    for (const game of GAMES) {
        console.log(`Syncing ${game.name}...`);
        const res = await fetch(`${game.api}/api/collection/Pets`);
        const { data } = await res.json();

        const dir = path.join(__dirname, 'public/images', game.name);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        for (const pet of data) {
            const petName = pet.configData.id.replace(/\s+/g, '_');
          
            await saveImage(game.api, pet.configData.thumbnail, game.name, `${petName}.png`);
            await saveImage(game.api, pet.configData.goldenThumbnail, game.name, `${petName}_golden.png`);
        }
    }
}

run();

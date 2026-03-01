// Note: this is ai, ignore if the code is trash pls
const https = require('https');
const fs = require('fs');
const path = require('path');

const GAMES = ['ps99', 'petsgo'];
const IMAGE_DIR = path.join(__dirname, 'images');
const SLEEP = (ms) => new Promise(res => setTimeout(res, ms));

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

const download = (url, p) => new Promise((res, rej) => {
    if (fs.existsSync(p)) return res(false); // Пропускаем скачивание, если файл уже есть
    https.get(url, (r) => {
        if (r.statusCode !== 200) {
            console.warn(`Не удалось скачать: ${url} (статус: ${r.statusCode})`);
            return res(false); // Не удалось скачать файл
        }
        const w = fs.createWriteStream(p);
        r.pipe(w);
        w.on('finish', () => { w.close(); res(true); });
    }).on('error', (err) => {
        console.error(`Ошибка при скачивании файла: ${url}`, err);
        res(false);
    });
});

async function run() {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR);

    for (const g of GAMES) {
        const data = await get(`https://${g}.biggamesapi.io/api/collection/Pets`);
        await SLEEP(650);  // Задержка для предотвращения превышения лимита запросов API

        if (!data?.data) continue;

        for (const p of data.data) {
            const ids = [
                p.configData?.thumbnail?.split('://')[1],
                p.configData?.goldenThumbnail?.split('://')[1]
            ].filter(Boolean);

            for (const id of ids) {
                const pathFile = path.join(IMAGE_DIR, `${id}.png`);
                if (fs.existsSync(pathFile)) continue; // Если файл уже существует, пропускаем его

                const ok = await download(`https://${g}.biggamesapi.io/image/${id}`, pathFile);
                if (ok) {
                    console.log(`Скачано: ${pathFile}`);
                    await SLEEP(650);  // Задержка после каждого скачивания
                } else {
                    console.log(`Не удалось скачать: ${id}`);
                }
            }
        }
    }
}

run();

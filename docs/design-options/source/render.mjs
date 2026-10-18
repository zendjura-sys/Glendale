import fs from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

// node render.mjs <out dir> <variant module>...
const [out, ...mods] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const mod of mods) {
    const name = mod.replace(/^.*\//, '').replace(/\.mjs$/, '');
    const html = (await import(mod)).default;
    const file = `${out}/${name}.html`;
    fs.writeFileSync(file, html);
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto('file://' + file);
    await page.evaluate(() => document.fonts.ready);
    for (const id of await page.$$eval('.frame', (els) => els.map((e) => e.id))) {
        await page.locator('#' + id).screenshot({ path: `${out}/${name}--${id}.png` });
    }
    await page.close();
    console.log('ok', name);
}
await browser.close();

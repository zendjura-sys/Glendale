// Перевірка після деплою в справжньому браузері: сторінка не порожня й без помилок JavaScript.
// curl бачить лише HTML з кодом 200 — а зламаний React дає порожній екран при тому самому 200.
//
//   node deploy/smoke.mjs <каталог з playwright-core> <шлях до headless_shell> <адреса> [адреса…]
import { createRequire } from 'node:module';
import path from 'node:path';

const [, , dir, executablePath, ...urls] = process.argv;
const { chromium } = createRequire(path.join(dir, 'package.json'))(
    'playwright-core',
);

const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox'],
});
let failed = 0;

for (const url of urls) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) =>
        errors.push(String(error.message || error)),
    );
    page.on('response', (response) => {
        if (response.status() >= 400 && response.url().includes('/build/')) {
            errors.push(`${response.status()} ${response.url()}`);
        }
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1000);
    } catch (error) {
        errors.push(String(error.message || error));
    }
    const text = await page
        .evaluate(() => document.querySelector('#app')?.innerText?.trim() ?? '')
        .catch(() => '');
    if (!text) errors.push('сторінка порожня (#app без тексту)');

    if (errors.length) {
        failed++;
        console.log(`✗ ${url}`);
        for (const error of errors.slice(0, 5))
            console.log(`    ${error.slice(0, 300)}`);
    } else {
        console.log(`✓ ${url}`);
    }
    await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);

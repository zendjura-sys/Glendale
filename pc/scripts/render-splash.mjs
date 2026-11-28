// Рендер заставки установника: build/splash/splash.html → build/installer-splash.gif (440×300, 30 fps).
// Кадри знімає Playwright (draw(t) детермінований, тож петля без шва), GIF збирає FFmpeg у два
// проходи: palettegen (палітра з усіх кадрів) + paletteuse з дизерингом — без смуг на темних градієнтах.
// Запуск: npm run splash  (потрібні Playwright із Chromium і ffmpeg-static).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = require('playwright');
const ffmpeg = require('ffmpeg-static');

const FPS = 30;
const out = join(root, 'build', 'installer-splash.gif');
const frames = mkdtempSync(join(tmpdir(), 'gc-splash-'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 300 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(root, 'build', 'splash', 'splash.html')).href);
await page.evaluate(() => window.ready);
const period = await page.evaluate(() => window.PERIOD);
const total = Math.round(period * FPS);
for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.draw(t), i / FPS);
    await page.locator('#c').screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`) });
}
await browser.close();

const run = (args) => {
    const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg завершився з кодом ${r.status}`);
};
const input = ['-framerate', String(FPS), '-i', join(frames, 'f%04d.png')];
const palette = join(frames, 'palette.png');
run([...input, '-vf', 'palettegen=max_colors=256:stats_mode=full:reserve_transparent=0', palette]);
run([...input, '-i', palette, '-lavfi', 'paletteuse=dither=sierra2_4a:diff_mode=rectangle', '-loop', '0', out]);
rmSync(frames, { recursive: true, force: true });
console.log(`installer-splash.gif: ${total} кадрів, ${FPS} fps → ${out}`);

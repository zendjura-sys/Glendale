/**
 * Smoke: профіль не показує ErrorBoundary і підвантажує deferred-блоки.
 * Запуск: node scripts/smoke-profile.mjs [url]
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'https://gamecon.online/sheilafloyd.34443';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
// Deferred partials доїжджають після першого кадру.
await page.waitForTimeout(4000);

const crash = await page.getByText('Щось пішло не так').count();
const title = await page.title();
const body = await page.locator('body').innerText();

console.log(
    JSON.stringify(
        {
            url,
            title,
            crashCards: crash,
            pageErrors: errors.slice(0, 20),
            hasWallHint:
                body.includes('На стіні') ||
                body.includes('Записи') ||
                body.includes('Друзі'),
        },
        null,
        2,
    ),
);

await browser.close();
process.exit(crash > 0 || errors.some((e) => /TypeError|Cannot read/i.test(e))
    ? 1
    : 0);

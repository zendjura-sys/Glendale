/**
 * Скриншоти для довідки (/help): знімає справжні сторінки сайту й міряє, де лежать кнопки,
 * щоб стаття показала номер-мітку прямо на потрібному місці.
 *
 * Запуск (локальний сервер із демо-даними): node scripts/help-shots.cjs [id ...]
 *   HELP_BASE=http://127.0.0.1:8123 HELP_EMAIL=… HELP_PASSWORD=…
 * Пише public/images/help/<id>.webp і resources/js/components/help/help-shots.ts
 * (розмір кадру й зони у відсотках). Тексти міток — у App\Support\Help\HelpCatalog (блок shot).
 */
const { chromium, devices } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.HELP_BASE || 'http://127.0.0.1:8123';
// Акаунт локального демо-сервера; паролі в репозиторій не кладемо.
const EMAIL = process.env.HELP_EMAIL;
const PASSWORD = process.env.HELP_PASSWORD;
if (!EMAIL || !PASSWORD) {
    console.error(
        'Вкажіть HELP_EMAIL і HELP_PASSWORD акаунта локального демо-сервера.',
    );
    process.exit(1);
}
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public/images/help');
const MANIFEST = path.join(ROOT, 'resources/js/components/help/help-shots.ts');

const PC = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PHONE = { ...devices['Pixel 7'], deviceScaleFactor: 2 };

// Фон «гри» під оверлеєм SDK: сам оверлей прозорий.
const SCENE = `html{background:
 radial-gradient(60% 45% at 75% 30%, rgba(255,170,80,.55), transparent 70%),
 radial-gradient(50% 40% at 20% 70%, rgba(60,140,255,.45), transparent 70%),
 linear-gradient(180deg,#2b3a55 0%,#3d4a5c 45%,#1d2430 46%,#11161d 100%) fixed !important}`;

/** Прибрати з кадру службові плашки демо-сервера. */
async function tidy(p) {
    await p.evaluate(() => {
        // Найширший невисокий блок, що починається з тексту плашки демо-сервера, — це вона сама.
        const banners = [...document.querySelectorAll('main *')].filter(
            (el) =>
                (el.textContent || '')
                    .trim()
                    .startsWith('Сповіщення приходять із затримкою') &&
                el.getBoundingClientRect().height < 80,
        );
        banners.sort(
            (a, b) =>
                b.getBoundingClientRect().width -
                a.getBoundingClientRect().width,
        );
        banners[0]?.remove();
        [...document.querySelectorAll('button')]
            .find((b) => b.textContent.includes('Лише обов'))
            ?.click();
        document
            .querySelectorAll('[data-sonner-toaster]')
            .forEach((el) => el.remove());
        // Демо-дані без картинок: биті значки не потрібні на скриншоті.
        document.querySelectorAll('img').forEach((img) => {
            if (img.complete && img.naturalWidth === 0) img.remove();
        });
    });
}

const app = (p) => p.locator('section', { hasText: 'Client ID' }).first();

/**
 * Кадри: id → сторінка, пристрій, підготовка й зони (назва → локатор).
 * @type {Array<{id: string, url: string, device: object, guest?: boolean, prepare?: (p: import('playwright').Page) => Promise<void>, clip?: (p: import('playwright').Page) => import('playwright').Locator, regions: Record<string, (p: import('playwright').Page) => import('playwright').Locator>}>}
 */
const SHOTS = [
    {
        id: 'home-pc',
        url: '/dashboard',
        device: PC,
        regions: {
            logo: (p) => p.locator('header a[href="/feed"]').first(),
            search: (p) =>
                p.locator('header input[placeholder^="Пошук"]').locator('..'),
            nav: (p) => p.locator('nav[aria-label="Головні розділи"]'),
            music: (p) =>
                p.locator('nav[aria-label="Головні розділи"] a').last(),
            gamecast: (p) => p.locator('header a[aria-label^="GameCast"]'),
            theme: (p) => p.locator('header button[aria-label*="тема"]'),
            whatsnew: (p) => p.locator('header button[aria-label="Що нового"]'),
            bell: (p) => p.locator('header button[aria-label^="Сповіщення"]'),
            avatar: (p) =>
                p.locator('header button[aria-label="Меню облікового запису"]'),
            profile: (p) => p.locator('aside section').first(),
            menu: (p) => p.locator('nav[aria-label="Розділи"]'),
            app: (p) => p.locator('aside a[href="/app"]').first(),
            stories: (p) =>
                p
                    .getByText('Момент', { exact: true })
                    .locator(
                        'xpath=ancestor::*[contains(@class,"gc-solid")][1]',
                    ),
            streak: (p) =>
                p
                    .locator('main section', {
                        has: p.locator('button[aria-label="Завдання дня"]'),
                    })
                    .first(),
            ready: (p) =>
                p
                    .locator('main button', { hasText: 'Я готовий грати' })
                    .first(),
            quests: (p) => p.locator('button[aria-label="Завдання дня"]'),
            composer: (p) => p.locator('section.gc-composer'),
            continue: (p) => p.locator('section[aria-label="Продовжити"]'),
            tabs: (p) => p.locator('nav[aria-label="Стрічка"]'),
            requests: (p) => p.locator('aside.gc-split-hide section').first(),
            widgets: (p) => p.locator('aside.gc-split-hide'),
        },
    },
    {
        id: 'home-phone',
        url: '/dashboard',
        device: PHONE,
        regions: {
            search: (p) =>
                p.locator('header input[placeholder^="Пошук"]').locator('..'),
            whatsnew: (p) => p.locator('header button[aria-label="Що нового"]'),
            bell: (p) => p.locator('header button[aria-label^="Сповіщення"]'),
            stories: (p) =>
                p
                    .getByText('Момент', { exact: true })
                    .locator(
                        'xpath=ancestor::*[contains(@class,"gc-solid")][1]',
                    ),
            streak: (p) =>
                p
                    .locator('main section', {
                        has: p.locator('button[aria-label="Завдання дня"]'),
                    })
                    .first(),
            composer: (p) => p.locator('section.gc-composer'),
            'tab-profile': (p) =>
                p.locator('.gc-vk-tabbar a, .gc-vk-tabbar button').nth(0),
            'tab-feed': (p) =>
                p.locator('.gc-vk-tabbar a, .gc-vk-tabbar button').nth(1),
            'tab-chat': (p) =>
                p.locator('.gc-vk-tabbar a, .gc-vk-tabbar button').nth(2),
            'tab-friends': (p) =>
                p.locator('.gc-vk-tabbar a, .gc-vk-tabbar button').nth(3),
            'tab-menu': (p) =>
                p.locator('.gc-vk-tabbar a, .gc-vk-tabbar button').nth(4),
        },
    },
    {
        id: 'post-pc',
        url: '/dashboard',
        device: PC,
        prepare: async (p) => {
            const post = p.locator('article').first();
            await post.scrollIntoViewIfNeeded();
            await p.evaluate(() => window.scrollBy(0, -120));
            await p.waitForTimeout(600);
        },
        clip: (p) => p.locator('article').first(),
        regions: {
            author: (p) =>
                p.locator('article').first().locator('a.font-semibold').first(),
            more: (p) =>
                p
                    .locator('article')
                    .first()
                    .locator('button:has(svg.lucide-ellipsis)')
                    .first(),
            actions: (p) =>
                p
                    .locator('article')
                    .first()
                    .locator('footer, [data-post-actions]')
                    .first(),
        },
    },
    {
        id: 'games-pc',
        url: '/games',
        device: PC,
        regions: {
            search: (p) =>
                p.getByRole('textbox', { name: 'Знайти гру' }).locator('..'),
            tools: (p) =>
                p.locator('nav[aria-label="Інструменти для гравців"]'),
            platform: (p) =>
                p.locator('[role="radiogroup"][aria-label="Платформа"]'),
            genre: (p) => p.locator('select[aria-label="Жанр"]'),
            sort: (p) => p.locator('select[aria-label="Сортування"]'),
            modes: (p) =>
                p.getByRole('button', { name: 'На двох' }).locator('..'),
            letters: (p) =>
                p.locator('[role="group"][aria-label="Перша літера назви"]'),
        },
    },
    {
        id: 'cinema-assist',
        url: '/cinema/sintel-2010',
        device: PC,
        prepare: async (p) => {
            const bar = p.locator('[data-player-assist]');
            await bar.locator('select').selectOption('30');
            await bar.scrollIntoViewIfNeeded();
            await p.waitForTimeout(800);
        },
        clip: (p) => p.locator('[data-player-assist]'),
        regions: {
            sleep: (p) => p.locator('[data-player-assist] label').first(),
        },
    },
    {
        id: 'dev-portal',
        url: '/developers',
        device: PC,
        regions: {
            new: (p) =>
                p.getByRole('button', { name: 'Новий застосунок' }).first(),
            sdk: (p) => p.getByRole('link', { name: 'Плагіни й SDK' }).first(),
            servers: (p) =>
                p.getByRole('link', { name: 'Для серверів GTA' }).first(),
            app: app,
            overlay: (p) => app(p).getByRole('button', { name: 'Оверлей' }),
            edit: (p) => app(p).getByRole('button', { name: 'Змінити' }),
            keys: (p) => app(p).getByText('Client ID').first(),
        },
    },
    {
        id: 'dev-keys',
        url: '/developers',
        device: PC,
        prepare: async (p) => {
            await app(p).scrollIntoViewIfNeeded();
            await p.waitForTimeout(400);
        },
        clip: app,
        regions: {
            client: (p) => app(p).getByText('Client ID').first().locator('..'),
            public: (p) =>
                app(p)
                    .getByText('Публічний ключ (можна в браузері)')
                    .first()
                    .locator('..'),
            bot: (p) => app(p).getByText('Токен бота').first().locator('../..'),
            token: (p) => app(p).getByRole('button', { name: 'Видати токен' }),
            redirects: (p) =>
                app(p)
                    .getByText(/Адреси повернення/)
                    .last(),
        },
    },
    {
        id: 'dev-new-app',
        url: '/developers',
        device: PC,
        prepare: async (p) => {
            await p
                .getByRole('button', { name: 'Новий застосунок' })
                .first()
                .click();
            await p.waitForTimeout(800);
            await p.locator('[data-app-form]').scrollIntoViewIfNeeded();
        },
        clip: (p) => p.locator('[data-app-form]'),
        regions: {
            name: (p) =>
                p
                    .locator('[data-app-form] label')
                    .filter({ hasText: /^Назва/ })
                    .first(),
            about: (p) =>
                p
                    .locator('[data-app-form]')
                    .getByText(/Опис \(бачать/)
                    .locator('..'),
            site: (p) =>
                p
                    .locator('[data-app-form] label')
                    .filter({ hasText: /^Сайт/ })
                    .first(),
            redirects: (p) =>
                p
                    .locator('[data-app-form]')
                    .getByText(/Адреси повернення \(redirect/)
                    .locator('..'),
            public: (p) =>
                p
                    .locator('[data-app-form]')
                    .getByText(/Публічний клієнт \(SPA/)
                    .locator('..'),
            scopes: (p) =>
                p
                    .locator('[data-app-form]')
                    .getByText(/Права, які застосунок/)
                    .locator('..'),
            save: (p) =>
                p
                    .locator('[data-app-form]')
                    .getByRole('button', { name: 'Створити' }),
        },
    },
    {
        id: 'dev-overlay',
        url: '/developers',
        device: PC,
        prepare: async (p) => {
            await app(p).getByRole('button', { name: 'Оверлей' }).click();
            await p.waitForTimeout(2500);
            await p
                .locator('[data-overlay-editor]')
                .first()
                .scrollIntoViewIfNeeded();
            await p.evaluate(() => {
                const el = document.querySelector('[data-overlay-editor]');
                window.scrollBy(0, el.getBoundingClientRect().top - 90);
            });
            await p.waitForTimeout(1500);
        },
        clip: (p) => p.locator('[data-overlay-editor]').first(),
        regions: {
            stage: (p) =>
                p.locator('[data-overlay-editor] [data-sdk-stage]').first(),
            look: (p) =>
                p
                    .locator('[data-overlay-editor]')
                    .getByRole('button', { name: 'Вигляд' })
                    .locator('..'),
        },
    },
    {
        id: 'dev-overlay-layout',
        url: '/developers',
        device: PC,
        prepare: async (p) => {
            await app(p).getByRole('button', { name: 'Оверлей' }).click();
            await p.waitForTimeout(2000);
            const group = p
                .locator('[data-overlay-editor]')
                .getByRole('button', { name: 'Розкладка' })
                .locator('..');
            await group.scrollIntoViewIfNeeded();
            await p.evaluate(() => window.scrollBy(0, -40));
            await p.waitForTimeout(800);
        },
        clip: (p) =>
            p
                .locator('[data-overlay-editor]')
                .getByRole('button', { name: 'Розкладка' })
                .locator('..'),
        regions: {
            sections: (p) =>
                p
                    .locator('[data-overlay-editor]')
                    .getByText('Розділи', { exact: true })
                    .locator('..'),
            corners: (p) => p.locator('[data-layout-board] > div').first(),
            tray: (p) => p.locator('[data-layout-board] > div').last(),
        },
    },
    {
        id: 'dev-overlay-publish',
        url: '/developers',
        device: PC,
        prepare: async (p) => {
            await app(p).getByRole('button', { name: 'Оверлей' }).click();
            await p.waitForTimeout(2000);
            await p.evaluate(() => {
                const el = document.querySelector('[data-overlay-actions]');
                window.scrollBy(
                    0,
                    el.getBoundingClientRect().bottom - window.innerHeight + 80,
                );
            });
            await p.waitForTimeout(800);
        },
        regions: {
            groups: (p) =>
                p.locator('[data-overlay-editor]').getByRole('button', {
                    name: 'Що гравцю дозволено міняти',
                }),
            items: (p) =>
                p
                    .locator('[data-overlay-editor]')
                    .getByRole('button', { name: 'Свої пункти в панелі' }),
            onboarding: (p) =>
                p
                    .locator('[data-overlay-editor]')
                    .getByRole('button', { name: 'Перший запуск і мова' }),
            draft: (p) =>
                p
                    .locator('[data-overlay-actions]')
                    .getByRole('button', { name: 'Зберегти чернетку' }),
            publish: (p) =>
                p
                    .locator('[data-overlay-actions]')
                    .getByRole('button', { name: 'Опублікувати' }),
        },
    },
    {
        id: 'dev-sdk',
        url: '/developers/sdk',
        device: PC,
        regions: {
            platforms: (p) => p.locator('[data-sdk="platforms"]').first(),
            sandbox: (p) => p.locator('[data-sdk="sandbox"]').first(),
            stage: (p) =>
                p.locator('[data-sdk="sandbox"] [data-sdk-stage]').first(),
        },
        prepare: async (p) => {
            await p
                .locator('[data-sdk="sandbox"]')
                .first()
                .scrollIntoViewIfNeeded();
            await p.evaluate(() => window.scrollBy(0, -260));
            await p.waitForTimeout(1500);
        },
    },
    {
        id: 'dev-sdk-code',
        url: '/developers/sdk',
        device: PC,
        prepare: async (p) => {
            await p
                .locator('[data-sdk="code"]')
                .first()
                .scrollIntoViewIfNeeded();
            await p.waitForTimeout(800);
        },
        clip: (p) => p.locator('[data-sdk="code"]').first(),
        regions: {
            tabs: (p) => p.locator('[data-sdk="code"] h2 + div').first(),
            code: (p) => p.locator('[data-sdk="code"] pre').first(),
            copy: (p) =>
                p
                    .locator(
                        '[data-sdk="code"] button[aria-label="Скопіювати"]',
                    )
                    .first(),
        },
    },
    {
        id: 'dev-sdk-settings',
        url: '/developers/sdk',
        device: PC,
        prepare: async (p) => {
            await p
                .locator('[data-sdk="settings"]')
                .first()
                .scrollIntoViewIfNeeded();
            await p.waitForTimeout(2500);
        },
        clip: (p) => p.locator('[data-sdk="settings"]').first(),
        regions: {
            code: (p) => p.locator('[data-sdk="settings"] pre').first(),
            toggle: (p) =>
                p
                    .locator('[data-sdk="settings"] .gamecon-settings .row')
                    .first(),
            account: (p) =>
                p
                    .locator('[data-sdk="settings"] .gamecon-settings .row')
                    .nth(1),
        },
    },
    {
        id: 'dev-plugins',
        url: '/developers/plugins',
        device: PC,
        regions: {
            filters: (p) => p.locator('[data-plugins="filters"]').first(),
            card: (p) => p.locator('[data-plugins="card"]').first(),
        },
    },
    {
        id: 'sdk-overlay',
        url: '/embed/overlay?demo=1&modules=hud,party,family,chat,drop',
        device: PC,
        prepare: async (p) => {
            await p.addStyleTag({ content: SCENE });
            await p.waitForTimeout(1500);
            await p.locator('.gc-sdk-drop').click();
            await p.waitForTimeout(1200);
        },
        regions: {
            drop: (p) => p.locator('.gc-sdk-drop'),
            panel: (p) => p.locator('.gc-sdk-panel'),
            tabs: (p) => p.locator('.gc-sdk-tabs'),
            stack: (p) => p.locator('.gc-sdk-stack').first(),
        },
    },
    {
        id: 'sdk-launcher',
        url: '/embed/launcher?demo=1',
        device: PC,
        prepare: async (p) => {
            await p.addStyleTag({ content: SCENE });
            await p.waitForTimeout(1800);
        },
        regions: {
            nav: (p) => p.locator('.gc-sdk-launcher-nav'),
            main: (p) => p.locator('.gc-sdk-launcher-main'),
            me: (p) => p.locator('.gc-sdk-me').first(),
        },
    },
    {
        id: 'link',
        url: '/link',
        device: PC,
        regions: {
            code: (p) => p.locator('input').first(),
            submit: (p) =>
                p
                    .getByRole('button')
                    .filter({ hasText: /Далі|Продовжити|Підтвердити/ })
                    .first(),
        },
    },
    {
        id: 'connected-apps',
        url: '/settings/connected-apps',
        device: PC,
        regions: {
            app: (p) =>
                p
                    .locator('main section, main li')
                    .filter({ has: p.getByRole('switch') })
                    .first(),
            overlay: (p) =>
                p
                    .getByRole('switch', { name: 'Оверлей GameCon у цій грі' })
                    .first(),
            revoke: (p) =>
                p
                    .getByRole('button', {
                        name: /Відключити|Від’єднати|Відкликати/,
                    })
                    .first(),
        },
    },
    {
        id: 'overlay-companion',
        url: '/settings/connected-apps',
        device: PC,
        prepare: async (p) => {
            // Демо-гравець міг вимкнути оверлей — для кадру вмикаємо.
            const toggle = p
                .getByRole('switch', { name: 'Оверлей GameCon у цій грі' })
                .first();
            if ((await toggle.getAttribute('aria-checked')) !== 'true') {
                await toggle.click();
                await p.waitForTimeout(1500);
            }
            await p
                .getByRole('button', { name: 'Налаштувати' })
                .first()
                .click();
            await p.waitForTimeout(1500);
        },
        clip: (p) => p.locator('[data-overlay-row]').first(),
        regions: {
            preset: (p) =>
                p
                    .locator('[data-overlay-companion] [role="radiogroup"]')
                    .first(),
            layout: (p) =>
                p
                    .locator('[data-overlay-companion] [role="radiogroup"]')
                    .nth(1),
            density: (p) =>
                p.locator('[data-overlay-companion] input[type="range"]'),
            streamer: (p) => p.getByRole('switch', { name: 'Режим стрімера' }),
            reset: (p) =>
                p.getByRole('button', { name: 'Скинути до вигляду гри' }),
        },
    },
];

/** Входимо один раз і ділимо сесію між кадрами (вхід має ліміт спроб). */
async function login(browser) {
    const ctx = await browser.newContext(PC);
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.fill('input[name=email]', EMAIL);
    await p.fill('input[name=password]', PASSWORD);
    await p.press('input[name=password]', 'Enter');
    await p.waitForTimeout(2500);
    await p.evaluate(() => {
        [...document.querySelectorAll('button')]
            .find((b) => b.textContent.includes('Лише обов'))
            ?.click();
    });
    await p.waitForTimeout(500);
    const state = await ctx.storageState();
    await ctx.close();

    return state;
}

(async () => {
    const only = process.argv.slice(2);
    fs.mkdirSync(OUT, { recursive: true });
    const manifest = fs.existsSync(MANIFEST)
        ? // Файл міг пройти форматер (одинарні лапки) — читаємо як вираз JS, а не JSON.
          new Function(
              'return ' +
                  fs
                      .readFileSync(MANIFEST, 'utf8')
                      .replace(/^[^=]*= /s, '')
                      .replace(/;\s*export default[\s\S]*$/, ''),
          )()
        : {};
    const browser = await chromium.launch();
    const state = await login(browser);

    for (const shot of SHOTS) {
        if (only.length && !only.includes(shot.id)) continue;
        try {
            await capture(browser, state, shot, manifest);
            save(manifest);
        } catch (e) {
            console.error(`${shot.id}: ${e.message.split('\n')[0]}`);
        }
    }

    await browser.close();
})();

async function capture(browser, state, shot, manifest) {
    {
        const ctx = await browser.newContext({
            ...shot.device,
            colorScheme: 'dark',
            locale: 'uk-UA',
            reducedMotion: 'reduce',
            ...(shot.guest ? {} : { storageState: state }),
        });
        const p = await ctx.newPage();
        await p.goto(BASE + shot.url);
        await p.waitForTimeout(2500);
        await tidy(p);
        if (shot.prepare) await shot.prepare(p);

        // Фрагмент сторінки: плаваюча шапка сайту не повинна перекривати кадр.
        if (shot.clip) {
            await p.addStyleTag({
                content: '.app-header-wrapper{visibility:hidden !important}',
            });
        }
        const view = p.viewportSize();
        let clip = { x: 0, y: 0, width: view.width, height: view.height };
        if (shot.clip) {
            const box = await shot.clip(p).boundingBox();
            if (box) {
                const pad = 12;
                clip = {
                    x: Math.max(0, box.x - pad),
                    y: Math.max(0, box.y - pad),
                    width: Math.min(view.width, box.width + pad * 2),
                    height: Math.min(
                        view.height - Math.max(0, box.y - pad),
                        box.height + pad * 2,
                    ),
                };
            }
        }

        const regions = {};
        for (const [name, find] of Object.entries(shot.regions)) {
            const box = await find(p)
                .boundingBox({ timeout: 1500 })
                .catch(() => null);
            if (!box) {
                console.warn(`  ${shot.id}: зону «${name}» не знайдено`);
                continue;
            }
            const x1 = Math.max(box.x, clip.x);
            const y1 = Math.max(box.y, clip.y);
            const x2 = Math.min(box.x + box.width, clip.x + clip.width);
            const y2 = Math.min(box.y + box.height, clip.y + clip.height);
            if (x2 - x1 < 4 || y2 - y1 < 4) {
                console.warn(`  ${shot.id}: зона «${name}» поза кадром`);
                continue;
            }
            const pct = (v) => Math.round(v * 1000) / 10;
            regions[name] = {
                x: pct((x1 - clip.x) / clip.width),
                y: pct((y1 - clip.y) / clip.height),
                w: pct((x2 - x1) / clip.width),
                h: pct((y2 - y1) / clip.height),
            };
        }

        const png = path.join(OUT, `${shot.id}.png`);
        await p.screenshot({ path: png, clip });
        const webp = path.join(OUT, `${shot.id}.webp`);
        const width = Math.round(
            clip.width * (shot.device.deviceScaleFactor || 1),
        );
        execFileSync('convert', [
            png,
            '-quality',
            '80',
            '-define',
            'webp:method=6',
            webp,
        ]);
        fs.unlinkSync(png);
        manifest[shot.id] = {
            src: `/images/help/${shot.id}.webp`,
            w: width,
            h: Math.round(clip.height * (shot.device.deviceScaleFactor || 1)),
            phone: shot.device === PHONE,
            regions,
        };
        console.log(
            `${shot.id}: ${Object.keys(regions).length}/${Object.keys(shot.regions).length} зон`,
        );
        await ctx.close();
    }
}

/** Маніфест кадрів для resources/js/components/help/help-shot.tsx. */
function save(manifest) {
    const sorted = Object.fromEntries(
        Object.keys(manifest)
            .sort()
            .map((k) => [k, manifest[k]]),
    );
    fs.writeFileSync(
        MANIFEST,
        '// Згенеровано scripts/help-shots.cjs — не редагувати вручну.\n' +
            "import type { HelpShotMeta } from '@/components/help/help-shot';\n\n" +
            'const HELP_SHOTS: Record<string, HelpShotMeta> = ' +
            JSON.stringify(sorted, null, 4) +
            ';\n\nexport default HELP_SHOTS;\n',
    );
}

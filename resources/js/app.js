import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createApp, h } from 'vue';
import { ZiggyVue } from '../../vendor/tightenco/ziggy';
import { reveal } from './directives/reveal';
import { glow } from './directives/glow';
import { parallax } from './directives/parallax';
import { magnetic } from './directives/magnetic';
import CommandPalette from './Components/CommandPalette.vue';
import PageTransition from './Components/PageTransition.vue';
import { startSmoothScroll, stopSmoothScroll, handleAnchorClick, resetScroll } from './lib/smoothScroll';
import { startCursor, stopCursor } from './lib/cursor';
import { startAuroraShader, stopAuroraShader } from './lib/auroraShader';
import { startSeasonalDecoration, stopSeasonalDecoration } from './lib/seasonalDecoration';

const appName = import.meta.env.VITE_APP_NAME || 'GameConnect';

/**
 * «Тяжёлые» украшения — инерционный скролл, кастомный курсор и шейдерный
 * фон — и каждое решает само, уместно ли оно здесь: см. lib/motion.js. На
 * телефоне остаётся то же, что и было, ПК получает полный набор.
 *
 * Кроме /admin: там это рабочий инструмент с таблицами и формами, а не
 * маркетинговая страница — WebGL-шейдер под ней только грузил GPU (видно
 * было по "GPU stall due to ReadPixels" в консоли) без единой причины,
 * а кастомный курсор и перехват скролла Lenis мешали бы работе со
 * списками. Стеклянная стилизация CSS в админке при этом остаётся как
 * была — тут выключается только JS-слой.
 *
 * Проверяется не только один раз при загрузке, а на каждый переход: это
 * SPA, и человек может уйти на /admin (или обратно) без перезагрузки
 * страницы — a значит, и включаться/выключаться decorations должны вместе
 * с ним, а не только при первом заходе.
 */
function syncDecorations() {
    // Сторінки в спільній оболонці (як соцмережа) — без курсора, шейдера й
    // Lenis: там свій спокійний фон-аврора, однаковий на всьому сайті.
    if (document.documentElement.dataset.shell || window.location.pathname.startsWith('/admin')) {
        stopSmoothScroll();
        stopCursor();
        stopAuroraShader();
        stopSeasonalDecoration();
        return;
    }

    startSmoothScroll();
    startCursor();
    startAuroraShader();

    const season = document.documentElement.dataset.season || 'none';
    if (season === 'none') {
        stopSeasonalDecoration();
    } else {
        startSeasonalDecoration(season);
    }
}

function startDecorations() {
    syncDecorations();

    // Якорные ссылки ведёт Lenis, иначе «Посади» в шапке прыгает мимо
    // всей плавности, ради которой он и ставился.
    document.addEventListener('click', handleAnchorClick);

    // Inertia меняет страницу без перезагрузки: браузер сам скролл
    // наверх не вернёт, и новая страница открывается с середины. Заодно
    // здесь же решаем, нужны ли decorations на странице, куда перешли.
    document.addEventListener('inertia:navigate', () => {
        syncDecorations();
        resetScroll();
    });
}

/**
 * Оболонка (шапка/меню) рендериться сервером під тип сторінки: звичайне
 * меню чи меню адмінки, а на вході/головній її немає зовсім. Перехід Inertia
 * через цю межу — повне завантаження, щоб оболонка відповідала сторінці.
 */
const shellMode = () => document.documentElement.dataset.shell || '';
const isAdminPath = (url) => new URL(url, window.location.origin).pathname.startsWith('/admin');
document.addEventListener('inertia:before', (event) => {
    const visit = event.detail.visit;
    if (!shellMode() || visit.method !== 'get') return;
    const url = visit.url.toString();
    if (isAdminPath(url) !== (shellMode() === 'admin')) {
        event.preventDefault();
        window.location.assign(url);
    }
});
// Перша подія — саме завантаження сторінки: її оболонку вже вирішив сервер.
let initialNavigate = true;
document.addEventListener('inertia:navigate', (event) => {
    if (initialNavigate) {
        initialNavigate = false;
        return;
    }
    const page = event.detail.page;
    const wantsShell = !!page.props?.auth?.user && !/^(Auth\/|Union\/|Home$)/.test(page.component);
    if (wantsShell !== !!shellMode()) window.location.reload();
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.vue`,
            import.meta.glob('./Pages/**/*.vue'),
        ),
    setup({ el, App, props, plugin }) {
        const app = createApp({
            render: () => h('div', [h(PageTransition, () => h(App, props)), h(CommandPalette)]),
        })
            .use(plugin)
            .use(ZiggyVue)
            .directive('reveal', reveal)
            .directive('glow', glow)
            .directive('parallax', parallax)
            .directive('magnetic', magnetic)
            .mount(el);

        startDecorations();

        return app;
    },
    progress: {
        // Читаем из палитры, а не хексом: акцент задаётся в админке, и
        // полоска загрузки не должна оставаться золотой, когда весь сайт
        // уже другого цвета.
        color: getComputedStyle(document.documentElement)
            .getPropertyValue('--gold-400')
            .trim()
            .replace(/^(\d+)\s+(\d+)\s+(\d+)$/, 'rgb($1,$2,$3)') || '#d4af37',
    },
});

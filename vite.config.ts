import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { basename } from 'node:path';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
    plugins: lazyPlugins(() => [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        inertia(),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ]),
    resolve: {
        // VKUI зі стилями по компонентах: CSS лише тих, що імпортуємо (Group, Header…),
        // а не весь vkui.css на ~390 КБ.
        alias: [
            {
                find: /^@vkontakte\/vkui$/,
                replacement: '@vkontakte/vkui/dist/cssm',
            },
        ],
    },
    css: {
        modules: {
            // Ті самі імена класів, що й у vkui.css (vkuiGroup__modeCard): на них спираються
            // наші перевизначення в app.css.
            generateScopedName: (local, file) => {
                const match = /@vkontakte[\\/]vkui[\\/]/.test(file)
                    ? basename(file).replace(/\.module\.css.*$/, '')
                    : null;
                return match
                    ? `vkui${match}__${local}`
                    : `${basename(file).replace(/\..*$/, '')}_${local}`;
            },
        },
    },
    server: {
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
            ],
        },
    },
    lint: {
        ignorePatterns: [
            // Скіли Anthropic (.claude/skills) — сторонній код, лишаємо як в оригіналі.
            '.claude/**',
            'vendor/**',
            '.claude/**',
            'node_modules/**',
            'public/**',
            'mobile/**',
            // Застосунок для Windows (Rust + Tauri) — окремий проєкт зі своєю перевіркою (cargo test).
            'desktop/**',
            // Програма для ПК (Electron) — окремий проєкт зі своєю перевіркою (pc: npm run typecheck).
            'pc/**',
            // Зібраний веб-SDK (npm run sdk:build) — лінтер перевіряє його джерело resources/js/sdk/gamecon-sdk.ts.
            'resources/sdk/gamecon-sdk.js',
            // Шаблон для сторонніх Next.js-проєктів: next-auth ставиться там, не тут.
            'resources/cms-plugins/nextjs/**',
            'bootstrap/ssr/**',
            'tailwind.config.js',
            'resources/js/actions/**',
            'resources/js/components/ui/*',
            'resources/js/routes/**',
            'resources/js/wayfinder/**',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: [
            '.claude/**',
            '.github/**',
            // Скопійовані скіли Anthropic — сторонній текст, не форматуємо.
            '.claude/**',
            'composer.json',
            // Flutter-застосунок форматує `dart format`, не vp.
            'mobile/**',
            'desktop/**',
            'pc/**',
            'resources/js/components/ui/*',
            'resources/views/mail/*',
            // Каталог перекладів генерує scripts/i18n/extract.mjs.
            'lang/catalog.json',
        ],
        sortTailwindcss: {
            functions: ['clsx', 'cn', 'cva'],
            stylesheet: 'resources/css/app.css',
        },
    },
});

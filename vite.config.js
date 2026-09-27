import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            // Дві точки входу на час переходу: старі сторінки родини (Vue +
            // Inertia) і нова платформа (React SPA у resources/app).
            input: ['resources/js/app.js', 'resources/app/main.tsx'],
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
        // Лише файли нової платформи — старий resources/js не чіпаємо.
        react({ include: /resources\/app\/.*\.[jt]sx?$/ }),
        // Tailwind 4: плагін замінює постс-пайплайн (postcss.config.js
        // видалено) — свій движок (Lightning CSS) сам займається
        // автопрефіксами, окремий autoprefixer більше не потрібен.
        tailwindcss(),
    ],
    build: { target: 'es2022' },
});

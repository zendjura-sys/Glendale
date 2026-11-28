import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

// Три збірки: main (Node, ядро вікон), preload (міст contextBridge), renderer (React UI).
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        // Нативний модуль Rust (.node) не бандлимо — він вантажиться з диска через require.
        build: { rollupOptions: { external: [/\.node$/, /native\/index\.js$/] } },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
    },
    renderer: {
        resolve: { alias: { '@': resolve('src/renderer/src') } },
        plugins: [react(), tailwindcss()],
    },
});

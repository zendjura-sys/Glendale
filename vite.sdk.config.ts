import { defineConfig } from 'vite';

// GameCon Overlay SDK — окремий бандл без залежностей (resources/sdk/gamecon-sdk.js; віддає /sdk/v1/gamecon-sdk.js зі словником мови).
export default defineConfig({
    publicDir: false,
    build: {
        outDir: 'resources/sdk',
        emptyOutDir: false,
        minify: true,
        lib: {
            entry: 'resources/js/sdk/gamecon-sdk.ts',
            name: 'GameConSDKModule',
            formats: ['iife'],
            fileName: () => 'gamecon-sdk.js',
        },
    },
});

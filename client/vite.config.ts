import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const target = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': target,
      '/uploads': target,
      '/ws': { target, ws: true },
    },
  },
  build: { target: 'es2022' },
});

import express from 'express';
import compression from 'compression';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './api.js';
import { admin } from './admin.js';
import { uploadsDir } from './uploads.js';
import { attachRealtime } from './realtime.js';
import { seed } from './seed.js';
import { languageMiddleware } from './i18n.js';
import { getSetting } from './settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(languageMiddleware);
  app.use('/uploads', express.static(uploadsDir, { maxAge: '365d', immutable: true }));
  app.use('/api/admin', admin);
  app.use('/api', api);

  // Installable app: the manifest follows the site name and accent colour set in the admin panel.
  app.get('/manifest.webmanifest', (_req, res) => {
    const name = String(getSetting('siteTitle') || 'Glendale');
    res.type('application/manifest+json').set('Cache-Control', 'no-cache');
    res.send(
      JSON.stringify({
        id: '/',
        name,
        short_name: name.slice(0, 12),
        description: String(getSetting('siteDescription') || ''),
        lang: String(getSetting('defaultLanguage') || 'uk'),
        start_url: '/feed',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#eceefb',
        theme_color: String(getSetting('accentColor') || '#4c5bf5'),
        categories: ['social', 'music'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Messenger', url: '/im', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Music', url: '/music', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      }),
    );
  });

  // Digital Asset Links: lets the Android app (Trusted Web Activity) open the site without a browser bar.
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const links = String(getSetting('androidAssetLinks') || '').trim();
    if (!links) return res.status(404).json([]);
    res.type('application/json').send(links);
  });

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, {
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.SEED !== '0' && seed()) console.log('Пустая база заполнена демо-данными (demo@glendale.app / demo123, админ: admin@glendale.app / admin123)');
  const server = http.createServer(createApp());
  attachRealtime(server);
  const port = Number(process.env.PORT) || 3001;
  // HOST=127.0.0.1 behind a reverse proxy keeps the app off the public interface.
  const host = process.env.HOST || undefined;
  server.listen(port, host, () => console.log(`Glendale server: http://${host || 'localhost'}:${port}`));
}

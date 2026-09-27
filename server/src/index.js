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
  server.listen(port, () => console.log(`Glendale server: http://localhost:${port}`));
}

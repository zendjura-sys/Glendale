import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const uploadsDir = process.env.UPLOADS_DIR || path.join(root, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };

export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (EXT[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error('Поддерживаются только изображения JPG, PNG, GIF и WEBP'), { status: 400 }));
  },
});

export const fileUrl = (file) => (file ? `/uploads/${file.filename}` : null);

const AUDIO_EXT = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/webm': '.webm',
};

const AUDIO_BY_NAME = { '.mp3': '.mp3', '.m4a': '.m4a', '.aac': '.aac', '.ogg': '.ogg', '.oga': '.ogg', '.wav': '.wav', '.flac': '.flac', '.webm': '.webm' };
// Browsers sometimes send no MIME type for audio; fall back to the file extension.
const audioExt = (file) => AUDIO_EXT[file.mimetype] ?? AUDIO_BY_NAME[path.extname(file.originalname || '').toLowerCase()];

export const uploadAudio = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + audioExt(file)),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (audioExt(file)) cb(null, true);
    else cb(Object.assign(new Error('Поддерживаются аудиофайлы MP3, M4A, AAC, OGG, WAV, FLAC и WEBM'), { status: 400 }));
  },
});

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session } from 'electron';

/**
 * Студія LiveCast (як OBS): захоплення екранів і вікон, запис у файл і трансляція по RTMP
 * (Twitch, YouTube, свій сервер) через ffmpeg — поруч із публікацією в LiveCast (LiveKit, у рендерері).
 */
export function registerStudio(openStudio: () => void): void {
    // Камера, мікрофон і захоплення екрана — лише для сторінок самої програми.
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
        const own = wc.getURL().startsWith('file://') || wc.getURL().startsWith(process.env.ELECTRON_RENDERER_URL ?? '\u0000');
        callback(own && ['media', 'display-capture', 'mediaKeySystem', 'clipboard-sanitized-write'].includes(permission));
    });

    ipcMain.handle('studio:open', () => openStudio());

    // Екрани й вікна для джерела «Захоплення» (з мініатюрами для вибору).
    ipcMain.handle('capture:sources', async () => {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true });
        return sources.map((s) => ({ id: s.id, name: s.name, kind: s.id.startsWith('screen') ? 'screen' : 'window', thumbnail: s.thumbnail.toDataURL(), icon: s.appIcon?.toDataURL() ?? null }));
    });

    // Запис: зберегти готовий файл (webm) — у «Відео» або куди обере людина.
    ipcMain.handle('studio:save', async (e, bytes: ArrayBuffer, name: string) => {
        const win = BrowserWindow.fromWebContents(e.sender);
        const target = await dialog.showSaveDialog(win!, {
            title: 'Зберегти запис',
            defaultPath: join(app.getPath('videos'), name.replace(/[^\w.\-а-яіїєґА-ЯІЇЄҐ ]+/g, '_')),
            filters: [{ name: 'Відео WebM', extensions: ['webm'] }],
        });
        if (target.canceled || !target.filePath) return null;
        await writeFile(target.filePath, Buffer.from(bytes));
        return target.filePath;
    });

    // RTMP: рендерер шле шматки webm (MediaRecorder), ffmpeg перепаковує в FLV/H.264+AAC для сервера.
    let ffmpeg: ChildProcessWithoutNullStreams | null = null;
    const ffmpegPath = (): string => {
        const bin = (require('ffmpeg-static') as string | null) ?? 'ffmpeg';
        return app.isPackaged ? bin.replace('app.asar', 'app.asar.unpacked') : bin;
    };
    ipcMain.handle('rtmp:start', (e, url: string, bitrate: number, fps: number) => {
        if (ffmpeg) return { ok: false, message: 'Трансляція вже йде.' };
        if (!/^rtmps?:\/\//.test(url)) return { ok: false, message: 'Адреса сервера має починатися з rtmp:// або rtmps://.' };
        const kbps = Math.max(1000, Math.min(12000, Math.round(bitrate)));
        ffmpeg = spawn(ffmpegPath(), [
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0',
            '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
            '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`, '-g', String(fps * 2), '-r', String(fps),
            '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
            '-f', 'flv', url,
        ]);
        const sender = e.sender;
        ffmpeg.stderr.on('data', (chunk: Buffer) => {
            if (!sender.isDestroyed()) sender.send('rtmp:log', chunk.toString());
        });
        ffmpeg.on('close', (code) => {
            ffmpeg = null;
            if (!sender.isDestroyed()) sender.send('rtmp:closed', code);
        });
        return { ok: true };
    });
    ipcMain.on('rtmp:chunk', (_e, bytes: ArrayBuffer) => {
        ffmpeg?.stdin.write(Buffer.from(bytes));
    });
    ipcMain.handle('rtmp:stop', () => {
        ffmpeg?.stdin.end();
        ffmpeg = null;
    });
}

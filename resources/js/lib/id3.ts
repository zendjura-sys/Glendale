/**
 * Мінімальний парсер тегів ID3v2.3/2.4: назва, виконавець, альбом, жанр, обкладинка.
 */
export type AudioTags = {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    cover?: Blob;
};

const syncsafe = (b: Uint8Array, o: number) =>
    (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
const uint32 = (b: Uint8Array, o: number) =>
    ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function decode(bytes: Uint8Array, encoding: number): string {
    const label =
        encoding === 0
            ? 'iso-8859-1'
            : encoding === 1
              ? 'utf-16'
              : encoding === 2
                ? 'utf-16be'
                : 'utf-8';

    return new TextDecoder(label)
        .decode(bytes)
        .replace(/\0+$/g, '')
        .split('\0')[0]
        .trim();
}

function terminator(bytes: Uint8Array, from: number, wide: boolean): number {
    for (let i = from; i < bytes.length; i += wide ? 2 : 1) {
        if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return i;
    }

    return bytes.length;
}

export async function readTags(file: File): Promise<AudioTags> {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};

    const version = head[3];
    const size = syncsafe(head, 6);
    const bytes = new Uint8Array(
        await file
            .slice(10, 10 + Math.min(size, 8 * 1024 * 1024))
            .arrayBuffer(),
    );
    const tags: AudioTags = {};
    let offset = head[5] & 0x40 ? 4 + uint32(bytes, 0) : 0;

    while (offset + 10 < bytes.length) {
        const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const frameSize =
            version === 4
                ? syncsafe(bytes, offset + 4)
                : uint32(bytes, offset + 4);
        const body = bytes.slice(offset + 10, offset + 10 + frameSize);
        offset += 10 + frameSize;
        if (frameSize <= 0 || body.length === 0) continue;

        const text = () => decode(body.slice(1), body[0]);
        switch (id) {
            case 'TIT2':
                tags.title = text();
                break;
            case 'TPE1':
                tags.artist = text();
                break;
            case 'TALB':
                tags.album = text();
                break;
            case 'TCON':
                tags.genre = text().replace(/^\(\d+\)/, '') || undefined;
                break;
            case 'APIC': {
                const encoding = body[0];
                const mimeEnd = terminator(body, 1, false);
                const mime = decode(body.slice(1, mimeEnd), 0) || 'image/jpeg';
                const wide = encoding === 1 || encoding === 2;
                const descEnd = terminator(body, mimeEnd + 2, wide);
                const start = descEnd + (wide ? 2 : 1);
                tags.cover = new Blob([body.slice(start)], {
                    type: mime.includes('/')
                        ? mime
                        : `image/${mime.toLowerCase()}`,
                });
                break;
            }
        }
    }

    return tags;
}

export function readDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        const done = (value: number) => {
            URL.revokeObjectURL(url);
            resolve(Number.isFinite(value) ? Math.round(value) : 0);
        };
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => done(audio.duration);
        audio.onerror = () => done(0);
        audio.src = url;
    });
}

export function guessFromFilename(name: string): {
    title: string;
    artist: string;
} {
    const base = name
        .replace(/\.[^.]+$/, '')
        .replace(/_/g, ' ')
        .trim();
    const [artist, ...rest] = base.split(/\s+[-–—]\s+/);

    return rest.length > 0
        ? { artist: artist.trim(), title: rest.join(' - ').trim() }
        : { artist: '', title: base };
}

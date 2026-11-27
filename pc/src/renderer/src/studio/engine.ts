import { Room, Track } from 'livekit-client';
import { api } from '@/lib/api';

export type SourceKind = 'screen' | 'window' | 'camera' | 'image' | 'text' | 'color';
export type Source = {
    id: string;
    kind: SourceKind;
    name: string;
    visible: boolean;
    locked: boolean;
    /** Положення й розмір у пікселях полотна виходу. */
    x: number;
    y: number;
    w: number;
    h: number;
    props: { captureId?: string; deviceId?: string; src?: string; text?: string; color?: string; size?: number; font?: string; bold?: boolean; fit?: 'contain' | 'cover'; mirror?: boolean; background?: string };
};
export type Scene = { id: string; name: string; sources: Source[] };
export type Output = { width: number; height: number; fps: number; bitrate: number };
export type Channel = { deviceId?: string; gain: number; muted: boolean; enabled: boolean };
export type StudioConfig = { scenes: Scene[]; active: string; output: Output; mic: Channel; desktop: Channel; rtmp: { url: string; key: string }; transition: number };

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function defaultConfig(): StudioConfig {
    const scene: Scene = { id: uid(), name: 'Гра', sources: [] };
    return {
        scenes: [scene, { id: uid(), name: 'Перерва', sources: [{ id: uid(), kind: 'text', name: 'Напис', visible: true, locked: false, x: 160, y: 460, w: 1600, h: 160, props: { text: 'Скоро повернемось', color: '#ffffff', size: 96, bold: true, font: 'Segoe UI' } }] }],
        active: scene.id,
        output: { width: 1920, height: 1080, fps: 60, bitrate: 6000 },
        mic: { gain: 1, muted: false, enabled: true },
        desktop: { gain: 1, muted: false, enabled: true },
        rtmp: { url: '', key: '' },
        transition: 300,
    };
}

type Media = { el: HTMLVideoElement | HTMLImageElement; stream?: MediaStream; key: string };
type Meter = { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> };

/**
 * Рушій студії LiveCast (як OBS): компонує активну сцену на полотні (requestAnimationFrame) з
 * плавним переходом між сценами, мікшує звук (мікрофон + звук системи) через Web Audio й віддає
 * готовий потік у три виходи: ефір LiveCast (LiveKit), RTMP (через ffmpeg у Main) і запис у файл.
 */
export class StudioEngine {
    readonly canvas = document.createElement('canvas');
    private ctx = this.canvas.getContext('2d', { alpha: false })!;
    private media = new Map<string, Media>();
    private frame = 0;
    private previous: Scene | null = null;
    private transitionAt = 0;
    config: StudioConfig;
    // Звук.
    private audio = new AudioContext({ sampleRate: 48000 });
    private mix = this.audio.createMediaStreamDestination();
    private micGain = this.audio.createGain();
    private deskGain = this.audio.createGain();
    meters: { mic: Meter; desktop: Meter };
    private micStream: MediaStream | null = null;
    private deskStream: MediaStream | null = null;
    // Виходи.
    private room: Room | null = null;
    broadcastId: number | null = null;
    private recorder: MediaRecorder | null = null;
    private recordChunks: Blob[] = [];
    private rtmpRecorder: MediaRecorder | null = null;
    // Статистика.
    stats = { fps: 0, frames: 0, startedAt: 0 };
    private fpsWindow: number[] = [];
    onChange: () => void = () => undefined;

    constructor(config: StudioConfig) {
        this.config = config;
        this.resize();
        const meter = (gain: GainNode): Meter => {
            const analyser = this.audio.createAnalyser();
            analyser.fftSize = 512;
            gain.connect(analyser);
            return { analyser, data: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
        };
        this.micGain.connect(this.mix);
        this.deskGain.connect(this.mix);
        this.meters = { mic: meter(this.micGain), desktop: meter(this.deskGain) };
        this.applyAudio();
        void this.startAudio();
        this.loop = this.loop.bind(this);
        this.frame = requestAnimationFrame(this.loop);
    }

    get scene(): Scene {
        return this.config.scenes.find((s) => s.id === this.config.active) ?? this.config.scenes[0];
    }

    resize(): void {
        this.canvas.width = this.config.output.width;
        this.canvas.height = this.config.output.height;
    }

    /** Перемкнути сцену з плавним переходом (fade). */
    switchScene(id: string): void {
        if (id === this.config.active) return;
        this.previous = this.scene;
        this.transitionAt = performance.now();
        this.config.active = id;
        this.syncMedia();
        this.onChange();
    }

    // ───────── Джерела ─────────

    private mediaKey(s: Source): string {
        return `${s.kind}:${s.props.captureId ?? s.props.deviceId ?? s.props.src ?? ''}`;
    }

    /** Запустити потрібні медіа для активної й попередньої сцени, зупинити зайві. */
    syncMedia(): void {
        const needed = new Map<string, Source>();
        for (const scene of [this.scene, this.previous]) {
            for (const s of scene?.sources ?? []) if (s.visible && ['screen', 'window', 'camera', 'image'].includes(s.kind)) needed.set(s.id, s);
        }
        for (const [id, m] of this.media) {
            const s = needed.get(id);
            if (!s || this.mediaKey(s) !== m.key) {
                m.stream?.getTracks().forEach((t) => t.stop());
                this.media.delete(id);
            }
        }
        for (const [id, s] of needed) if (!this.media.has(id)) void this.acquire(id, s);
    }

    private async acquire(id: string, s: Source): Promise<void> {
        const key = this.mediaKey(s);
        this.media.set(id, { el: document.createElement('video'), key }); // заглушка, щоб не запускати двічі
        try {
            if (s.kind === 'image' && s.props.src) {
                const img = new Image();
                img.src = s.props.src;
                await img.decode();
                this.media.set(id, { el: img, key });
                return;
            }
            let stream: MediaStream;
            if (s.kind === 'camera') {
                stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: s.props.deviceId ? { exact: s.props.deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: this.config.output.fps } }, audio: false });
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: s.props.captureId, maxWidth: 3840, maxHeight: 2160, maxFrameRate: this.config.output.fps } } as unknown as MediaTrackConstraints,
                });
            }
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;
            await video.play();
            this.media.set(id, { el: video, stream, key });
        } catch {
            this.media.delete(id);
        }
    }

    // ───────── Компонування ─────────

    private loop(now: number): void {
        const { width, height } = this.canvas;
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        const t = this.previous ? Math.min(1, (now - this.transitionAt) / Math.max(1, this.config.transition)) : 1;
        if (this.previous && t < 1) {
            ctx.globalAlpha = 1;
            this.draw(this.previous);
            ctx.globalAlpha = t;
            this.draw(this.scene);
            ctx.globalAlpha = 1;
        } else {
            if (this.previous) {
                this.previous = null;
                this.syncMedia();
            }
            this.draw(this.scene);
        }
        // FPS за останню секунду.
        this.fpsWindow.push(now);
        while (this.fpsWindow.length && now - this.fpsWindow[0] > 1000) this.fpsWindow.shift();
        this.stats.fps = this.fpsWindow.length;
        this.stats.frames++;
        this.frame = requestAnimationFrame(this.loop);
    }

    private draw(scene: Scene): void {
        const ctx = this.ctx;
        for (const s of scene.sources) {
            if (!s.visible) continue;
            if (s.kind === 'color') {
                ctx.fillStyle = s.props.color ?? '#101420';
                ctx.fillRect(s.x, s.y, s.w, s.h);
                continue;
            }
            if (s.kind === 'text') {
                const size = s.props.size ?? 64;
                if (s.props.background) {
                    ctx.fillStyle = s.props.background;
                    ctx.fillRect(s.x, s.y, s.w, s.h);
                }
                ctx.font = `${s.props.bold ? '700' : '500'} ${size}px "${s.props.font ?? 'Segoe UI'}", sans-serif`;
                ctx.fillStyle = s.props.color ?? '#fff';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = size / 6;
                ctx.fillText(s.props.text ?? '', s.x + s.w / 2, s.y + s.h / 2, s.w);
                ctx.shadowBlur = 0;
                continue;
            }
            const m = this.media.get(s.id);
            if (!m) continue;
            const el = m.el;
            const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
            const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
            if (!sw || !sh) continue;
            const fit = s.props.fit ?? 'contain';
            const scale = fit === 'cover' ? Math.max(s.w / sw, s.h / sh) : Math.min(s.w / sw, s.h / sh);
            const dw = sw * scale;
            const dh = sh * scale;
            ctx.save();
            ctx.beginPath();
            ctx.rect(s.x, s.y, s.w, s.h);
            ctx.clip();
            if (s.props.mirror) {
                ctx.translate(s.x + s.w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(el, s.w - (s.w - dw) / 2 - dw, s.y + (s.h - dh) / 2, dw, dh);
            } else {
                ctx.drawImage(el, s.x + (s.w - dw) / 2, s.y + (s.h - dh) / 2, dw, dh);
            }
            ctx.restore();
        }
    }

    // ───────── Звук ─────────

    async startAudio(): Promise<void> {
        this.micStream?.getTracks().forEach((t) => t.stop());
        this.deskStream?.getTracks().forEach((t) => t.stop());
        this.micStream = this.deskStream = null;
        const { mic, desktop } = this.config;
        if (mic.enabled) {
            try {
                this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: mic.deviceId ? { exact: mic.deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false });
                this.audio.createMediaStreamSource(this.micStream).connect(this.micGain);
            } catch {
                this.micStream = null;
            }
        }
        if (desktop.enabled) {
            try {
                // Звук системи (loopback Windows): Chromium вимагає разом із відео — відео одразу зупиняємо.
                const both = await navigator.mediaDevices.getUserMedia({
                    audio: { mandatory: { chromeMediaSource: 'desktop' } } as unknown as MediaTrackConstraints,
                    video: { mandatory: { chromeMediaSource: 'desktop' } } as unknown as MediaTrackConstraints,
                });
                both.getVideoTracks().forEach((t) => t.stop());
                this.deskStream = new MediaStream(both.getAudioTracks());
                if (this.deskStream.getAudioTracks().length) this.audio.createMediaStreamSource(this.deskStream).connect(this.deskGain);
            } catch {
                this.deskStream = null;
            }
        }
        void this.audio.resume();
    }

    applyAudio(): void {
        const { mic, desktop } = this.config;
        this.micGain.gain.value = mic.muted ? 0 : mic.gain;
        this.deskGain.gain.value = desktop.muted ? 0 : desktop.gain;
    }

    /** Рівень каналу 0..1 (для індикатора). */
    level(channel: 'mic' | 'desktop'): number {
        const m = this.meters[channel];
        m.analyser.getByteTimeDomainData(m.data);
        let peak = 0;
        for (const v of m.data) peak = Math.max(peak, Math.abs(v - 128));
        return Math.min(1, peak / 100);
    }

    // ───────── Виходи ─────────

    output(): MediaStream {
        const video = this.canvas.captureStream(this.config.output.fps);
        return new MediaStream([...video.getVideoTracks(), ...this.mix.stream.getAudioTracks()]);
    }

    get live(): boolean {
        return this.room !== null;
    }
    get recording(): boolean {
        return this.recorder !== null;
    }
    get rtmp(): boolean {
        return this.rtmpRecorder !== null;
    }

    /** Ефір у LiveCast: створити трансляцію, отримати токен LiveKit і опублікувати полотно й мікс. */
    async goLive(title: string, category: string | null): Promise<void> {
        const created = await api<{ broadcast: { id: number } }>('POST', '/api/v1/site/livecast', { title, category });
        const id = created.broadcast.id;
        const join = await api<{ url: string; token: string }>('POST', `/api/v1/site/livecast/${id}/join`);
        const room = new Room({ adaptiveStream: false, dynacast: false });
        await room.connect(join.url, join.token);
        const stream = this.output();
        const [video] = stream.getVideoTracks();
        const [audio] = stream.getAudioTracks();
        await room.localParticipant.publishTrack(video, {
            source: Track.Source.Camera,
            name: 'studio',
            simulcast: false,
            videoEncoding: { maxBitrate: this.config.output.bitrate * 1000, maxFramerate: this.config.output.fps },
        });
        if (audio) await room.localParticipant.publishTrack(audio, { source: Track.Source.Microphone, name: 'mix', dtx: false, red: true });
        this.room = room;
        this.broadcastId = id;
        this.stats.startedAt = Date.now();
        this.onChange();
    }

    async endLive(): Promise<void> {
        const id = this.broadcastId;
        await this.room?.disconnect();
        this.room = null;
        this.broadcastId = null;
        if (id) await api('POST', `/api/v1/site/livecast/${id}/end`).catch(() => undefined);
        this.onChange();
    }

    startRecording(): void {
        if (this.recorder) return;
        this.recordChunks = [];
        const recorder = new MediaRecorder(this.output(), { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: this.config.output.bitrate * 1000 });
        recorder.ondataavailable = (e) => e.data.size && this.recordChunks.push(e.data);
        recorder.start(1000);
        this.recorder = recorder;
        this.onChange();
    }

    async stopRecording(): Promise<string | null> {
        const recorder = this.recorder;
        if (!recorder) return null;
        await new Promise<void>((resolve) => {
            recorder.onstop = () => resolve();
            recorder.stop();
        });
        this.recorder = null;
        this.onChange();
        const blob = new Blob(this.recordChunks, { type: 'video/webm' });
        const name = `GameCon ${new Date().toLocaleString('uk-UA').replace(/[/:]/g, '-')}.webm`;
        return window.gamecon.studio.save(await blob.arrayBuffer(), name);
    }

    /** RTMP (Twitch, YouTube, свій сервер): шматки webm ідуть у ffmpeg у Main. */
    async startRtmp(): Promise<void> {
        const { url, key } = this.config.rtmp;
        const target = key ? `${url.replace(/\/$/, '')}/${key}` : url;
        const res = await window.gamecon.studio.rtmpStart(target, this.config.output.bitrate, this.config.output.fps);
        if (!res.ok) throw new Error(res.message ?? 'Не вдалося почати трансляцію.');
        const recorder = new MediaRecorder(this.output(), { mimeType: 'video/webm;codecs=h264,opus', videoBitsPerSecond: this.config.output.bitrate * 1000 });
        recorder.ondataavailable = async (e) => {
            if (e.data.size) window.gamecon.studio.rtmpChunk(await e.data.arrayBuffer());
        };
        recorder.start(500);
        this.rtmpRecorder = recorder;
        if (!this.stats.startedAt) this.stats.startedAt = Date.now();
        this.onChange();
    }

    async stopRtmp(): Promise<void> {
        this.rtmpRecorder?.stop();
        this.rtmpRecorder = null;
        await window.gamecon.studio.rtmpStop();
        this.onChange();
    }

    dispose(): void {
        cancelAnimationFrame(this.frame);
        for (const m of this.media.values()) m.stream?.getTracks().forEach((t) => t.stop());
        this.micStream?.getTracks().forEach((t) => t.stop());
        this.deskStream?.getTracks().forEach((t) => t.stop());
        void this.audio.close();
    }
}

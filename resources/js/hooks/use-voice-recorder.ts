import { useEffect, useRef, useState } from 'react';

export type VoiceRecording = {
    blob: Blob;
    duration: number;
    waveform: number[];
};

const MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
];

export const MAX_VOICE_SECONDS = 600;
const WAVEFORM_BARS = 48;
const LIVE_BARS = 36;

function pickMime(): string | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;

    return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Стискає рівні гучності до фіксованої кількості стовпчиків 0–100. */
function compress(levels: number[], bars: number): number[] {
    if (!levels.length) return Array.from({ length: bars }, () => 8);
    const size = levels.length / bars;
    const peaks = Array.from({ length: bars }, (_, i) => {
        const chunk = levels.slice(
            Math.floor(i * size),
            Math.max(Math.floor((i + 1) * size), Math.floor(i * size) + 1),
        );

        return chunk.length ? Math.max(...chunk) : 0;
    });
    const max = Math.max(...peaks, 0.01);

    return peaks.map((v) => Math.max(6, Math.round((v / max) * 100)));
}

export function useVoiceRecorder(onLimit: (recording: VoiceRecording) => void) {
    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [live, setLive] = useState<number[]>([]);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const levelsRef = useRef<number[]>([]);
    const startedRef = useRef(0);
    const cleanupRef = useRef<(() => void) | null>(null);
    const resolveRef = useRef<((value: VoiceRecording | null) => void) | null>(
        null,
    );
    const onLimitRef = useRef(onLimit);
    useEffect(() => {
        onLimitRef.current = onLimit;
    });

    const supported =
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== 'undefined';

    const teardown = () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setElapsed(0);
        setLive([]);
    };

    useEffect(() => () => cleanupRef.current?.(), []);

    const finish = (keep: boolean): Promise<VoiceRecording | null> => {
        const recorder = recorderRef.current;
        if (!recorder) return Promise.resolve(null);

        return new Promise((resolve) => {
            resolveRef.current = resolve;
            recorder.onstop = () => {
                const duration = Math.max(
                    1,
                    Math.round((performance.now() - startedRef.current) / 1000),
                );
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || 'audio/webm',
                });
                const waveform = compress(levelsRef.current, WAVEFORM_BARS);
                teardown();
                resolveRef.current = null;
                resolve(
                    keep && blob.size > 0 ? { blob, duration, waveform } : null,
                );
            };
            if (recorder.state !== 'inactive') recorder.stop();
        });
    };

    const start = async (): Promise<void> => {
        if (recorderRef.current) return;
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
        });
        const mimeType = pickMime();
        const recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined,
        );

        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);

        chunksRef.current = [];
        levelsRef.current = [];
        startedRef.current = performance.now();

        const sample = window.setInterval(() => {
            analyser.getByteTimeDomainData(buffer);
            let sum = 0;
            for (const value of buffer) {
                const centered = (value - 128) / 128;
                sum += centered * centered;
            }
            const level = Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
            levelsRef.current.push(level);
            setLive((current) =>
                [...current, Math.max(8, Math.round(level * 100))].slice(
                    -LIVE_BARS,
                ),
            );
        }, 90);

        const clock = window.setInterval(() => {
            const seconds = Math.floor(
                (performance.now() - startedRef.current) / 1000,
            );
            setElapsed(seconds);
            if (seconds >= MAX_VOICE_SECONDS) {
                void finish(true).then((result) => {
                    if (result) onLimitRef.current(result);
                });
            }
        }, 250);

        cleanupRef.current = () => {
            window.clearInterval(sample);
            window.clearInterval(clock);
            stream.getTracks().forEach((track) => track.stop());
            void context.close();
        };

        recorder.ondataavailable = (event) => {
            if (event.data.size) chunksRef.current.push(event.data);
        };
        recorder.start(250);
        recorderRef.current = recorder;
        setRecording(true);
    };

    return {
        supported,
        recording,
        elapsed,
        live,
        start,
        stop: () => finish(true),
        cancel: () => {
            void finish(false);
        },
    };
}

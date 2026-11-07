import { Head, router } from '@inertiajs/react';
import { Download, ImagePlus, Laugh, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const MAX = 1080;
const field =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/35';

/** Текст мему: білий з чорним контуром, переноситься по ширині. */
function drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    width: number,
    y: number,
    size: number,
    fromBottom: boolean,
) {
    if (!text.trim()) return;
    ctx.font = `900 ${size}px Impact, 'Anton', 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(2, size / 9);
    ctx.lineJoin = 'round';
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > width * 0.92 && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    const height = size * 1.08;
    lines.forEach((value, index) => {
        const offset = fromBottom
            ? y - (lines.length - 1 - index) * height
            : y + index * height;
        ctx.textBaseline = fromBottom ? 'bottom' : 'top';
        ctx.strokeText(value, width / 2, offset);
        ctx.fillText(value, width / 2, offset);
    });
}

/** Мемогенератор: своя картинка, текст згори й знизу — завантажити або одразу в запис. */
export default function MemeCreate() {
    const canvas = useRef<HTMLCanvasElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [top, setTop] = useState('');
    const [bottom, setBottom] = useState('');
    const [size, setSize] = useState(8);
    const [caps, setCaps] = useState(true);
    const [caption, setCaption] = useState('');
    const [busy, setBusy] = useState(false);

    const render = useCallback(() => {
        const c = canvas.current;
        const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        const w = image ? Math.min(MAX, image.naturalWidth) : 900;
        const h = image
            ? Math.round((image.naturalHeight / image.naturalWidth) * w)
            : 600;
        c.width = w;
        c.height = h;
        if (image) {
            ctx.drawImage(image, 0, 0, w, h);
        } else {
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, '#1d2347');
            g.addColorStop(1, '#3a2a6b');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }
        const px = Math.round((w * size) / 100);
        const pad = Math.round(h * 0.03);
        const fix = (t: string) => (caps ? t.toUpperCase() : t);
        drawText(ctx, fix(top), w, pad, px, false);
        drawText(ctx, fix(bottom), w, h - pad, px, true);
    }, [image, top, bottom, size, caps]);

    useEffect(render, [render]);

    const pick = (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error(tr('Оберіть картинку.'));
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => setImage(img);
        img.src = url;
    };

    const blob = () =>
        new Promise<Blob | null>((resolve) =>
            canvas.current?.toBlob(resolve, 'image/jpeg', 0.92),
        );

    const download = async () => {
        const data = await blob();
        if (!data) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(data);
        a.download = 'gamecon-meme.jpg';
        a.click();
    };

    const publish = async () => {
        const data = await blob();
        if (!data) return;
        setBusy(true);
        router.post(
            '/posts',
            {
                body: caption,
                visibility: 'public',
                images: [new File([data], 'meme.jpg', { type: 'image/jpeg' })],
            },
            {
                forceFormData: true,
                onSuccess: () => toast.success(tr('Мем опубліковано!')),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <>
            <Head title={tr('Мемогенератор')} />
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-1 flex items-center gap-2 font-display text-2xl font-semibold text-white">
                    <Laugh className="size-6 text-gc-lilac-200" />
                    {tr('Мемогенератор')}
                </h1>
                <p className="mb-5 text-sm text-white/55">
                    {tr(
                        'Скріншот із гри чи будь-яке фото — текст згори й знизу, і мем готовий.',
                    )}
                </p>
                <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
                    <div
                        className="glass flex items-center justify-center overflow-hidden rounded-2xl p-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            pick(e.dataTransfer.files[0]);
                        }}
                    >
                        <canvas
                            ref={canvas}
                            className="max-h-[70vh] w-auto max-w-full rounded-xl"
                        />
                    </div>
                    <div className="glass space-y-3 rounded-2xl p-4">
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => pick(e.target.files?.[0])}
                        />
                        <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                        >
                            <ImagePlus className="size-4" />
                            {image
                                ? tr('Інша картинка')
                                : tr('Обрати картинку')}
                        </button>
                        <input
                            value={top}
                            onChange={(e) => setTop(e.target.value)}
                            maxLength={120}
                            placeholder={tr('Текст згори')}
                            className={field}
                        />
                        <input
                            value={bottom}
                            onChange={(e) => setBottom(e.target.value)}
                            maxLength={120}
                            placeholder={tr('Текст знизу')}
                            className={field}
                        />
                        <label className="block text-xs text-white/55">
                            {tr('Розмір тексту')}
                            <input
                                type="range"
                                min={4}
                                max={14}
                                value={size}
                                onChange={(e) =>
                                    setSize(Number(e.target.value))
                                }
                                className="mt-1 w-full accent-[var(--primary)]"
                            />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-white/70">
                            <input
                                type="checkbox"
                                checked={caps}
                                onChange={(e) => setCaps(e.target.checked)}
                            />
                            {tr('ВЕЛИКІ ЛІТЕРИ')}
                        </label>
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            maxLength={500}
                            rows={2}
                            placeholder={tr('Підпис до запису (можна #гру)')}
                            className={cn(field, 'h-auto resize-none py-2.5')}
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => void download()}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-semibold text-white transition hover:bg-white/[0.11]"
                            >
                                <Download className="size-4" />
                                {tr('Зберегти')}
                            </button>
                            <button
                                type="button"
                                disabled={busy || (!top && !bottom)}
                                onClick={() => void publish()}
                                className="btn-glow inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                            >
                                <Send className="size-4" />
                                {tr('Опублікувати')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

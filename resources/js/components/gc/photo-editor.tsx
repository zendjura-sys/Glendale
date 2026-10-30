import { Crop, RotateCw, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Adjust = { brightness: number; contrast: number; saturate: number };

const FILTERS: { key: string; label: () => string; css: string }[] = [
    { key: 'none', label: () => tr('Без фільтра'), css: '' },
    { key: 'warm', label: () => tr('Тепло'), css: 'sepia(0.25) saturate(1.2)' },
    {
        key: 'cold',
        label: () => tr('Холод'),
        css: 'hue-rotate(185deg) saturate(0.9)',
    },
    { key: 'mono', label: () => tr('Ч/б'), css: 'grayscale(1)' },
    {
        key: 'neon',
        label: () => tr('Неон'),
        css: 'saturate(1.8) contrast(1.15)',
    },
    {
        key: 'fade',
        label: () => tr('Вицвіле'),
        css: 'contrast(0.85) brightness(1.1) saturate(0.8)',
    },
];

const RATIOS: { key: string; label: string; value: number | null }[] = [
    { key: 'free', label: 'Оригінал', value: null },
    { key: '1:1', label: '1:1', value: 1 },
    { key: '4:5', label: '4:5', value: 4 / 5 },
    { key: '16:9', label: '16:9', value: 16 / 9 },
];

/**
 * Фоторедактор перед публікацією: обрізка за пропорцією (по центру), поворот,
 * яскравість, контраст, насиченість і фільтри. Усе в браузері — на сервер іде готовий JPEG.
 */
export function PhotoEditor({
    file,
    onDone,
    onClose,
}: {
    file: File;
    onDone: (edited: File) => void;
    onClose: () => void;
}) {
    const [src] = useState(() => URL.createObjectURL(file));
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [rotate, setRotate] = useState(0);
    const [ratio, setRatio] = useState<number | null>(null);
    const [filter, setFilter] = useState('none');
    const [adjust, setAdjust] = useState<Adjust>({
        brightness: 100,
        contrast: 100,
        saturate: 100,
    });
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const img = new Image();
        img.onload = () => setImage(img);
        img.src = src;

        return () => URL.revokeObjectURL(src);
    }, [src]);

    const cssFilter = `brightness(${adjust.brightness}%) contrast(${adjust.contrast}%) saturate(${adjust.saturate}%) ${FILTERS.find((f) => f.key === filter)?.css ?? ''}`;

    const render = (target: HTMLCanvasElement, maxSide: number) => {
        if (!image) return;
        const turned = rotate % 180 !== 0;
        const w0 = turned ? image.naturalHeight : image.naturalWidth;
        const h0 = turned ? image.naturalWidth : image.naturalHeight;
        let cw = w0;
        let ch = h0;
        if (ratio) {
            if (w0 / h0 > ratio) cw = h0 * ratio;
            else ch = w0 / ratio;
        }
        const scale = Math.min(1, maxSide / Math.max(cw, ch));
        target.width = Math.round(cw * scale);
        target.height = Math.round(ch * scale);
        const ctx = target.getContext('2d');
        if (!ctx) return;
        ctx.filter = cssFilter;
        ctx.save();
        ctx.translate(target.width / 2, target.height / 2);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.drawImage(
            image,
            (-image.naturalWidth * scale) / 2,
            (-image.naturalHeight * scale) / 2,
            image.naturalWidth * scale,
            image.naturalHeight * scale,
        );
        ctx.restore();
    };

    useEffect(() => {
        if (canvas.current) render(canvas.current, 900);
    });

    const save = () => {
        const out = document.createElement('canvas');
        render(out, 2560);
        out.toBlob(
            (blob) => {
                if (blob)
                    onDone(
                        new File(
                            [blob],
                            file.name.replace(/\.\w+$/, '') + '.jpg',
                            { type: 'image/jpeg' },
                        ),
                    );
            },
            'image/jpeg',
            0.92,
        );
    };

    const slider = (key: keyof Adjust, label: string) => (
        <label className="block text-xs text-white/60">
            <span className="flex justify-between">
                {label}
                <span className="tabular-nums">{adjust[key]}%</span>
            </span>
            <input
                type="range"
                min={50}
                max={150}
                value={adjust[key]}
                onChange={(e) =>
                    setAdjust({ ...adjust, [key]: Number(e.target.value) })
                }
                className="mt-1 w-full accent-gc-indigo"
            />
        </label>
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-2xl">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {tr('Редагувати фото')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/50">
                        {tr('Зміни застосуються лише до цієї копії.')}
                    </DialogDescription>
                </div>
                <div className="flex min-h-48 items-center justify-center rounded-xl bg-black/30 p-2">
                    {image ? (
                        <canvas
                            ref={canvas}
                            className="max-h-[50dvh] max-w-full rounded-lg"
                        />
                    ) : (
                        <div className="skeleton h-48 w-full rounded-lg" />
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setRotate((r) => (r + 90) % 360)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 text-sm text-white hover:bg-white/[0.11]"
                    >
                        <RotateCw className="size-4" />
                        {tr('Повернути')}
                    </button>
                    <span className="inline-flex items-center gap-1 text-white/50">
                        <Crop className="size-4" />
                    </span>
                    {RATIOS.map((r) => (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => setRatio(r.value)}
                            className={cn(
                                'h-9 rounded-xl px-3 text-sm transition',
                                ratio === r.value
                                    ? 'bg-gc-indigo text-white'
                                    : 'bg-white/[0.06] text-white/70 hover:text-white',
                            )}
                        >
                            {r.key === 'free' ? tr(r.label) : r.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            setRotate(0);
                            setRatio(null);
                            setFilter('none');
                            setAdjust({
                                brightness: 100,
                                contrast: 100,
                                saturate: 100,
                            });
                        }}
                        aria-label={tr('Скинути')}
                        title={tr('Скинути')}
                        className="ml-auto flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 hover:text-white"
                    >
                        <Undo2 className="size-4" />
                    </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {slider('brightness', tr('Яскравість'))}
                    {slider('contrast', tr('Контраст'))}
                    {slider('saturate', tr('Насиченість'))}
                </div>
                <div className="scrollbar-none flex gap-2 overflow-x-auto">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                'shrink-0 rounded-xl p-1 text-center text-[11px] transition',
                                filter === f.key
                                    ? 'bg-gc-indigo/30 text-white'
                                    : 'text-white/60 hover:text-white',
                            )}
                        >
                            <img
                                src={src}
                                alt=""
                                className="size-14 rounded-lg object-cover"
                                style={{ filter: f.css }}
                            />
                            <span className="mt-1 block">{f.label()}</span>
                        </button>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-xl px-4 text-sm text-white/60 hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        disabled={!image}
                        onClick={save}
                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Готово')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

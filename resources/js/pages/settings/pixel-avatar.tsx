import { Head, router } from '@inertiajs/react';
import {
    Eraser,
    FlipHorizontal2,
    PaintBucket,
    Pencil,
    Trash2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SIZE = 16;
const OUT = 512;
const PALETTE = [
    '#0b1020',
    '#ffffff',
    '#94a3b8',
    '#475569',
    '#6366f1',
    '#818cf8',
    '#38bdf8',
    '#22d3ee',
    '#34d399',
    '#a3e635',
    '#facc15',
    '#fb923c',
    '#f87171',
    '#f472b6',
    '#c084fc',
    '#a16207',
];

type Tool = 'pen' | 'eraser' | 'fill';

const empty = () => Array<string | null>(SIZE * SIZE).fill(null);

/** Піксельний аватар 16×16: малюємо в браузері, ставимо як аватар (PNG 512×512). */
export default function PixelAvatar() {
    const [cells, setCells] = useState<(string | null)[]>(empty);
    const [color, setColor] = useState(PALETTE[4]);
    const [tool, setTool] = useState<Tool>('pen');
    const [mirror, setMirror] = useState(true);
    const [background, setBackground] = useState('#1e1b4b');
    const [busy, setBusy] = useState(false);
    const drawing = useRef(false);
    const preview = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const up = () => (drawing.current = false);
        window.addEventListener('pointerup', up);

        return () => window.removeEventListener('pointerup', up);
    }, []);

    useEffect(() => {
        const canvas = preview.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        render(ctx, canvas.width, cells, background);
    }, [cells, background]);

    const paint = (index: number) => {
        const value = tool === 'eraser' ? null : color;
        setCells((current) => {
            if (tool === 'fill') return flood(current, index, value);
            const next = [...current];
            next[index] = value;
            if (mirror) {
                const x = index % SIZE;
                next[index - x + (SIZE - 1 - x)] = value;
            }

            return next;
        });
    };

    const save = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = OUT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        render(ctx, OUT, cells, background);
        canvas.toBlob((blob) => {
            if (!blob) return;
            setBusy(true);
            router.post(
                '/me/avatar',
                {
                    avatar: new File([blob], 'pixel-avatar.png', {
                        type: 'image/png',
                    }),
                },
                { forceFormData: true, onFinish: () => setBusy(false) },
            );
        }, 'image/png');
    };

    const tools: [Tool, LucideIcon, string][] = [
        ['pen', Pencil, tr('Олівець')],
        ['eraser', Eraser, tr('Гумка')],
        ['fill', PaintBucket, tr('Заливка')],
    ];

    return (
        <>
            <Head title={tr('Піксельний аватар')} />
            <div className="mx-auto w-full max-w-4xl px-4 py-6">
                <h1 className="font-display text-2xl font-semibold text-white">
                    {tr('Піксельний аватар')}
                </h1>
                <p className="mt-1 text-sm text-white/50">
                    {tr('Намалюйте себе 16×16 — і поставте на аватар.')}
                </p>
                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_16rem]">
                    <div
                        className="grid aspect-square w-full touch-none overflow-hidden rounded-2xl select-none"
                        style={{
                            gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
                            background,
                        }}
                        onPointerLeave={() => (drawing.current = false)}
                    >
                        {cells.map((cell, i) => (
                            <div
                                key={i}
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    drawing.current = true;
                                    paint(i);
                                }}
                                onPointerEnter={() =>
                                    drawing.current &&
                                    tool !== 'fill' &&
                                    paint(i)
                                }
                                className="border-[0.5px] border-white/[0.04]"
                                style={{ background: cell ?? 'transparent' }}
                            />
                        ))}
                    </div>
                    <div className="space-y-4">
                        <canvas
                            ref={preview}
                            width={128}
                            height={128}
                            className="mx-auto size-32 rounded-full"
                            style={{ imageRendering: 'pixelated' }}
                        />
                        <div className="flex gap-1.5">
                            {tools.map(([value, Icon, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setTool(value)}
                                    aria-label={label}
                                    title={label}
                                    className={cn(
                                        'flex size-10 items-center justify-center rounded-xl transition',
                                        tool === value
                                            ? 'bg-gc-indigo text-white'
                                            : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]',
                                    )}
                                >
                                    <Icon className="size-4" />
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setMirror(!mirror)}
                                aria-label={tr('Дзеркально')}
                                title={tr('Дзеркально')}
                                className={cn(
                                    'flex size-10 items-center justify-center rounded-xl transition',
                                    mirror
                                        ? 'bg-gc-indigo/30 text-white'
                                        : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]',
                                )}
                            >
                                <FlipHorizontal2 className="size-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setCells(empty())}
                                aria-label={tr('Очистити')}
                                title={tr('Очистити')}
                                className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 transition hover:bg-rose-500/15 hover:text-rose-200"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-8 gap-1.5">
                            {PALETTE.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                        setColor(value);
                                        if (tool === 'eraser') setTool('pen');
                                    }}
                                    aria-label={value}
                                    className={cn(
                                        'aspect-square rounded-lg transition',
                                        color === value &&
                                            'ring-2 ring-white ring-offset-2 ring-offset-transparent',
                                    )}
                                    style={{ background: value }}
                                />
                            ))}
                        </div>
                        <label className="flex items-center justify-between text-sm text-white/70">
                            {tr('Свій колір')}
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="h-8 w-12 rounded"
                            />
                        </label>
                        <label className="flex items-center justify-between text-sm text-white/70">
                            {tr('Фон')}
                            <input
                                type="color"
                                value={background}
                                onChange={(e) => setBackground(e.target.value)}
                                className="h-8 w-12 rounded"
                            />
                        </label>
                        <button
                            type="button"
                            disabled={busy || cells.every((c) => c === null)}
                            onClick={save}
                            className="btn-glow inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                        >
                            <Upload className="size-4" />
                            {tr('Поставити на аватар')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

function render(
    ctx: CanvasRenderingContext2D,
    size: number,
    cells: (string | null)[],
    background: string,
) {
    const px = size / SIZE;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    cells.forEach((cell, i) => {
        if (!cell) return;
        ctx.fillStyle = cell;
        ctx.fillRect(
            (i % SIZE) * px,
            Math.floor(i / SIZE) * px,
            Math.ceil(px),
            Math.ceil(px),
        );
    });
}

/** Заливка суцільної області одного кольору. */
function flood(cells: (string | null)[], start: number, value: string | null) {
    const target = cells[start];
    if (target === value) return cells;
    const next = [...cells];
    const stack = [start];
    while (stack.length) {
        const i = stack.pop()!;
        if (next[i] !== target) continue;
        next[i] = value;
        const x = i % SIZE;
        if (x > 0) stack.push(i - 1);
        if (x < SIZE - 1) stack.push(i + 1);
        if (i >= SIZE) stack.push(i - SIZE);
        if (i < SIZE * (SIZE - 1)) stack.push(i + SIZE);
    }

    return next;
}

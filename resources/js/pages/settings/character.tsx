import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Dices, ImageUp, Mic, MicOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Character } from '@/components/character/character';
import {
    ACCESSORIES,
    BG_COLORS,
    BROW_PRESETS,
    EYE_COLOR_PALETTES,
    EYE_SHAPES,
    FACIAL_HAIR_PRESETS,
    HAIR_COLORS,
    HAIR_PRESETS,
    HEAD_SHAPES,
    LIP_TINTS,
    MOUTH_PRESETS,
    NOSE_PRESETS,
    OUTFIT_COLORS,
    OUTFIT_PRESETS,
    PUPILS,
    SKIN_PALETTES,
} from '@/components/character/geometry';
import {
    createVoiceMeter,
    normalizeCharacter,
    randomCharacter,
} from '@/lib/character';
import type {
    CharacterConfig,
    CharacterPart,
    VoiceReading,
} from '@/lib/character';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Zoom = 'card' | 'body';

/** Група карток: яка частина, назви варіантів і кадр персонажа в картці. */
type Group = {
    part: CharacterPart;
    names: string[];
    zoom: Zoom;
    title?: string;
};

type Tab = { key: string; label: string; groups: Group[] };

const names = (list: { name: string }[]) => list.map((x) => x.name);

const TABS: Tab[] = [
    {
        key: 'skin',
        label: 'Шкіра',
        groups: [{ part: 'skin', names: names(SKIN_PALETTES), zoom: 'card' }],
    },
    {
        key: 'head',
        label: 'Голова',
        groups: [{ part: 'head', names: names(HEAD_SHAPES), zoom: 'card' }],
    },
    {
        key: 'hair',
        label: 'Зачіска',
        groups: [{ part: 'hair', names: names(HAIR_PRESETS), zoom: 'card' }],
    },
    {
        key: 'hairColor',
        label: 'Колір волосся',
        groups: [
            { part: 'hairColor', names: names(HAIR_COLORS), zoom: 'card' },
        ],
    },
    {
        key: 'eyes',
        label: 'Очі',
        groups: [{ part: 'eyes', names: names(EYE_SHAPES), zoom: 'card' }],
    },
    {
        key: 'eyeColor',
        label: 'Колір очей',
        groups: [
            {
                part: 'eyeColor',
                names: names(EYE_COLOR_PALETTES),
                zoom: 'card',
            },
        ],
    },
    {
        key: 'brows',
        label: 'Брови',
        groups: [{ part: 'brows', names: names(BROW_PRESETS), zoom: 'card' }],
    },
    {
        key: 'nose',
        label: 'Ніс',
        groups: [{ part: 'nose', names: names(NOSE_PRESETS), zoom: 'card' }],
    },
    {
        key: 'mouth',
        label: 'Рот',
        groups: [{ part: 'mouth', names: names(MOUTH_PRESETS), zoom: 'card' }],
    },
    {
        key: 'facialHair',
        label: 'Борода',
        groups: [
            {
                part: 'facialHair',
                names: names(FACIAL_HAIR_PRESETS),
                zoom: 'card',
            },
        ],
    },
    {
        key: 'extra',
        label: 'Аксесуари',
        groups: [{ part: 'extra', names: names(ACCESSORIES), zoom: 'card' }],
    },
    {
        key: 'outfit',
        label: 'Одяг і тло',
        groups: [
            {
                part: 'outfit',
                names: names(OUTFIT_PRESETS),
                zoom: 'body',
                title: 'Одяг',
            },
            {
                part: 'outfitColor',
                names: OUTFIT_COLORS.map((_, i) => `${i + 1}`),
                zoom: 'body',
                title: 'Колір одягу',
            },
            {
                part: 'bg',
                names: BG_COLORS.map((_, i) => `${i + 1}`),
                zoom: 'body',
                title: 'Тло',
            },
        ],
    },
];

const LIP_NAMES = [
    'Природний',
    'Рожевий',
    'Червоний',
    'Ягідний',
    'Нюд',
    'Темний',
];

/**
 * Конструктор персонажа в стилі Stereo: велике живе превью на темному тлі з «Перемішати» та перевіркою
 * голосом, горизонтальні вкладки й сітка 3×N, де кожна картка — поточний персонаж із заміненою лише
 * однією частиною. Форма й колір незалежні (очі: форма, зіниця, колір, гетерохромія).
 */
export default function CharacterEditor({
    character,
}: {
    character: Partial<CharacterConfig> | null;
}) {
    const [config, setConfig] = useState<CharacterConfig>(() =>
        normalizeCharacter(character),
    );
    const [tab, setTab] = useState(TABS[2].key);
    const [eyeSide, setEyeSide] = useState<'left' | 'right'>('left');
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const meterRef = useRef<ReturnType<typeof createVoiceMeter> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const saved = JSON.stringify(normalizeCharacter(character));
    const dirty = character === null || JSON.stringify(config) !== saved;
    const set = (patch: Partial<CharacterConfig>) =>
        setConfig((c) => ({ ...c, ...patch }));

    const stopVoice = useCallback(() => {
        meterRef.current?.stop();
        meterRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setListening(false);
    }, []);

    useEffect(() => stopVoice, [stopVoice]);

    const toggleVoice = async () => {
        if (listening) {
            stopVoice();

            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });
            streamRef.current = stream;
            meterRef.current = createVoiceMeter(stream);
            setListening(true);
        } catch {
            toast.error(tr('Немає доступу до мікрофона'));
        }
    };

    const meter = useCallback(
        (): VoiceReading | null => meterRef.current?.read() ?? null,
        [],
    );

    const save = () => {
        setBusy(true);
        router.put(
            '/me/character',
            { character: config },
            { preserveScroll: true, onFinish: () => setBusy(false) },
        );
    };

    /** Персонаж → PNG 512×512 → звичайне завантаження аватара. */
    const setAsPhoto = () => {
        const node = previewRef.current?.querySelector('svg');
        if (!node) return;
        const copy = node.cloneNode(true) as SVGSVGElement;
        copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        copy.setAttribute('width', '512');
        copy.setAttribute('height', '512');
        const svg = new XMLSerializer().serializeToString(copy);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 512;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = BG_COLORS[config.bg] ?? '#121214';
            ctx.fillRect(0, 0, 512, 512);
            ctx.drawImage(img, 0, 0, 512, 512);
            canvas.toBlob((blob) => {
                if (!blob) return;
                setBusy(true);
                router.post(
                    '/me/avatar',
                    {
                        avatar: new File([blob], 'character.png', {
                            type: 'image/png',
                        }),
                    },
                    { forceFormData: true, onFinish: () => setBusy(false) },
                );
            }, 'image/png');
        };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    };

    const current = TABS.find((t) => t.key === tab) ?? TABS[0];
    const groups = current.groups.map((g) =>
        g.part === 'eyeColor' && config.hetero && eyeSide === 'right'
            ? { ...g, part: 'eyeColorRight' as CharacterPart }
            : g,
    );

    return (
        <>
            <Head title={tr('Персонаж')} />
            <div className="mx-auto w-full max-w-3xl px-2 py-4 sm:px-4">
                <div className="mb-3 flex items-center gap-2">
                    <Link
                        href="/settings/profile"
                        aria-label={tr('Назад')}
                        className="grid size-10 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <h1 className="flex-1 font-display text-xl font-bold text-white">
                        {tr('Персонаж')}
                    </h1>
                    <button
                        type="button"
                        onClick={setAsPhoto}
                        disabled={busy}
                        className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/75 hover:text-white disabled:opacity-40"
                    >
                        <ImageUp className="size-4" />
                        <span className="hidden sm:inline">
                            {tr('На аватар')}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || !dirty}
                        className="h-10 rounded-xl px-4 text-sm font-bold text-primary disabled:opacity-40"
                    >
                        {tr('Готово')}
                    </button>
                </div>

                <section
                    data-on-dark
                    className="overflow-hidden rounded-3xl bg-[#121214]"
                >
                    {/* Превью: велике живе обличчя */}
                    <div className="relative flex h-[42vh] min-h-72 items-center justify-center">
                        <motion.div
                            ref={previewRef}
                            key={JSON.stringify(config)}
                            initial={
                                reduce ? false : { scale: 0.97, opacity: 0.85 }
                            }
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                                type: 'spring',
                                stiffness: 360,
                                damping: 26,
                            }}
                            className="aspect-[300/320] h-full max-h-[22rem]"
                        >
                            <Character
                                config={config}
                                meter={listening ? meter : null}
                                background={false}
                                title={tr('Ваш персонаж')}
                                className="size-full"
                            />
                        </motion.div>
                        <button
                            type="button"
                            onClick={() => setConfig(randomCharacter())}
                            aria-label={tr('Перемішати')}
                            title={tr('Перемішати')}
                            className="absolute bottom-4 left-4 grid size-12 place-items-center rounded-full bg-white text-[#121214] transition active:scale-95"
                        >
                            <Dices className="size-5" />
                        </button>
                        <button
                            type="button"
                            onClick={toggleVoice}
                            aria-pressed={listening}
                            aria-label={
                                listening
                                    ? tr('Вимкнути мікрофон')
                                    : tr('Перевірити голосом')
                            }
                            title={
                                listening
                                    ? tr('Вимкнути мікрофон')
                                    : tr('Перевірити голосом')
                            }
                            className={cn(
                                'absolute right-4 bottom-4 grid size-12 place-items-center rounded-full transition active:scale-95',
                                listening
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-white/10 text-white hover:bg-white/15',
                            )}
                        >
                            {listening ? (
                                <MicOff className="size-5" />
                            ) : (
                                <Mic className="size-5" />
                            )}
                        </button>
                    </div>

                    {/* Вкладки */}
                    <nav
                        aria-label={tr('Частини персонажа')}
                        className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-2"
                    >
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                aria-pressed={tab === t.key}
                                className={cn(
                                    'relative h-11 shrink-0 px-3 text-sm transition',
                                    tab === t.key
                                        ? 'font-semibold text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                {tr(t.label)}
                                {tab === t.key && (
                                    <motion.span
                                        layoutId="stereo-tab"
                                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white"
                                    />
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="space-y-4 p-3">
                        <Toolbar
                            tab={tab}
                            config={config}
                            set={set}
                            eyeSide={eyeSide}
                            setEyeSide={setEyeSide}
                        />
                        {groups.map((g) => (
                            <div key={g.part}>
                                {g.title && (
                                    <p className="mb-2 px-1 text-xs font-semibold text-white/50">
                                        {tr(g.title)}
                                    </p>
                                )}
                                <div className="grid grid-cols-3 gap-2">
                                    {g.names.map((name, i) => (
                                        <button
                                            key={name + i}
                                            type="button"
                                            onClick={() =>
                                                set({
                                                    [g.part]: i,
                                                } as Partial<CharacterConfig>)
                                            }
                                            aria-label={
                                                /^\d+$/.test(name)
                                                    ? `${tr(g.title ?? current.label)} ${name}`
                                                    : tr(name)
                                            }
                                            aria-pressed={config[g.part] === i}
                                            className={cn(
                                                'flex aspect-square flex-col items-center justify-between rounded-2xl bg-[#1C1C1F] p-2 transition',
                                                config[g.part] === i
                                                    ? 'ring-2 ring-white'
                                                    : 'hover:bg-[#232328]',
                                            )}
                                        >
                                            <Character
                                                config={{
                                                    ...config,
                                                    [g.part]: i,
                                                }}
                                                background={g.part === 'bg'}
                                                outfit={g.zoom === 'body'}
                                                zoom={g.zoom}
                                                className="h-[78%] w-full overflow-visible"
                                            />
                                            {!/^\d+$/.test(name) && (
                                                <span className="mt-1 w-full truncate text-center text-xs text-zinc-300">
                                                    {tr(name)}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

function Chip({
    on,
    onClick,
    children,
}: {
    on: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={on}
            className={cn(
                'h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition',
                on
                    ? 'bg-white text-[#121214]'
                    : 'bg-white/[0.08] text-white/75 hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

/** Додаткові перемикачі вкладки: веснянки/рум’янець, омбре, зіниця, гетерохромія, відтінок губ. */
function Toolbar({
    tab,
    config,
    set,
    eyeSide,
    setEyeSide,
}: {
    tab: string;
    config: CharacterConfig;
    set: (patch: Partial<CharacterConfig>) => void;
    eyeSide: 'left' | 'right';
    setEyeSide: (side: 'left' | 'right') => void;
}) {
    const row = (children: ReactNode) => (
        <div className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1">
            {children}
        </div>
    );

    switch (tab) {
        case 'skin':
            return row(
                <>
                    <Chip
                        on={config.freckles === 1}
                        onClick={() =>
                            set({ freckles: config.freckles ? 0 : 1 })
                        }
                    >
                        {tr('Веснянки')}
                    </Chip>
                    <Chip
                        on={config.blush === 1}
                        onClick={() => set({ blush: config.blush ? 0 : 1 })}
                    >
                        {tr('Рум’янець')}
                    </Chip>
                </>,
            );
        case 'hairColor':
            return row(
                <Chip
                    on={config.hairOmbre === 1}
                    onClick={() => set({ hairOmbre: config.hairOmbre ? 0 : 1 })}
                >
                    {tr('Омбре')}
                </Chip>,
            );
        case 'eyes':
            return row(
                PUPILS.map((p, i) => (
                    <Chip
                        key={p.id}
                        on={config.pupil === i}
                        onClick={() => set({ pupil: i })}
                    >
                        {tr(p.name)}
                    </Chip>
                )),
            );
        case 'eyeColor':
            return row(
                <>
                    <Chip
                        on={config.hetero === 1}
                        onClick={() => set({ hetero: config.hetero ? 0 : 1 })}
                    >
                        {tr('Гетерохромія')}
                    </Chip>
                    {config.hetero === 1 && (
                        <>
                            <Chip
                                on={eyeSide === 'left'}
                                onClick={() => setEyeSide('left')}
                            >
                                {tr('Ліве око')}
                            </Chip>
                            <Chip
                                on={eyeSide === 'right'}
                                onClick={() => setEyeSide('right')}
                            >
                                {tr('Праве око')}
                            </Chip>
                        </>
                    )}
                </>,
            );
        case 'mouth':
            return row(
                LIP_TINTS.map((c, i) => (
                    <Chip
                        key={c}
                        on={config.lipTint === i}
                        onClick={() => set({ lipTint: i })}
                    >
                        <span className="inline-flex items-center gap-1.5">
                            {c !== 'natural' && (
                                <span
                                    className="size-3 rounded-full"
                                    style={{ background: c }}
                                />
                            )}
                            {tr(LIP_NAMES[i])}
                        </span>
                    </Chip>
                )),
            );
        default:
            return null;
    }
}

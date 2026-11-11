import { Head, router } from '@inertiajs/react';
import { ImageUp, Mic, MicOff, Save, Shuffle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Character } from '@/components/character/character';
import {
    BG,
    createVoiceMeter,
    EYE,
    HAIR,
    normalizeCharacter,
    OUTFIT,
    PARTS,
    randomCharacter,
    SKIN,
} from '@/lib/character';
import type {
    CharacterConfig,
    CharacterPart,
    VoiceReading,
} from '@/lib/character';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Вкладки конструктора: частина й (для кольорів) палітра. */
const TABS: {
    part: CharacterPart;
    label: string;
    colors?: string[];
    face?: boolean;
}[] = [
    { part: 'hair', label: 'Зачіска' },
    { part: 'hairColor', label: 'Колір волосся', colors: HAIR },
    { part: 'build', label: 'Тілобудова' },
    { part: 'head', label: 'Форма обличчя' },
    { part: 'skin', label: 'Шкіра', colors: SKIN },
    { part: 'eyes', label: 'Форма очей', face: true },
    { part: 'eyeTilt', label: 'Розріз очей', face: true },
    { part: 'eyeColor', label: 'Колір очей', colors: EYE },
    { part: 'lashes', label: 'Вії', face: true },
    { part: 'brows', label: 'Брови', face: true },
    { part: 'nose', label: 'Ніс', face: true },
    { part: 'lips', label: 'Форма губ', face: true },
    { part: 'lipColor', label: 'Колір губ', face: true },
    { part: 'mouth', label: 'Вираз', face: true },
    { part: 'makeup', label: 'Макіяж', face: true },
    { part: 'tattoo', label: 'Тату' },
    { part: 'beard', label: 'Борода' },
    { part: 'earrings', label: 'Сережки' },
    { part: 'extra', label: 'Аксесуари' },
    { part: 'outfit', label: 'Одяг' },
    { part: 'outfitColor', label: 'Колір одягу', colors: OUTFIT },
    { part: 'bg', label: 'Тло', colors: BG },
];

/**
 * Конструктор персонажа: великий перегляд угорі, «Перемішати», перевірка голосом
 * (персонаж відкриває рот під ваш мікрофон), вкладки частин і сітка варіантів.
 */
export default function CharacterEditor({
    character,
}: {
    character: Partial<CharacterConfig> | null;
}) {
    const [config, setConfig] = useState<CharacterConfig>(() =>
        normalizeCharacter(character),
    );
    const [tab, setTab] = useState<CharacterPart>('hair');
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const meterRef = useRef<ReturnType<typeof createVoiceMeter> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const reduce = useReducedMotion();
    const previewRef = useRef<HTMLDivElement>(null);
    const saved = JSON.stringify(normalizeCharacter(character));
    const dirty = character === null || JSON.stringify(config) !== saved;

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
            canvas.getContext('2d')?.drawImage(img, 0, 0, 512, 512);
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

    const current = TABS.find((t) => t.part === tab) ?? TABS[0];

    return (
        <>
            <Head title={tr('Персонаж')} />
            <div className="mx-auto w-full max-w-4xl px-4 py-6">
                <h1 className="font-display text-2xl font-semibold text-white">
                    {tr('Персонаж')}
                </h1>
                <p className="mt-1 text-sm text-white/50">
                    {tr(
                        'Зберіть себе з частин. У шоу персонаж говорить вашим голосом: відкриває рот і рухає головою в такт.',
                    )}
                </p>

                <section className="gc-solid mt-5 overflow-hidden rounded-2xl">
                    <div
                        data-on-dark
                        className="relative flex flex-col items-center bg-[#0d1424] px-4 pt-6 pb-4"
                    >
                        <motion.div
                            ref={previewRef}
                            key={JSON.stringify(config)}
                            initial={reduce ? false : { scale: 0.96 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: 'spring',
                                stiffness: 380,
                                damping: 24,
                            }}
                            className="size-52 overflow-hidden rounded-full sm:size-60"
                        >
                            <Character
                                config={config}
                                meter={listening ? meter : null}
                                title={tr('Ваш персонаж')}
                                className="size-full"
                            />
                        </motion.div>
                        <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setConfig(randomCharacter())}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
                            >
                                <Shuffle className="size-4" />
                                {tr('Перемішати')}
                            </button>
                            <button
                                type="button"
                                onClick={toggleVoice}
                                aria-pressed={listening}
                                className={cn(
                                    'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white',
                                    listening
                                        ? 'bg-rose-500/80 hover:bg-rose-500'
                                        : 'bg-white/10 hover:bg-white/15',
                                )}
                            >
                                {listening ? (
                                    <MicOff className="size-4" />
                                ) : (
                                    <Mic className="size-4" />
                                )}
                                {listening
                                    ? tr('Вимкнути мікрофон')
                                    : tr('Перевірити голосом')}
                            </button>
                        </div>
                    </div>

                    <nav
                        aria-label={tr('Частини персонажа')}
                        className="flex [scrollbar-width:none] gap-1 overflow-x-auto px-2 pt-2"
                    >
                        {TABS.map((t) => (
                            <button
                                key={t.part}
                                type="button"
                                onClick={() => setTab(t.part)}
                                aria-pressed={tab === t.part}
                                className={cn(
                                    'relative h-10 shrink-0 rounded-xl px-3 text-sm transition',
                                    tab === t.part
                                        ? 'font-semibold text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {tr(t.label)}
                                {tab === t.part && (
                                    <motion.span
                                        layoutId="character-tab"
                                        className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-primary"
                                    />
                                )}
                            </button>
                        ))}
                    </nav>

                    <div className="p-3">
                        {current.colors ? (
                            <div className="flex flex-wrap gap-2.5 p-1">
                                {current.colors.map((c, i) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() =>
                                            setConfig({ ...config, [tab]: i })
                                        }
                                        aria-label={`${tr(current.label)} ${i + 1}`}
                                        aria-pressed={config[tab] === i}
                                        className={cn(
                                            'size-11 rounded-full transition',
                                            config[tab] === i
                                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--gc-l1,transparent)]'
                                                : 'hover:scale-105',
                                        )}
                                        style={{ background: c }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                                {Array.from(
                                    { length: PARTS[tab] },
                                    (_, i) => i,
                                ).map((i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() =>
                                            setConfig({ ...config, [tab]: i })
                                        }
                                        aria-label={`${tr(current.label)} ${i + 1}`}
                                        aria-pressed={config[tab] === i}
                                        className={cn(
                                            'aspect-square overflow-hidden rounded-2xl transition',
                                            config[tab] === i
                                                ? 'ring-2 ring-primary'
                                                : 'opacity-85 hover:opacity-100',
                                        )}
                                    >
                                        <Character
                                            config={{ ...config, [tab]: i }}
                                            zoom={
                                                current.face
                                                    ? 'face'
                                                    : undefined
                                            }
                                            className="size-full"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy || !dirty}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                        <Save className="size-4" />
                        {tr('Зберегти персонажа')}
                    </button>
                    <button
                        type="button"
                        onClick={setAsPhoto}
                        disabled={busy}
                        className="gc-solid-2 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                        <ImageUp className="size-4" />
                        {tr('Поставити на аватар')}
                    </button>
                </div>
            </div>
        </>
    );
}

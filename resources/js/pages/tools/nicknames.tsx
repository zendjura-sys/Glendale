import { Head } from '@inertiajs/react';
import { Copy, RefreshCw, Shield, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const STYLES = {
    cyber: {
        label: () => tr('Кібер'),
        a: [
            'Neo',
            'Hex',
            'Byte',
            'Glitch',
            'Volt',
            'Zero',
            'Cyber',
            'Pixel',
            'Nano',
            'Synth',
            'Flux',
            'Static',
        ],
        b: [
            'Runner',
            'Ghost',
            'Core',
            'Pulse',
            'Wire',
            'Shade',
            'Drift',
            'Node',
            'Spark',
            'Byte',
            'Viper',
            'Echo',
        ],
    },
    fantasy: {
        label: () => tr('Фентезі'),
        a: [
            'Shadow',
            'Storm',
            'Frost',
            'Iron',
            'Raven',
            'Ember',
            'Moon',
            'Thorn',
            'Ash',
            'Silver',
            'Wild',
            'Dusk',
        ],
        b: [
            'blade',
            'heart',
            'wolf',
            'fang',
            'born',
            'whisper',
            'warden',
            'song',
            'spire',
            'claw',
            'mane',
            'veil',
        ],
    },
    ua: {
        label: () => tr('Українське'),
        a: [
            'Kozak',
            'Vovk',
            'Sokil',
            'Grim',
            'Bureviy',
            'Zhar',
            'Lys',
            'Charivnyk',
            'Kharakternyk',
            'Dub',
            'Mavka',
            'Vedmid',
        ],
        b: [
            'UA',
            'Kyiv',
            'Lviv',
            'Steppe',
            'Dnipro',
            'Volya',
            'Karpaty',
            'Sich',
            'Polissia',
            'Zoria',
            'Grom',
            'Viter',
        ],
    },
    funny: {
        label: () => tr('Смішне'),
        a: [
            'Lazy',
            'Sneaky',
            'Angry',
            'Sleepy',
            'Crispy',
            'Salty',
            'Laggy',
            'Noob',
            'Tilted',
            'Spicy',
            'Chill',
            'Wobbly',
        ],
        b: [
            'Potato',
            'Varenyk',
            'Toaster',
            'Pelmen',
            'Cactus',
            'Banana',
            'Duck',
            'Borscht',
            'Kitten',
            'Pancake',
            'Goose',
            'Dumpling',
        ],
    },
} as const;

type Style = keyof typeof STYLES;

const CLAN_A = [
    'Iron',
    'Night',
    'Crimson',
    'Silent',
    'Frost',
    'Golden',
    'Black',
    'Steel',
    'Wild',
    'Storm',
    'Neon',
    'Ghost',
];
const CLAN_B = [
    'Wolves',
    'Legion',
    'Ravens',
    'Order',
    'Guard',
    'Syndicate',
    'Hunters',
    'Phoenix',
    'Vipers',
    'Titans',
    'Rebels',
    'Kozaky',
];

const pick = <T,>(list: readonly T[]) =>
    list[Math.floor(Math.random() * list.length)];

function nick(style: Style, seed: string): string {
    const s = STYLES[style];
    const base = seed.trim() ? seed.trim().replace(/\s+/g, '') : pick(s.a);
    const variants = [
        `${base}${pick(s.b)}`,
        `${pick(s.a)}${base === pick(s.a) ? pick(s.b) : base}`,
        `${base}_${pick(s.b)}`,
        `${base}${Math.floor(Math.random() * 90) + 10}`,
        `x${base}${pick(s.b)}x`,
    ];

    return pick(variants).slice(0, 20);
}

function clan(): { name: string; tag: string } {
    const name = `${pick(CLAN_A)} ${pick(CLAN_B)}`;
    const tag =
        name
            .split(' ')
            .map((w) => w[0])
            .join('') + pick(['', 'X', 'Z', 'UA', '']);

    return { name, tag: tag.toUpperCase().slice(0, 5) };
}

/** Генератор ніків і назв кланів: усе в браузері, сервер лише каже, чи вільна адреса. */
export default function Nicknames() {
    const [style, setStyle] = useState<Style>('cyber');
    const [seed, setSeed] = useState('');
    const [nicks, setNicks] = useState<string[]>([]);
    const [free, setFree] = useState<string[] | null>(null);
    const [clans, setClans] = useState<{ name: string; tag: string }[]>([]);

    const roll = useCallback(() => {
        const list = Array.from(
            new Set(Array.from({ length: 16 }, () => nick(style, seed))),
        ).slice(0, 12);
        setNicks(list);
        setFree(null);
        void api<{ free: string[] }>('POST', '/tools/nicknames/check', {
            names: list,
        })
            .then((d) => setFree(d.free))
            .catch(() => setFree(null));
    }, [style, seed]);

    useEffect(() => roll(), [roll]);
    useEffect(() => setClans(Array.from({ length: 6 }, clan)), []);

    const copy = (text: string) => {
        void navigator.clipboard?.writeText(text);
        toast.success(tr('Скопійовано'));
    };

    return (
        <>
            <Head title={tr('Генератор ніків')} />
            <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-white">
                        {tr('Генератор ніків')}
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Нік для гри й назва клану з тегом. Позначка «вільна» — адреса на GameCon не зайнята.',
                        )}
                    </p>
                </div>
                <section className="glass space-y-3 rounded-2xl p-4">
                    <div className="flex flex-wrap gap-2">
                        {(Object.keys(STYLES) as Style[]).map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setStyle(key)}
                                className={cn(
                                    'h-8 rounded-chip px-3 text-[13px] font-medium transition',
                                    style === key
                                        ? 'bg-white/12 text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                {STYLES[key].label()}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={seed}
                            onChange={(e) =>
                                setSeed(e.target.value.replace(/[^\w]/g, ''))
                            }
                            placeholder={tr(
                                'Своє слово (необовʼязково, латиницею)',
                            )}
                            maxLength={12}
                            className="input-glass h-10 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30"
                        />
                        <button
                            type="button"
                            onClick={roll}
                            aria-label={tr('Ще варіанти')}
                            className="flex size-10 items-center justify-center rounded-xl bg-white/[0.07] text-white hover:bg-white/[0.11]"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {nicks.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => copy(n)}
                                className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/[0.08]"
                            >
                                <UserRound className="size-4 text-white/40" />
                                <span className="flex-1 truncate font-medium">
                                    {n}
                                </span>
                                {free?.includes(n.toLowerCase()) && (
                                    <span className="text-xs text-emerald-300">
                                        {tr('вільна')}
                                    </span>
                                )}
                                <Copy className="size-3.5 text-white/35" />
                            </button>
                        ))}
                    </div>
                </section>
                <section className="glass space-y-3 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                            <Shield className="size-4 text-gc-lilac-300" />
                            {tr('Назва клану')}
                        </h2>
                        <button
                            type="button"
                            onClick={() =>
                                setClans(Array.from({ length: 6 }, clan))
                            }
                            aria-label={tr('Ще варіанти')}
                            className="flex size-9 items-center justify-center rounded-xl bg-white/[0.07] text-white hover:bg-white/[0.11]"
                        >
                            <RefreshCw className="size-4" />
                        </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {clans.map((c) => (
                            <button
                                key={c.name + c.tag}
                                type="button"
                                onClick={() => copy(`[${c.tag}] ${c.name}`)}
                                className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white transition hover:bg-white/[0.08]"
                            >
                                <span className="rounded-md bg-gc-indigo/30 px-1.5 py-0.5 font-mono text-xs font-bold">
                                    {c.tag}
                                </span>
                                <span className="flex-1 truncate">
                                    {c.name}
                                </span>
                                <Copy className="size-3.5 text-white/35" />
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

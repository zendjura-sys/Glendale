import { Head, useForm } from '@inertiajs/react';
import {
    Check,
    Gamepad2,
    ImagePlus,
    Loader2,
    Search,
    Swords,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';
import { tr } from '@/lib/i18n';

type Feature = { label: string; text: string };

type Props = {
    types: Record<'clan' | 'guild', string>;
    features: Record<string, Feature>;
    default_features: string[];
    join_modes: Record<string, string>;
    game: GameCard | null;
};

const input =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Вибір гри з каталогу з пошуком. */
function GamePicker({
    value,
    onChange,
}: {
    value: GameCard | null;
    onChange: (game: GameCard) => void;
}) {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<GameCard[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(true);
            void api<{ games: GameCard[] }>(
                'GET',
                `/games/search?q=${encodeURIComponent(q)}`,
            )
                .then((d) => setResults(d.games))
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        }, 250);

        return () => clearTimeout(timer);
    }, [q]);

    return (
        <div>
            <label className="input-glass flex h-11 items-center gap-2 rounded-xl px-3">
                {loading ? (
                    <Loader2 className="size-4 animate-spin text-white/40" />
                ) : (
                    <Search className="size-4 text-white/35" />
                )}
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={tr('Знайти гру: CS2, PUBG Mobile, Dota 2…')}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
            </label>
            <div className="mt-2 grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {results.map((g) => (
                    <button
                        key={g.id}
                        type="button"
                        onClick={() => onChange(g)}
                        className={cn(
                            'flex items-center gap-2.5 rounded-xl p-2 text-left transition',
                            value?.id === g.id
                                ? 'bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]'
                                : 'bg-white/[0.03] hover:bg-white/[0.07]',
                        )}
                    >
                        <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-white/10">
                            {g.cover ? (
                                <img
                                    src={g.cover}
                                    alt=""
                                    className="size-full object-cover"
                                />
                            ) : (
                                <Gamepad2 className="m-2.5 size-5 text-white/50" />
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">
                                {g.name}
                            </span>
                            <span className="block truncate text-[11px] text-white/45">
                                {g.platforms
                                    .map((p) => p.label)
                                    .slice(0, 3)
                                    .join(' · ')}
                            </span>
                        </span>
                        {value?.id === g.id && (
                            <Check className="size-4 text-[#a5b4fc]" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Створення клану або гільдії: тип (префікс у назві), гра, розділи на вибір. */
export default function ClanCreate({
    types,
    features,
    default_features,
    join_modes,
    game: preset,
}: Props) {
    const [game, setGame] = useState<GameCard | null>(preset);
    const form = useForm<{
        type: 'clan' | 'guild';
        name: string;
        tag: string;
        game_id: number | null;
        description: string;
        features: string[];
        join_mode: string;
        logo: File | null;
    }>({
        type: 'clan',
        name: '',
        tag: '',
        game_id: preset?.id ?? null,
        description: '',
        features: default_features,
        join_mode: 'request',
        logo: null,
    });
    const { data, setData, errors } = form;

    const toggle = (key: string) =>
        setData(
            'features',
            data.features.includes(key)
                ? data.features.filter((f) => f !== key)
                : [...data.features, key],
        );

    return (
        <>
            <Head title={tr('Новий клан')} />
            <h1 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold text-white">
                <Swords className="size-6 text-[#a5b4fc]" />{' '}
                {tr('Новий клан або гільдія')}
            </h1>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/clans', { forceFormData: true });
                }}
                className="space-y-4"
            >
                <section className="glass rounded-3xl p-4 sm:p-5">
                    <h2 className="mb-3 text-sm font-semibold text-white/80">
                        {tr('1. Тип')}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(types) as ('clan' | 'guild')[]).map(
                            (t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setData('type', t)}
                                    className={cn(
                                        'rounded-2xl p-4 text-left transition',
                                        data.type === t
                                            ? 'bg-gradient-brand text-white'
                                            : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.07]',
                                    )}
                                >
                                    <span className="block font-display text-base font-semibold">
                                        {types[t]}
                                    </span>
                                    <span className="block text-xs opacity-80">
                                        {tr('Назва: [')}
                                        {types[t]}] {data.name || tr('Назва')}
                                    </span>
                                </button>
                            ),
                        )}
                    </div>
                </section>

                <section className="glass rounded-3xl p-4 sm:p-5">
                    <h2 className="mb-3 text-sm font-semibold text-white/80">
                        {tr('2. Гра')}{' '}
                        {game && (
                            <span className="text-[#a5b4fc]">
                                — {game.name}
                            </span>
                        )}
                    </h2>
                    <GamePicker
                        value={game}
                        onChange={(g) => {
                            setGame(g);
                            setData('game_id', g.id);
                        }}
                    />
                    {errors.game_id && (
                        <p className="mt-1 text-xs text-rose-300">
                            {errors.game_id}
                        </p>
                    )}
                </section>

                <section className="glass space-y-3 rounded-3xl p-4 sm:p-5">
                    <h2 className="text-sm font-semibold text-white/80">
                        {tr('3. Назва й опис')}
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                        <div>
                            <input
                                value={data.name}
                                maxLength={60}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder={tr('Назва')}
                                className={input}
                            />
                            {errors.name && (
                                <p className="mt-1 text-xs text-rose-300">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                        <div>
                            <input
                                value={data.tag}
                                maxLength={6}
                                onChange={(e) =>
                                    setData('tag', e.target.value.toUpperCase())
                                }
                                placeholder={tr('ТЕГ')}
                                className={cn(input, 'uppercase')}
                            />
                            {errors.tag && (
                                <p className="mt-1 text-xs text-rose-300">
                                    {errors.tag}
                                </p>
                            )}
                        </div>
                    </div>
                    <textarea
                        value={data.description}
                        maxLength={1000}
                        rows={3}
                        onChange={(e) => setData('description', e.target.value)}
                        placeholder={tr(
                            'Про клан: чим займаєтесь, кого шукаєте',
                        )}
                        className="input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/70">
                        <ImagePlus className="size-4" />{' '}
                        {data.logo
                            ? data.logo.name
                            : tr('Логотип (необов’язково)')}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                                setData('logo', e.target.files?.[0] ?? null)
                            }
                        />
                    </label>
                </section>

                <section className="glass rounded-3xl p-4 sm:p-5">
                    <h2 className="mb-1 text-sm font-semibold text-white/80">
                        {tr('4. Що буде в клані')}
                    </h2>
                    <p className="mb-3 text-xs text-white/45">
                        {tr(
                            'Розділи можна змінити пізніше в налаштуваннях клану. Склад, заявки, ранги й права є завжди.',
                        )}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Object.entries(features).map(([key, f]) => {
                            const on = data.features.includes(key);

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggle(key)}
                                    className={cn(
                                        'flex items-start gap-3 rounded-2xl p-3 text-left transition',
                                        on
                                            ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/60'
                                            : 'bg-white/[0.03] hover:bg-white/[0.06]',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                                            on
                                                ? 'border-transparent bg-gradient-brand'
                                                : 'border-white/25',
                                        )}
                                    >
                                        {on && (
                                            <Check className="size-3.5 text-white" />
                                        )}
                                    </span>
                                    <span>
                                        <span className="block text-sm font-semibold text-white">
                                            {f.label}
                                        </span>
                                        <span className="block text-xs text-white/50">
                                            {f.text}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="glass rounded-3xl p-4 sm:p-5">
                    <h2 className="mb-3 text-sm font-semibold text-white/80">
                        {tr('5. Як вступати')}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(join_modes).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setData('join_mode', key)}
                                className={cn(
                                    'rounded-xl px-4 py-2 text-sm transition',
                                    data.join_mode === key
                                        ? 'bg-gradient-brand text-white'
                                        : 'bg-white/[0.05] text-white/65 hover:text-white',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </section>

                <button
                    type="submit"
                    disabled={form.processing || !data.game_id}
                    className="btn-glow inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-50"
                >
                    {form.processing && (
                        <Loader2 className="size-4 animate-spin" />
                    )}
                    {tr('Створити')} {types[data.type].toLowerCase()}
                </button>
            </form>
        </>
    );
}

import { router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Clapperboard, Database, Tv } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pill, Toggle, selectClass } from '@/components/gc/admin';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type PlayersData = {
    config: {
        order: string[];
        disabled: string[];
        labels: Record<string, string>;
        voice_prefer: string[];
        voice_block: string[];
        episodes: boolean;
    };
    providers: {
        key: string;
        label: string;
        configured: boolean;
        sources: number;
    }[];
};

export type TmdbData = {
    config: {
        enabled: boolean;
        fields: string[];
        mode: 'prefer' | 'fill';
        refresh_days: number;
        discover: boolean;
        lists: string[];
        pages: number;
        discover_limit: number;
        min_votes: number;
        min_year: number | null;
        publish: boolean;
    };
    configured: boolean;
    language: string;
    fields: { key: string; label: string }[];
    lists: { key: string; label: string }[];
    tmdb_count: number;
};

/** Список рядків ↔ текст «по одному в рядку». */
const lines = (text: string) =>
    text
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean);

const textarea =
    'input-glass min-h-[88px] w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30';

/** Плеєри: порядок вкладок на сторінці фільму, увімкнення, назви, озвучки. */
export function PlayersPanel({ data }: { data: PlayersData }) {
    const byKey = Object.fromEntries(data.providers.map((p) => [p.key, p]));
    const [order, setOrder] = useState(data.config.order);
    const [disabled, setDisabled] = useState(data.config.disabled);
    const [labels, setLabels] = useState<Record<string, string>>(
        data.config.labels,
    );
    const [prefer, setPrefer] = useState(data.config.voice_prefer.join('\n'));
    const [block, setBlock] = useState(data.config.voice_block.join('\n'));
    const [episodes, setEpisodes] = useState(data.config.episodes);
    const [saving, setSaving] = useState(false);

    const move = (index: number, delta: number) => {
        const next = [...order];
        const [item] = next.splice(index, 1);
        next.splice(index + delta, 0, item);
        setOrder(next);
    };
    const save = (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        router.put(
            '/admin/cinema/players',
            {
                order,
                disabled,
                labels,
                voice_prefer: lines(prefer),
                voice_block: lines(block),
                episodes,
            },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    };

    return (
        <form onSubmit={save} className="glass space-y-4 rounded-3xl p-5">
            <header>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <Tv className="size-5 text-gc-lilac-400" />
                    {tr('Плеєри')}
                </h2>
                <p className="mt-1 text-sm text-white/50">
                    {tr(
                        'Порядок вкладок на сторінці фільму, які плеєри показувати й під якою назвою. Діє одразу для всіх фільмів.',
                    )}
                </p>
            </header>

            <ul className="space-y-2">
                {order.map((key, i) => {
                    const p = byKey[key];
                    const off = disabled.includes(key);

                    return (
                        <li
                            key={key}
                            className={cn(
                                'flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.03] p-3',
                                off && 'opacity-60',
                            )}
                        >
                            <span className="flex flex-col">
                                <button
                                    type="button"
                                    disabled={i === 0}
                                    onClick={() => move(i, -1)}
                                    className="text-white/40 hover:text-white disabled:opacity-20"
                                    title={tr('Вище')}
                                >
                                    <ArrowUp className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    disabled={i === order.length - 1}
                                    onClick={() => move(i, 1)}
                                    className="text-white/40 hover:text-white disabled:opacity-20"
                                    title={tr('Нижче')}
                                >
                                    <ArrowDown className="size-4" />
                                </button>
                            </span>
                            <span className="w-6 text-center text-sm text-white/40 tabular-nums">
                                {i + 1}
                            </span>
                            <span className="min-w-[120px] flex-1">
                                <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white">
                                    {p?.label ?? key}
                                    {p && !p.configured && (
                                        <Pill tone="gold">
                                            {tr('немає ключів')}
                                        </Pill>
                                    )}
                                </span>
                                <span className="text-xs text-white/40">
                                    {tr('{n} озвучок у каталозі', {
                                        n: p?.sources ?? 0,
                                    })}
                                </span>
                            </span>
                            <Input
                                value={labels[key] ?? ''}
                                onChange={(e) =>
                                    setLabels({
                                        ...labels,
                                        [key]: e.target.value,
                                    })
                                }
                                placeholder={tr('Назва вкладки')}
                                className="h-9 w-40"
                            />
                            <Toggle
                                checked={!off}
                                onChange={(on) =>
                                    setDisabled(
                                        on
                                            ? disabled.filter((d) => d !== key)
                                            : [...disabled, key],
                                    )
                                }
                                label={tr('Показувати')}
                            />
                        </li>
                    );
                })}
            </ul>

            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.03] p-4">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                        {tr('Посерійний режим')}
                    </p>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Під плеєром серіалу, аніме чи мультсеріалу — сезони й серії. Обрана серія відкривається окремо в Kodik чи Videoseed (вкладку плеєра глядач обирає сам).',
                        )}
                    </p>
                </div>
                <Toggle
                    checked={episodes}
                    onChange={setEpisodes}
                    label={tr('Посерійний режим')}
                />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs text-white/50">
                    {tr('Улюблені озвучки — першими (по одній у рядку)')}
                    <textarea
                        value={prefer}
                        onChange={(e) => setPrefer(e.target.value)}
                        placeholder={'Українськ\nLostFilm\nHDrezka'}
                        className={textarea}
                    />
                </label>
                <label className="grid gap-1.5 text-xs text-white/50">
                    {tr('Не показувати озвучки, що містять')}
                    <textarea
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        placeholder={'Рекламн\nCAMRip'}
                        className={textarea}
                    />
                </label>
            </div>
            <p className="text-xs text-white/40">
                {tr(
                    'Окрему озвучку можна сховати на сторінці редагування фільму. Глядач може обрати свій плеєр у налаштуваннях — це важливіше за порядок тут.',
                )}
            </p>
            <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
                {tr('Зберегти')}
            </button>
        </form>
    );
}

/** Автопарсинг TMDB: які поля, як часто, звідки брати нові тайтли. */
export function TmdbPanel({ data }: { data: TmdbData }) {
    const form = useForm({ ...data.config, language: data.language });
    const { data: d, setData } = form;
    const toggle = (key: 'fields' | 'lists', value: string) =>
        setData(
            key,
            d[key].includes(value)
                ? d[key].filter((v) => v !== value)
                : [...d[key], value],
        );

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put('/admin/cinema/tmdb', { preserveScroll: true });
            }}
            className="glass space-y-4 rounded-3xl p-5"
        >
            <header className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-white">
                        <Database className="size-5 text-gc-lilac-400" />
                        {tr('Автопарсинг TMDB')}
                        {data.configured ? (
                            <Pill tone="green">
                                {tr('{n} тайтлів з TMDB', {
                                    n: data.tmdb_count,
                                })}
                            </Pill>
                        ) : (
                            <Pill tone="gold">{tr('немає ключа')}</Pill>
                        )}
                    </h2>
                    <p className="mt-1 text-sm text-white/50">
                        {tr(
                            'Описи, постери, жанри й трейлери українською. Працює разом з автонаповненням — за його розкладом.',
                        )}
                    </p>
                </div>
                <Toggle
                    checked={d.enabled}
                    onChange={(v) => setData('enabled', v)}
                    label={tr('Використовувати TMDB')}
                />
            </header>

            <div>
                <p className="mb-2 text-xs font-medium text-white/50">
                    {tr('Що заповнювати')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {data.fields.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => toggle('fields', f.key)}
                            className={cn(
                                'rounded-full border px-3 py-1 text-xs transition',
                                d.fields.includes(f.key)
                                    ? 'border-gc-lilac-400/50 bg-gc-indigo/20 text-white'
                                    : 'border-white/10 text-white/55 hover:text-white',
                            )}
                        >
                            {tr(f.label)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-xs text-white/50">
                    {tr('Режим')}
                    <select
                        value={d.mode}
                        onChange={(e) =>
                            setData('mode', e.target.value as 'prefer' | 'fill')
                        }
                        className={selectClass}
                    >
                        <option value="prefer">{tr('TMDB важливіший')}</option>
                        <option value="fill">{tr('Лише порожні поля')}</option>
                    </select>
                </label>
                <label className="grid gap-1.5 text-xs text-white/50">
                    {tr('Оновлювати старі')}
                    <select
                        value={d.refresh_days}
                        onChange={(e) =>
                            setData('refresh_days', Number(e.target.value))
                        }
                        className={selectClass}
                    >
                        {[0, 7, 14, 30, 90].map((n) => (
                            <option key={n} value={n}>
                                {n === 0
                                    ? tr('Ні')
                                    : tr('Раз на {n} дн.', { n })}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1.5 text-xs text-white/50">
                    {tr('Мова')}
                    <Input
                        value={d.language}
                        onChange={(e) => setData('language', e.target.value)}
                        placeholder="uk-UA"
                    />
                </label>
            </div>
            {form.errors.language && (
                <p className="text-xs text-rose-300">{form.errors.language}</p>
            )}

            <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                    <Clapperboard className="mt-0.5 size-5 shrink-0 text-gc-lilac-400" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                            {tr('Додавати нові тайтли зі списків TMDB')}
                        </p>
                        <p className="text-xs text-white/45">
                            {tr(
                                'Лише якщо для тайтлу знайдено плеєр: Videoseed шукає за ID TMDB, Kodik — за IMDb.',
                            )}
                        </p>
                    </div>
                    <Toggle
                        checked={d.discover}
                        onChange={(v) => setData('discover', v)}
                        label={tr('Автододавання')}
                    />
                </div>
                {d.discover && (
                    <>
                        <div className="flex flex-wrap gap-1.5">
                            {data.lists.map((l) => (
                                <button
                                    key={l.key}
                                    type="button"
                                    onClick={() => toggle('lists', l.key)}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs transition',
                                        d.lists.includes(l.key)
                                            ? 'border-gc-lilac-400/50 bg-gc-indigo/20 text-white'
                                            : 'border-white/10 text-white/55 hover:text-white',
                                    )}
                                >
                                    {tr(l.label)}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <label className="grid gap-1.5 text-xs text-white/50">
                                {tr('Сторінок списку')}
                                <Input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={d.pages}
                                    onChange={(e) =>
                                        setData('pages', Number(e.target.value))
                                    }
                                />
                            </label>
                            <label className="grid gap-1.5 text-xs text-white/50">
                                {tr('Нових за запуск')}
                                <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={d.discover_limit}
                                    onChange={(e) =>
                                        setData(
                                            'discover_limit',
                                            Number(e.target.value),
                                        )
                                    }
                                />
                            </label>
                            <label className="grid gap-1.5 text-xs text-white/50">
                                {tr('Мін. голосів')}
                                <Input
                                    type="number"
                                    min={0}
                                    value={d.min_votes}
                                    onChange={(e) =>
                                        setData(
                                            'min_votes',
                                            Number(e.target.value),
                                        )
                                    }
                                />
                            </label>
                            <label className="grid gap-1.5 text-xs text-white/50">
                                {tr('Не старші за рік')}
                                <Input
                                    type="number"
                                    min={1900}
                                    max={2100}
                                    value={d.min_year ?? ''}
                                    onChange={(e) =>
                                        setData(
                                            'min_year',
                                            e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                        )
                                    }
                                />
                            </label>
                        </div>
                        <span className="flex items-center gap-2 text-sm text-white/70">
                            <Toggle
                                checked={d.publish}
                                onChange={(v) => setData('publish', v)}
                                label={tr('Одразу публікувати')}
                            />
                            {tr('Одразу публікувати')}
                        </span>
                    </>
                )}
            </div>

            <button
                type="submit"
                disabled={form.processing}
                className="inline-flex h-10 items-center rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
                {tr('Зберегти')}
            </button>
        </form>
    );
}

import { Head, router } from '@inertiajs/react';
import { Eye, EyeOff, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, selectClass } from '@/components/gc/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RANKS } from '@/components/cards/game-card';
import { tr } from '@/lib/i18n';

type Row = {
    id: number;
    name: string;
    image_url: string | null;
    role: 'main' | 'supporting';
    source: string;
    is_hidden: boolean;
    movie: string | null;
    ai_rank: string | null;
    ai_reason: string | null;
    manual_rank: string | null;
};

type Props = {
    characters: {
        data: Row[];
        links: { url: string | null; label: string; active: boolean }[];
    };
    movies: { id: number; title: string }[];
    q: string;
    autopilot: Autopilot;
};

type Autopilot = {
    enabled: boolean;
    quiet_from: number;
    quiet_to: number;
    online_below: number;
    ai_daily: number;
    ai_site_cap: number;
    quiet_now: boolean;
    online: number;
    ai_used: number;
    ai_left: number;
    last: {
        at: string;
        titles: number;
        game_characters: number;
        ranked: number;
        themed: number;
    } | null;
};

/** Автопілот: картки поруч із парсингом + догін рангів і наборів у тихі години в межах бюджету ІІ. */
function AutopilotPanel({ data }: { data: Autopilot }) {
    const [form, setForm] = useState({
        enabled: data.enabled,
        quiet_from: data.quiet_from,
        quiet_to: data.quiet_to,
        online_below: data.online_below,
        ai_daily: data.ai_daily,
        ai_site_cap: data.ai_site_cap,
    });
    const num = (key: keyof typeof form, label: string, max: number) => (
        <label className="space-y-1 text-xs text-white/60">
            {label}
            <Input
                type="number"
                min={0}
                max={max}
                value={Number(form[key])}
                onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                }
            />
        </label>
    );

    return (
        <section className="gc-solid mb-5 space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-white">
                    {tr('Автопілот карток')}
                </h2>
                <Pill tone={data.quiet_now ? 'green' : 'gold'}>
                    {data.quiet_now
                        ? tr('Зараз тихо — працює')
                        : tr('Зараз людно — чекає')}
                </Pill>
                <span className="text-xs text-white/50">
                    {tr('Онлайн: {o} · ІІ сьогодні: {u}, ще можна: {l}', {
                        o: data.online,
                        u: data.ai_used,
                        l: data.ai_left,
                    })}
                </span>
            </div>
            <p className="text-xs text-white/50">
                {tr(
                    'Нові тайтли й ігри отримують картки персонажів одразу після парсингу. Автопілот у тихі години догонить решту: персонажів ігор, ранги й набори від ІІ — не більше денного бюджету, щоб не вийти за безкоштовний ліміт.',
                )}
            </p>
            <div className="grid gap-3 sm:grid-cols-5">
                {num('quiet_from', tr('Тихо з (год)'), 23)}
                {num('quiet_to', tr('Тихо до (год)'), 23)}
                {num('online_below', tr('Або онлайн менше'), 100000)}
                {num('ai_daily', tr('ІІ-запитів на картки за добу'), 10000)}
                {num(
                    'ai_site_cap',
                    tr('Не перевищувати ліміт ІІ сайту'),
                    100000,
                )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                        type="checkbox"
                        checked={form.enabled}
                        onChange={(e) =>
                            setForm({ ...form, enabled: e.target.checked })
                        }
                    />
                    {tr('Увімкнено')}
                </label>
                <Button
                    size="sm"
                    onClick={() =>
                        router.put('/admin/card-characters/autopilot', form, {
                            preserveScroll: true,
                        })
                    }
                >
                    {tr('Зберегти')}
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                        router.post(
                            '/admin/card-characters/autopilot/run',
                            {},
                            { preserveScroll: true },
                        )
                    }
                >
                    {tr('Запустити зараз')}
                </Button>
                {data.last && (
                    <span className="text-xs text-white/45">
                        {tr('Останній прохід: {at}', {
                            at: new Date(data.last.at).toLocaleString('uk-UA'),
                        })}
                    </span>
                )}
            </div>
        </section>
    );
}

export default function AdminCardCharacters({
    characters,
    movies,
    q,
    autopilot,
}: Props) {
    const [form, setForm] = useState({
        movie_id: movies[0]?.id ?? 0,
        name: '',
        image_url: '',
        role: 'main',
    });
    const [search, setSearch] = useState(q);

    const add = (e: FormEvent) => {
        e.preventDefault();
        router.post('/admin/card-characters', form, {
            preserveScroll: true,
            onSuccess: () =>
                setForm((f) => ({ ...f, name: '', image_url: '' })),
        });
    };

    return (
        <>
            <Head title={tr('Картки персонажів')} />
            <PageHeader
                title={tr('Картки персонажів')}
                description={tr(
                    'Персонажі аніме (Shikimori), фільмів і серіалів (TMDB) для колекційних карток. Приховані не випадають у наборах, але лишаються в альбомах тих, хто їх уже має.',
                )}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            onClick={() =>
                                router.post(
                                    '/admin/card-characters/ai-rank',
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <Sparkles className="size-4" />
                            {tr('Ранги від ІІ')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                router.post(
                                    '/admin/card-characters/ai-themes',
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <Sparkles className="size-4" />
                            {tr('Набори від ІІ')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                router.post(
                                    '/admin/card-characters/sync',
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <RefreshCw className="size-4" />
                            {tr('Підтягнути зараз')}
                        </Button>
                    </div>
                }
            />

            <AutopilotPanel data={autopilot} />

            <form
                onSubmit={add}
                className="gc-solid mb-5 grid gap-3 rounded-xl p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]"
            >
                <select
                    className={selectClass}
                    value={form.movie_id}
                    onChange={(e) =>
                        setForm({ ...form, movie_id: Number(e.target.value) })
                    }
                >
                    {movies.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.title}
                        </option>
                    ))}
                </select>
                <Input
                    placeholder={tr('Ім’я персонажа')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                />
                <Input
                    placeholder={tr('Посилання на картинку (https)')}
                    value={form.image_url}
                    onChange={(e) =>
                        setForm({ ...form, image_url: e.target.value })
                    }
                />
                <select
                    className={selectClass}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                    <option value="main">{tr('Головний')}</option>
                    <option value="supporting">{tr('Другорядний')}</option>
                </select>
                <Button type="submit" disabled={form.name.trim().length < 2}>
                    <Plus className="size-4" />
                    {tr('Додати')}
                </Button>
            </form>

            <form
                className="mb-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    router.get(
                        '/admin/card-characters',
                        { q: search },
                        { preserveState: true },
                    );
                }}
            >
                <Input
                    placeholder={tr('Пошук за ім’ям')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
            </form>

            {characters.data.length === 0 ? (
                <p className="text-sm text-white/55">
                    {tr(
                        'Персонажів ще немає. Вони підтягуються щодня для опублікованих тайтлів (для фільмів і серіалів потрібен ключ TMDB).',
                    )}
                </p>
            ) : (
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {characters.data.map((c) => (
                        <li
                            key={c.id}
                            className="gc-solid flex items-center gap-3 rounded-xl p-2.5"
                        >
                            {c.image_url ? (
                                <img
                                    src={c.image_url}
                                    alt=""
                                    className="size-12 shrink-0 rounded-lg object-cover"
                                />
                            ) : (
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/10 font-bold text-white/50">
                                    {c.name.slice(0, 1)}
                                </span>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">
                                    {c.name}
                                </div>
                                <div className="truncate text-xs text-white/50">
                                    {c.movie} · {c.source}
                                </div>
                                {c.ai_rank && (
                                    <div
                                        className="truncate text-[11px] text-white/40"
                                        title={c.ai_reason ?? undefined}
                                    >
                                        {tr('ІІ')}: {c.ai_rank}
                                        {c.ai_reason && ` · ${c.ai_reason}`}
                                    </div>
                                )}
                            </div>
                            {c.is_hidden && <Pill>{tr('Приховано')}</Pill>}
                            <select
                                aria-label={tr('Ранг вручну')}
                                className="rounded-lg bg-white/10 px-1.5 py-1 text-xs text-white"
                                value={c.manual_rank ?? ''}
                                onChange={(e) =>
                                    router.post(
                                        `/admin/card-characters/${c.id}/rank`,
                                        { rank: e.target.value || null },
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <option value="">
                                    {c.ai_rank
                                        ? tr('ІІ: {r}', { r: c.ai_rank })
                                        : tr('Авто')}
                                </option>
                                {RANKS.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label={
                                    c.is_hidden
                                        ? tr('Показати')
                                        : tr('Приховати')
                                }
                                onClick={() =>
                                    router.post(
                                        `/admin/card-characters/${c.id}/toggle`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                {c.is_hidden ? (
                                    <Eye className="size-4" />
                                ) : (
                                    <EyeOff className="size-4" />
                                )}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

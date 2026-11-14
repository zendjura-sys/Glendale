import { Head, useForm } from '@inertiajs/react';
import { Filter, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Audience = 'all' | 'plus' | 'app' | 'staff';

type Broadcast = {
    id: number;
    title: string;
    body: string;
    url: string | null;
    audience: Audience;
    filters: Partial<Segment> | null;
    sent_count: number;
    finished: boolean;
    by: string | null;
    created_at: string;
};

type Segment = {
    country: string;
    locale: string;
    joined: '' | 'week' | 'month' | 'old';
    activity: '' | 'active' | 'dormant';
    game_id: string;
    community_id: string;
};

type Props = {
    broadcasts: Broadcast[];
    audiences: Record<Audience, number>;
    segments: {
        countries: Record<string, number>;
        locales: Record<string, number>;
        games: { id: number; name: string }[];
        communities: { id: number; name: string }[];
    };
};

const EMPTY: Segment = {
    country: '',
    locale: '',
    joined: '',
    activity: '',
    game_id: '',
    community_id: '',
};

/** Короткий опис сегмента для історії розсилок. */
function segmentLabel(
    f: Partial<Segment> | null,
    segments: Props['segments'],
): string {
    if (!f) return '';
    const parts: string[] = [];
    if (f.country) parts.push(f.country);
    if (f.locale) parts.push(f.locale);
    if (f.joined)
        parts.push(
            {
                week: tr('нові за тиждень'),
                month: tr('нові за місяць'),
                old: tr('з нами 3+ міс.'),
            }[f.joined] ?? '',
        );
    if (f.activity)
        parts.push(
            f.activity === 'active' ? tr('активні') : tr('давно не заходили'),
        );
    if (f.game_id)
        parts.push(
            segments.games.find((g) => String(g.id) === String(f.game_id))
                ?.name ?? tr('гра'),
        );
    if (f.community_id)
        parts.push(
            segments.communities.find(
                (c) => String(c.id) === String(f.community_id),
            )?.name ?? tr('спільнота'),
        );

    return parts.filter(Boolean).join(' · ');
}

function Select({
    value,
    onChange,
    label,
    children,
}: {
    value: string;
    onChange: (v: string) => void;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex min-w-0 flex-col gap-1 text-xs text-white/50">
            {label}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="input-glass h-10 rounded-xl px-3 text-sm text-white"
            >
                {children}
            </select>
        </label>
    );
}

function audienceLabel(a: Audience): string {
    return {
        all: tr('Усім'),
        plus: tr('Власникам GameCon+'),
        app: tr('Користувачам застосунку'),
        staff: tr('Команді'),
    }[a];
}

/** Розсилки від команди: сповіщення в дзвіночок і push обраній аудиторії й сегменту. */
export default function AdminBroadcasts({
    broadcasts,
    audiences,
    segments,
}: Props) {
    const form = useForm<
        {
            title: string;
            body: string;
            url: string;
            audience: Audience;
        } & Segment
    >({ title: '', body: '', url: '', audience: 'all', ...EMPTY });
    const [count, setCount] = useState<number | null>(null);
    const seg = (key: keyof Segment, value: string) =>
        form.setData(key, value as never);
    const segmentKey = JSON.stringify([
        form.data.audience,
        form.data.country,
        form.data.locale,
        form.data.joined,
        form.data.activity,
        form.data.game_id,
        form.data.community_id,
    ]);

    // Живий підрахунок: скільки людей отримає розсилку з цим сегментом.
    useEffect(() => {
        const params = new URLSearchParams(
            Object.entries({
                audience: form.data.audience,
                country: form.data.country,
                locale: form.data.locale,
                joined: form.data.joined,
                activity: form.data.activity,
                game_id: form.data.game_id,
                community_id: form.data.community_id,
            }).filter(([, v]) => v !== ''),
        );
        const timer = window.setTimeout(() => {
            api<{ count: number }>('GET', `/admin/broadcasts/count?${params}`)
                .then((d) => setCount(d.count))
                .catch(() => setCount(null));
        }, 250);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segmentKey]);

    const send = (e: FormEvent) => {
        e.preventDefault();

        if (
            !confirm(
                tr('Надіслати сповіщення {count} людям?', {
                    count: count ?? audiences[form.data.audience],
                }),
            )
        ) {
            return;
        }

        form.post('/admin/broadcasts', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title={tr('Розсилки — Адмін-панель')} />
            <PageHeader
                title={tr('Розсилки')}
                description={tr(
                    'Сповіщення від команди GameCon у дзвіночок і push. Люди з вимкненими новинами сайту його не отримають.',
                )}
            />

            <form
                onSubmit={send}
                className="gc-solid mb-5 space-y-3 rounded-2xl p-4"
            >
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(audiences) as Audience[]).map((a) => (
                        <button
                            key={a}
                            type="button"
                            onClick={() => form.setData('audience', a)}
                            className={cn(
                                'h-9 rounded-xl px-3 text-sm transition',
                                form.data.audience === a
                                    ? 'bg-primary text-white'
                                    : 'gc-solid-2 text-white/70 hover:text-white',
                            )}
                        >
                            {audienceLabel(a)} · {audiences[a]}
                        </button>
                    ))}
                </div>
                <fieldset className="gc-solid-2 rounded-2xl p-3">
                    <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-white/60">
                        <Filter className="size-3.5" />
                        {tr('Сегмент (необов’язково, усі умови разом)')}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <Select
                            label={tr('Країна')}
                            value={form.data.country}
                            onChange={(v) => seg('country', v)}
                        >
                            <option value="">{tr('Будь-яка')}</option>
                            {Object.entries(segments.countries).map(
                                ([c, n]) => (
                                    <option key={c} value={c}>
                                        {c} · {n}
                                    </option>
                                ),
                            )}
                        </Select>
                        <Select
                            label={tr('Мова інтерфейсу')}
                            value={form.data.locale}
                            onChange={(v) => seg('locale', v)}
                        >
                            <option value="">{tr('Будь-яка')}</option>
                            {Object.entries(segments.locales).map(([l, n]) => (
                                <option key={l} value={l}>
                                    {l} · {n}
                                </option>
                            ))}
                        </Select>
                        <Select
                            label={tr('Реєстрація')}
                            value={form.data.joined}
                            onChange={(v) => seg('joined', v)}
                        >
                            <option value="">{tr('Будь-коли')}</option>
                            <option value="week">
                                {tr('Нові за тиждень')}
                            </option>
                            <option value="month">
                                {tr('Нові за місяць')}
                            </option>
                            <option value="old">
                                {tr('З нами понад 3 місяці')}
                            </option>
                        </Select>
                        <Select
                            label={tr('Активність')}
                            value={form.data.activity}
                            onChange={(v) => seg('activity', v)}
                        >
                            <option value="">{tr('Будь-яка')}</option>
                            <option value="active">
                                {tr('Заходили за тиждень')}
                            </option>
                            <option value="dormant">
                                {tr('Не заходили понад місяць')}
                            </option>
                        </Select>
                        <Select
                            label={tr('Грає в')}
                            value={form.data.game_id}
                            onChange={(v) => seg('game_id', v)}
                        >
                            <option value="">{tr('Будь-яку гру')}</option>
                            {segments.games.map((g) => (
                                <option key={g.id} value={g.id}>
                                    {g.name}
                                </option>
                            ))}
                        </Select>
                        <Select
                            label={tr('Учасники спільноти')}
                            value={form.data.community_id}
                            onChange={(v) => seg('community_id', v)}
                        >
                            <option value="">{tr('Будь-якої')}</option>
                            {segments.communities.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
                        <Users className="size-4 text-primary" />
                        {count === null
                            ? tr('Рахуємо отримувачів…')
                            : tr('Отримають: {count}', { count })}
                    </p>
                </fieldset>
                <div>
                    <Input
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                        placeholder={tr('Заголовок')}
                        maxLength={80}
                        className="h-10"
                    />
                    <InputError message={form.errors.title} className="mt-1" />
                </div>
                <div>
                    <textarea
                        value={form.data.body}
                        onChange={(e) => form.setData('body', e.target.value)}
                        placeholder={tr('Текст сповіщення')}
                        maxLength={500}
                        className="input-glass min-h-24 w-full rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <InputError message={form.errors.body} />
                </div>
                <div>
                    <Input
                        value={form.data.url}
                        onChange={(e) => form.setData('url', e.target.value)}
                        placeholder={tr(
                            'Куди веде (напр. /games чи https://…), необов’язково',
                        )}
                        className="h-10"
                    />
                    <InputError message={form.errors.url} className="mt-1" />
                </div>
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        count === 0 ||
                        !form.data.title.trim() ||
                        !form.data.body.trim()
                    }
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Send className="size-4" /> {tr('Надіслати')}
                </button>
            </form>

            <div className="space-y-3">
                {broadcasts.map((b) => (
                    <article key={b.id} className="gc-solid rounded-2xl p-4">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h3 className="min-w-0 flex-1 font-semibold text-white">
                                {b.title}
                            </h3>
                            <span className="text-xs text-white/45">
                                {audienceLabel(b.audience)}
                                {b.filters &&
                                    ` · ${segmentLabel(b.filters, segments)}`}{' '}
                                ·{' '}
                                {b.finished
                                    ? tr('отримали {count}', {
                                          count: b.sent_count,
                                      })
                                    : tr('надсилається…')}
                            </span>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-line text-white/75">
                            {b.body}
                        </p>
                        <p className="mt-2 text-xs text-white/35">
                            {formatDate(b.created_at)}
                            {b.by ? ` · ${b.by}` : ''}
                            {b.url ? ` · ${b.url}` : ''}
                        </p>
                    </article>
                ))}
                {broadcasts.length === 0 && (
                    <p className="gc-solid rounded-2xl px-6 py-10 text-center text-sm text-white/40">
                        {tr('Розсилок ще не було.')}
                    </p>
                )}
            </div>
        </>
    );
}

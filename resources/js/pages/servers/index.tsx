import { Head, router, useForm } from '@inertiajs/react';
import {
    Clock3,
    Crown,
    Monitor,
    Plus,
    Search,
    SearchX,
    Server,
    Smartphone,
    UsersRound,
    XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { ServerCard } from '@/components/servers/server-card';
import {
    emptyServer,
    ServerFormFields,
} from '@/components/servers/server-form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { GtaServerCard } from '@/types';
import { LOCALE, tr } from '@/lib/i18n';

type Props = {
    servers: GtaServerCard[];
    filters: {
        platform: 'pc' | 'mobile' | null;
        q: string;
        sort: string;
        lang: string;
    };
    heading: string | null;
    languages: { code: string; native: string; count: number }[];
    stats: {
        servers: number;
        pc: number;
        mobile: number;
        online: number;
        families: number;
    };
    my_suggestions: {
        id: number;
        name: string;
        status: 'pending' | 'rejected';
        review_note: string | null;
    }[];
    options: {
        platforms: Record<string, string>;
        multiplayers: Record<string, string>;
        languages: Record<string, string>;
    };
};

const sorts = [
    ['online', tr('За онлайном')],
    ['families', tr('За сім’ями')],
    ['name', tr('За назвою')],
    ['new', tr('Нові')],
] as const;

export default function Servers({
    servers,
    filters,
    heading,
    languages,
    stats,
    my_suggestions,
    options,
}: Props) {
    const [q, setQ] = useState(filters.q);
    const [suggesting, setSuggesting] = useState(false);
    const myLanguage = LOCALE.split('-')[0];
    const form = useForm({
        ...emptyServer,
        language: myLanguage in options.languages ? myLanguage : 'uk',
    });

    const visit = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, q, ...patch };
        router.get(
            '/servers',
            {
                platform: next.platform || undefined,
                q: next.q || undefined,
                sort: next.sort === 'online' ? undefined : next.sort,
                lang: next.lang,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const submit = () =>
        form.post('/servers/suggest', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setSuggesting(false);
            },
        });

    const tabs = [
        { value: null, label: tr('Усі'), icon: Server, count: stats.servers },
        {
            value: 'pc' as const,
            label: tr('ПК'),
            icon: Monitor,
            count: stats.pc,
        },
        {
            value: 'mobile' as const,
            label: tr('Мобільні'),
            icon: Smartphone,
            count: stats.mobile,
        },
    ];

    return (
        <>
            <Head title={tr('Сервери GTA')} />
            <div className="space-y-5">
                <section className="glass noise relative overflow-hidden rounded-3xl p-5 sm:p-7">
                    <div className="pointer-events-none absolute -top-24 -right-16 size-96 rounded-full bg-[#facc15]/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-36 -left-10 size-96 rounded-full bg-[#2563eb]/25 blur-3xl" />
                    <div className="relative flex flex-wrap items-start justify-between gap-5">
                        <div className="max-w-xl">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#facc15]/25 bg-[#facc15]/10 px-3 py-1 text-xs font-semibold tracking-wider text-[#fde68a] uppercase">
                                {tr('🇺🇦 Зроблено в Україні')}
                            </span>
                            <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
                                {heading ?? tr('Усі')}{' '}
                                <span className="text-gradient">
                                    {tr('GTA RP сервери')}
                                </span>
                            </h1>
                            <p className="mt-2 text-sm leading-relaxed text-white/55">
                                {tr(
                                    'ПК і мобільні проєкти з живим онлайном. Іконки, онлайн і Discord оновлюються автоматично. Не знайшли свій сервер — додайте його.',
                                )}
                            </p>
                        </div>
                        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
                            {[
                                [
                                    tr('Гравців онлайн'),
                                    stats.online.toLocaleString(LOCALE),
                                    'text-emerald-300',
                                ],
                                [tr('Серверів'), stats.servers, 'text-white'],
                                [tr('Сімей'), stats.families, 'text-[#c4b5fd]'],
                            ].map(([label, value, tone]) => (
                                <div
                                    key={label}
                                    className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/[0.06]"
                                >
                                    <div
                                        className={cn(
                                            'font-display text-2xl font-bold',
                                            tone,
                                        )}
                                    >
                                        {value}
                                    </div>
                                    <div className="text-xs text-white/45">
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="flex shrink-0 rounded-xl bg-white/[0.04] p-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.label}
                                    type="button"
                                    onClick={() =>
                                        visit({ platform: tab.value })
                                    }
                                    className={cn(
                                        'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition',
                                        filters.platform === tab.value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    <tab.icon className="size-4" />
                                    {tab.label}
                                    <span className="rounded-full bg-white/10 px-1.5 text-[11px] leading-5 text-white/70">
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <label className="input-glass flex h-11 min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={q}
                                onChange={(event) => setQ(event.target.value)}
                                placeholder={tr('Пошук сервера')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                        {languages.length > 1 && (
                            <select
                                value={filters.lang}
                                onChange={(e) =>
                                    visit({ lang: e.target.value })
                                }
                                className={cn(selectClass, 'h-11')}
                                aria-label={tr('Мова серверів')}
                            >
                                <option value="all">{tr('Усі мови')}</option>
                                {languages.map((l) => (
                                    <option key={l.code} value={l.code}>
                                        {l.native} · {l.count}
                                    </option>
                                ))}
                            </select>
                        )}
                        <select
                            value={filters.sort}
                            onChange={(e) => visit({ sort: e.target.value })}
                            className={cn(selectClass, 'h-11')}
                        >
                            {sorts.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setSuggesting(true)}
                            className="btn-glow inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
                        >
                            <Plus className="size-4" /> {tr('Додати сервер')}
                        </button>
                    </div>
                </section>

                {my_suggestions.length > 0 && (
                    <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-xs">
                        <span className="text-white/50">
                            {tr('Ваші пропозиції:')}
                        </span>
                        {my_suggestions.map((s) => (
                            <span
                                key={s.id}
                                title={s.review_note ?? undefined}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
                                    s.status === 'pending'
                                        ? 'bg-amber-300/10 text-amber-200'
                                        : 'bg-rose-400/10 text-rose-200',
                                )}
                            >
                                {s.status === 'pending' ? (
                                    <Clock3 className="size-3" />
                                ) : (
                                    <XCircle className="size-3" />
                                )}
                                {s.name} ·{' '}
                                {s.status === 'pending'
                                    ? tr('на модерації')
                                    : tr('відхилено{v}', {
                                          v: s.review_note
                                              ? `: ${s.review_note}`
                                              : '',
                                      })}
                            </span>
                        ))}
                    </div>
                )}

                {servers.length === 0 ? (
                    <EmptyState
                        icon={SearchX}
                        title={tr('Серверів не знайдено')}
                        text={tr(
                            'Спробуйте інший запит або запропонуйте сервер, якого бракує.',
                        )}
                        action={
                            <button
                                type="button"
                                onClick={() => setSuggesting(true)}
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                            >
                                {tr('Додати сервер')}
                            </button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {servers.map((server, index) => (
                            <ServerCard
                                key={server.id}
                                server={server}
                                index={index}
                            />
                        ))}
                    </div>
                )}

                <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand">
                        <Crown className="size-6 text-white" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="font-display text-lg font-semibold text-white">
                            {tr('Керуєте сім’єю на сервері?')}
                        </div>
                        <p className="text-sm text-white/50">
                            {tr(
                                'Звіти, банк і виплати, склад, дисципліна й рейтинг — усе в одній панелі.',
                            )}
                        </p>
                    </div>
                    <a
                        href="/families/create"
                        className="glass inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white hover:bg-white/10"
                    >
                        <UsersRound className="size-4" /> {tr('Створити сім’ю')}
                    </a>
                </div>
            </div>

            <Dialog open={suggesting} onOpenChange={setSuggesting}>
                <DialogContent className="glass-strong max-h-[92dvh] gap-0 overflow-y-auto rounded-3xl border-white/10 p-6 text-white sm:max-w-2xl">
                    <DialogTitle className="font-display text-xl">
                        {tr('Додати відсутній сервер')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr(
                            'Після перевірки модератором сервер з’явиться в каталозі. Іконку підтягнемо з Discord або сайту автоматично.',
                        )}
                    </DialogDescription>
                    <div className="mt-5">
                        <ServerFormFields
                            data={form.data}
                            setData={form.setData}
                            errors={form.errors}
                            multiplayers={options.multiplayers}
                            languages={options.languages}
                            compact
                        />
                    </div>
                    <div className="mt-6 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setSuggesting(false)}
                            className="h-11 rounded-xl px-4 text-sm font-medium text-white/60 hover:text-white"
                        >
                            {tr('Скасувати')}
                        </button>
                        <button
                            type="button"
                            disabled={form.processing || !form.data.name}
                            onClick={submit}
                            className="btn-glow h-11 rounded-xl px-6 text-sm font-semibold disabled:opacity-50"
                        >
                            {form.processing
                                ? tr('Надсилаємо…')
                                : tr('Надіслати на модерацію')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

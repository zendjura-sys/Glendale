import { Link, router, usePage } from '@inertiajs/react';
import { CalendarClock, Languages } from 'lucide-react';
import { localTime } from '@/lib/event-time';
import { languageName } from '@/lib/format';
import { tr } from '@/lib/i18n';

export type TomorrowEvent = {
    key: string;
    kind: string;
    title: string;
    starts_at: string;
    type_label: string;
    where: { name: string; url: string } | null;
    image: string | null;
};

/** Картка в стрічці: завтра подія твого клану чи сім’ї. */
export function TomorrowCard({ events }: { events: TomorrowEvent[] }) {
    if (events.length === 0) return null;

    return (
        <section className="glass rounded-2xl p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarClock className="size-4 text-gc-lilac-300" />
                {tr('Завтра')}
            </h2>
            <ul className="space-y-1.5">
                {events.map((event) => (
                    <li key={event.key}>
                        <Link
                            href={event.where?.url ?? '/events'}
                            className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]"
                        >
                            {event.image ? (
                                <img
                                    loading="lazy"
                                    decoding="async"
                                    src={event.image}
                                    alt=""
                                    className="size-11 shrink-0 rounded-xl object-cover"
                                />
                            ) : (
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gc-indigo/15 text-sm font-semibold text-gc-lilac-300 tabular-nums">
                                    {localTime(event.starts_at)}
                                </span>
                            )}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-white">
                                    {event.title}
                                </span>
                                <span className="block truncate text-xs text-white/50">
                                    {localTime(event.starts_at)} ·{' '}
                                    {event.where?.name ?? event.type_label}
                                </span>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Фільтр стрічки за мовою запису. */
export function LanguageFilter({
    tab,
    lang,
    languages,
}: {
    tab: string;
    lang: string | null;
    languages: string[];
}) {
    const { locale } = usePage().props;

    return (
        <label className="flex items-center gap-2 px-1 text-xs text-white/50">
            <Languages className="size-4" />
            {tr('Мова записів')}
            <select
                value={lang ?? ''}
                onChange={(event) => {
                    const value = event.target.value;
                    router.get(
                        '/feed',
                        {
                            ...(tab !== 'friends' ? { tab } : {}),
                            ...(value ? { lang: value } : {}),
                        },
                        { preserveScroll: false },
                    );
                }}
                className="h-8 rounded-lg bg-white/[0.05] px-2 text-xs text-white/80"
            >
                <option value="">{tr('Усі мови')}</option>
                {languages.map((code) => (
                    <option key={code} value={code}>
                        {languageName(code, locale)}
                    </option>
                ))}
            </select>
        </label>
    );
}

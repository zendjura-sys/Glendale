import { Link, router, usePage } from '@inertiajs/react';
import { CalendarClock, Languages } from 'lucide-react';
import { localTime } from '@/lib/event-time';
import { languageName } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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

/**
 * Вкладка «Друзі» — строго за часом, без алгоритму. Перемикач «Лише друзі» прибирає записи спільнот
 * (вибір запам’ятовується на сервері).
 */
export function ChronoSwitch({ onlyFriends }: { onlyFriends: boolean }) {
    const options = [
        { key: 'all', label: tr('Друзі й спільноти'), on: !onlyFriends },
        { key: 'friends', label: tr('Лише друзі'), on: onlyFriends },
    ];

    return (
        <div
            title={tr('Строго за часом, без алгоритму')}
            className="flex min-w-0 shrink-0 gap-0.5 rounded-xl bg-white/[0.05] p-0.5 text-xs"
        >
            {options.map((option) => (
                <button
                    key={option.key}
                    type="button"
                    aria-pressed={option.on}
                    onClick={() =>
                        !option.on &&
                        router.get(
                            '/feed',
                            { only: option.key },
                            { preserveScroll: false },
                        )
                    }
                    className={cn(
                        'h-8 rounded-[10px] px-2.5 whitespace-nowrap transition',
                        option.on
                            ? 'bg-white/[0.12] text-white'
                            : 'text-white/55 hover:text-white',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
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
        <label className="relative flex min-w-0 items-center">
            <Languages className="pointer-events-none absolute left-2.5 size-4 text-white/50" />
            <span className="sr-only">{tr('Мова записів')}</span>
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
                className="h-9 max-w-36 min-w-0 rounded-xl bg-white/[0.05] pr-2 pl-8 text-xs text-white/80"
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

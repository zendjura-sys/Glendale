import { Head, Link, router, usePage } from '@inertiajs/react';
import { Bell, CalendarDays, CalendarPlus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { EventList } from '@/components/events/event-card';
import type { CalendarEvent } from '@/components/events/event-card';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';
import { listWords } from '@/lib/modes';

type Props = {
    events: CalendarEvent[];
    kind: string | null;
    kinds: Record<string, string>;
    reminder_lead: number;
    reminder_leads: number[];
    feed_url?: string | null;
    releasesOn?: boolean;
};

const leadLabel = (minutes: number) =>
    minutes >= 1440
        ? tr('за добу')
        : minutes >= 60
          ? tr('за годину')
          : tr('за {minutes} хв', { minutes });

/** Календар: найближчі події моїх сімей, кланів, серверів та ігор, з нагадуванням у вибраний час. */
export default function EventsIndex({
    events,
    kind,
    kinds,
    reminder_lead,
    reminder_leads,
    feed_url = null,
    releasesOn = true,
}: Props) {
    const { modules } = usePage().props;
    const tabs: [string | null, string][] = [
        [null, tr('Усі')],
        ...Object.entries(kinds),
    ];

    return (
        <>
            <Head title={tr('Календар подій')} />
            <div className="mb-4">
                <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                    <CalendarDays className="size-6 text-gc-lilac-200" />{' '}
                    {tr('Календар подій')}
                </h1>
                <p className="text-sm text-white/50">
                    {tr('Події ваших {what}.', {
                        what: listWords([
                            modules.includes('families') && tr('сімей'),
                            modules.includes('clans') && tr('кланів'),
                            modules.includes('servers') && tr('серверів'),
                            modules.includes('games') && tr('ігор'),
                        ]),
                    })}{' '}
                    {modules.includes('servers') &&
                        tr('Події серверів з Discord підтягуються самі.')}{' '}
                    {modules.includes('games') &&
                        tr('Події ігор з IGDB підтягуються самі.')}{' '}
                    {tr('Час показано у вашому часовому поясі.')}{' '}
                    {releasesOn && (
                        <Link
                            href="/events/releases"
                            className="text-gc-lilac-200 hover:text-white"
                        >
                            {tr('Релізи і сезони')}
                        </Link>
                    )}
                </p>
            </div>
            <label className="mb-3 flex flex-wrap items-center gap-2 text-sm text-white/60">
                <Bell className="size-4 text-gc-lilac-200" />
                {tr('Нагадувати')}
                <select
                    value={reminder_lead}
                    onChange={(e) =>
                        router.put(
                            '/events/reminder',
                            { lead: Number(e.target.value) },
                            { preserveScroll: true, preserveState: true },
                        )
                    }
                    className="input-glass h-9 rounded-lg px-2 text-sm text-white"
                >
                    {reminder_leads.map((m) => (
                        <option key={m} value={m}>
                            {leadLabel(m)}
                        </option>
                    ))}
                </select>
                {tr('до початку')}
            </label>
            {feed_url && (
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-white/60">
                    <CalendarPlus className="size-4 text-gc-lilac-200" />
                    {tr('Мій календар у Google, Apple чи Outlook:')}
                    <button
                        type="button"
                        onClick={() => {
                            void navigator.clipboard.writeText(feed_url);
                            toast.success(
                                tr(
                                    'Посилання скопійовано. Додайте його в календар як «Підписку за URL».',
                                ),
                            );
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 text-sm font-medium text-white transition hover:bg-white/[0.11]"
                    >
                        <Copy className="size-3.5" />
                        {tr('Копіювати посилання')}
                    </button>
                    <a
                        href={feed_url.replace(/^https?:/, 'webcal:')}
                        className="inline-flex h-8 items-center rounded-lg px-2 text-sm text-gc-lilac-200 hover:text-white"
                    >
                        {tr('Відкрити в календарі')}
                    </a>
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                '/events/feed/reset',
                                {},
                                { preserveScroll: true },
                            )
                        }
                        className="text-xs text-white/40 hover:text-white/70"
                    >
                        {tr('Нове посилання')}
                    </button>
                </div>
            )}
            <div className="-mx-1 mb-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-1">
                {tabs.map(([key, label]) => (
                    <button
                        key={key ?? 'all'}
                        type="button"
                        onClick={() =>
                            router.get('/events', key ? { kind: key } : {}, {
                                preserveState: true,
                                preserveScroll: true,
                                replace: true,
                            })
                        }
                        className={cn(
                            'h-9 shrink-0 rounded-lg px-3.5 text-sm font-medium transition',
                            kind === key
                                ? 'bg-gradient-brand text-white'
                                : 'bg-white/[0.04] text-white/60 hover:text-white',
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {events.length === 0 ? (
                <EmptyState
                    icon={CalendarDays}
                    title={tr('Найближчих подій немає')}
                    text={
                        kind === 'game'
                            ? tr(
                                  'Шоукейси, трансляції й виходи ігор з’являються тут автоматично.',
                              )
                            : tr(
                                  'Події з’являються, коли їх створюють у розділах вашого режиму.',
                              )
                    }
                />
            ) : (
                <EventList events={events} />
            )}
        </>
    );
}

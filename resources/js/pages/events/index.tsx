import { Head, router } from '@inertiajs/react';
import { CalendarDays } from 'lucide-react';
import { EventList } from '@/components/events/event-card';
import type { CalendarEvent } from '@/components/events/event-card';
import { EmptyState } from '@/components/gc/widget';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Props = {
    events: CalendarEvent[];
    kind: string | null;
    kinds: Record<string, string>;
};

/** Календар: найближчі події моїх сімей, кланів, серверів та ігор, з нагадуванням за пів години. */
export default function EventsIndex({ events, kind, kinds }: Props) {
    const tabs: [string | null, string][] = [
        [null, tr('Усі')],
        ...Object.entries(kinds),
    ];

    return (
        <>
            <Head title={tr('Календар подій')} />
            <div className="mb-4">
                <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                    <CalendarDays className="size-6 text-[#a5b4fc]" />{' '}
                    {tr('Календар подій')}
                </h1>
                <p className="text-sm text-white/50">
                    {tr(
                        'Події ваших сімей, кланів, серверів та ігор. Події серверів з Discord і ігор з IGDB підтягуються самі. За пів години до початку прийде нагадування.',
                    )}
                </p>
            </div>
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
                                  'Події з’являються, коли їх створюють у сім’ї, клані, на сторінці сервера або в Discord проєкту.',
                              )
                    }
                />
            ) : (
                <EventList events={events} />
            )}
        </>
    );
}

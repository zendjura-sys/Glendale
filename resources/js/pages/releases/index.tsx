import { Head, Link } from '@inertiajs/react';
import { CalendarDays } from 'lucide-react';
import { EventList } from '@/components/events/event-card';
import type { CalendarEvent } from '@/components/events/event-card';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

type Props = {
    events: CalendarEvent[];
};

/** Виходи ігор і сезони на найближчі місяці. «Нагадати» пише в день старту. */
export default function ReleasesIndex({ events }: Props) {
    return (
        <>
            <Head title={tr('Релізи і сезони')} />
            <div className="mb-4">
                <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                    <CalendarDays className="size-6 text-gc-lilac-200" />{' '}
                    {tr('Релізи і сезони')}
                </h1>
                <p className="text-sm text-white/50">
                    {tr(
                        'Найближчі виходи ігор і оновлення. Нагадування прийде в день старту.',
                    )}{' '}
                    <Link
                        href="/events"
                        className="text-gc-lilac-200 hover:text-white"
                    >
                        {tr('Усі події')}
                    </Link>
                </p>
            </div>
            {events.length === 0 ? (
                <EmptyState
                    icon={CalendarDays}
                    title={tr('Поки немає дат')}
                    text={tr(
                        'Коли в каталозі з’явиться вихід гри або сезон, він буде тут.',
                    )}
                />
            ) : (
                <EventList events={events} />
            )}
        </>
    );
}

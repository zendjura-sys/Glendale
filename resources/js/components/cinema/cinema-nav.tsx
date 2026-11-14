import { Link } from '@inertiajs/react';
import { Shuffle } from 'lucide-react';
import { UnderlineTabs } from '@/components/gc/underline-tabs';
import { tr } from '@/lib/i18n';

export type CinemaSection = 'home' | 'overview' | 'my' | 'schedule';

/**
 * Навігація кінопорталу: розділи Головна / Огляд / Закладки / Розклад з підкресленням активного
 * і «Рандом». Окремого пошуку немає — шукає один загальний пошук у шапці (у т.ч. кіно).
 */
export function CinemaNav({ active }: { active: CinemaSection }) {
    return (
        <div className="flex items-end gap-2">
            <UnderlineTabs
                className="min-w-0 flex-1"
                active={active}
                tabs={[
                    { key: 'home', label: tr('Головна'), href: '/cinema' },
                    {
                        key: 'overview',
                        label: tr('Огляд'),
                        href: '/cinema/overview',
                    },
                    { key: 'my', label: tr('Закладки'), href: '/cinema/my' },
                    {
                        key: 'schedule',
                        label: tr('Розклад'),
                        href: '/cinema/schedule',
                    },
                ]}
            />
            <Link
                href="/cinema/random"
                title={tr('Рандом')}
                aria-label={tr('Рандом')}
                className="gc-search-pill mb-1 flex size-10 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white"
            >
                <Shuffle className="size-5" />
            </Link>
        </div>
    );
}

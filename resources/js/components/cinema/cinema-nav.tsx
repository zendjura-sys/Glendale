import { Link, router } from '@inertiajs/react';
import { Shuffle } from 'lucide-react';
import { useState } from 'react';
import { SearchPill } from '@/components/gc/search-pill';
import { UnderlineTabs } from '@/components/gc/underline-tabs';
import { tr } from '@/lib/i18n';

export type CinemaSection = 'home' | 'overview' | 'my' | 'schedule';

/**
 * Навігація кінопорталу всередині сайту: пошук-пігулка, «Рандом» і розділи
 * Головна / Огляд / Закладки / Розклад з підкресленням активного.
 */
export function CinemaNav({
    active,
    search,
    onSearch,
    placeholder,
}: {
    active: CinemaSection;
    /** Пошук на сторінці (Головна, Закладки); без нього — перехід у пошук каталогу. */
    search?: string;
    onSearch?: (value: string) => void;
    placeholder?: string;
}) {
    const [local, setLocal] = useState('');
    const value = search ?? local;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <form
                    className="min-w-0 flex-1"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!onSearch && local.trim()) {
                            router.get('/cinema', { q: local.trim() });
                        }
                    }}
                >
                    <SearchPill
                        value={value}
                        onValueChange={onSearch ?? setLocal}
                        placeholder={placeholder ?? tr('Пошук фільмів і аніме')}
                    />
                </form>
                <Link
                    href="/cinema/random"
                    title={tr('Рандом')}
                    aria-label={tr('Рандом')}
                    className="gc-search-pill flex size-12 shrink-0 items-center justify-center rounded-full text-white/70 hover:text-white"
                >
                    <Shuffle className="size-5" />
                </Link>
            </div>
            <UnderlineTabs
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
        </div>
    );
}

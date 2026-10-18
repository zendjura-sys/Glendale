import { Head, InfiniteScroll, router } from '@inertiajs/react';
import { MapPin, Radio, Search, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PersonCard } from '@/components/gc/person-card';
import { EmptyState } from '@/components/gc/widget';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PersonCard as Person, ScrollData } from '@/types';
import { tr } from '@/lib/i18n';

type Filters = {
    q: string;
    city: string;
    gender: string;
    online: boolean;
    language: string;
    country: string;
    game: string;
};

type Props = {
    filters: Filters;
    saved: Filters | null;
    total: number;
    users: ScrollData<Person>;
};

export default function People({ filters, saved, total, users }: Props) {
    const [form, setForm] = useState<Filters>(filters);

    useEffect(() => {
        if (JSON.stringify(form) === JSON.stringify(filters)) return;
        const timer = setTimeout(() => {
            router.get(
                '/people',
                {
                    q: form.q || undefined,
                    city: form.city || undefined,
                    gender: form.gender || undefined,
                    online: form.online ? 1 : undefined,
                    language: form.language || undefined,
                    country: form.country || undefined,
                    game: form.game || undefined,
                },
                { preserveState: true, replace: true },
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [form, filters]);

    return (
        <>
            <Head title={tr('Пошук людей')} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
                    <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-gc-blue/20 blur-3xl" />
                    <h1 className="relative font-display text-2xl font-bold text-white">
                        {tr('Знайдіть')}{' '}
                        <span className="text-gradient">
                            {tr('своїх людей')}
                        </span>
                    </h1>
                    <p className="relative mt-1 text-sm text-white/50">
                        {total} {plural(total, ['людина', 'людини', 'людей'])}{' '}
                        {tr('за вашим запитом')}
                    </p>

                    <div className="relative mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto_auto]">
                        <label className="input-glass flex h-11 items-center gap-2.5 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                autoFocus
                                value={form.q}
                                onChange={(event) =>
                                    setForm({ ...form, q: event.target.value })
                                }
                                placeholder={tr('Ім’я, прізвище або нікнейм')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                        <label className="input-glass flex h-11 items-center gap-2.5 rounded-xl px-3.5">
                            <MapPin className="size-4 text-white/40" />
                            <input
                                value={form.city}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        city: event.target.value,
                                    })
                                }
                                placeholder={tr('Місто')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                        <div className="flex rounded-xl bg-white/[0.04] p-1">
                            {[
                                { value: '', label: tr('Усі') },
                                { value: 'male', label: tr('Чоловіки') },
                                { value: 'female', label: tr('Жінки') },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                        setForm({
                                            ...form,
                                            gender: option.value,
                                        })
                                    }
                                    className={cn(
                                        'rounded-lg px-3 text-sm font-medium transition',
                                        form.gender === option.value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                setForm({ ...form, online: !form.online })
                            }
                            className={cn(
                                'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition',
                                form.online
                                    ? 'nav-active text-white'
                                    : 'bg-white/[0.04] text-white/55 hover:text-white',
                            )}
                        >
                            <Radio
                                className={cn(
                                    'size-4',
                                    form.online && 'text-emerald-300',
                                )}
                            />{' '}
                            {tr('Зараз онлайн')}
                        </button>
                    </div>
                    <div className="relative mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <input
                            value={form.country}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    country: event.target.value,
                                })
                            }
                            placeholder={tr('Країна')}
                            className="input-glass h-11 rounded-xl px-3.5 text-sm text-white placeholder:text-white/35"
                        />
                        <input
                            value={form.language}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    language: event.target.value,
                                })
                            }
                            placeholder={tr('Мова, напр. uk')}
                            className="input-glass h-11 rounded-xl px-3.5 text-sm text-white placeholder:text-white/35"
                        />
                        <input
                            value={form.game}
                            onChange={(event) =>
                                setForm({ ...form, game: event.target.value })
                            }
                            placeholder={tr('Гра')}
                            className="input-glass h-11 rounded-xl px-3.5 text-sm text-white placeholder:text-white/35"
                        />
                    </div>
                    <div className="relative mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => router.post('/people/saved', form)}
                            className="h-11 rounded-xl bg-white/10 px-4 text-sm font-medium text-white"
                        >
                            {tr('Зберегти запит')}
                        </button>
                        {saved && (
                            <button
                                type="button"
                                onClick={() => setForm(saved)}
                                className="h-11 rounded-xl px-4 text-sm text-gc-lilac-300 hover:text-white"
                            >
                                {tr('Мій запит')}
                            </button>
                        )}
                    </div>
                </section>

                {users.data.length === 0 ? (
                    <EmptyState
                        icon={SearchX}
                        title={tr('Нікого не знайдено')}
                        text={tr(
                            'Спробуйте змінити запит або прибрати фільтри.',
                        )}
                    />
                ) : (
                    <InfiniteScroll
                        data="users"
                        preserveUrl
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                    >
                        {users.data.map((person) => (
                            <PersonCard key={person.id} person={person} />
                        ))}
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}

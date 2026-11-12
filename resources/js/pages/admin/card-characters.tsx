import { Head, router } from '@inertiajs/react';
import { Eye, EyeOff, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, selectClass } from '@/components/gc/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';

type Row = {
    id: number;
    name: string;
    image_url: string | null;
    role: 'main' | 'supporting';
    source: string;
    is_hidden: boolean;
    movie: string | null;
};

type Props = {
    characters: {
        data: Row[];
        links: { url: string | null; label: string; active: boolean }[];
    };
    movies: { id: number; title: string }[];
    q: string;
};

export default function AdminCardCharacters({ characters, movies, q }: Props) {
    const [form, setForm] = useState({
        movie_id: movies[0]?.id ?? 0,
        name: '',
        image_url: '',
        role: 'main',
    });
    const [search, setSearch] = useState(q);

    const add = (e: FormEvent) => {
        e.preventDefault();
        router.post('/admin/card-characters', form, {
            preserveScroll: true,
            onSuccess: () =>
                setForm((f) => ({ ...f, name: '', image_url: '' })),
        });
    };

    return (
        <>
            <Head title={tr('Картки персонажів')} />
            <PageHeader
                title={tr('Картки персонажів')}
                description={tr(
                    'Персонажі аніме (Shikimori), фільмів і серіалів (TMDB) для колекційних карток. Приховані не випадають у наборах, але лишаються в альбомах тих, хто їх уже має.',
                )}
                actions={
                    <Button
                        variant="secondary"
                        onClick={() =>
                            router.post(
                                '/admin/card-characters/sync',
                                {},
                                { preserveScroll: true },
                            )
                        }
                    >
                        <RefreshCw className="size-4" />
                        {tr('Підтягнути зараз')}
                    </Button>
                }
            />

            <form
                onSubmit={add}
                className="gc-solid mb-5 grid gap-3 rounded-xl p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto_auto]"
            >
                <select
                    className={selectClass}
                    value={form.movie_id}
                    onChange={(e) =>
                        setForm({ ...form, movie_id: Number(e.target.value) })
                    }
                >
                    {movies.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.title}
                        </option>
                    ))}
                </select>
                <Input
                    placeholder={tr('Ім’я персонажа')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={120}
                />
                <Input
                    placeholder={tr('Посилання на картинку (https)')}
                    value={form.image_url}
                    onChange={(e) =>
                        setForm({ ...form, image_url: e.target.value })
                    }
                />
                <select
                    className={selectClass}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                    <option value="main">{tr('Головний')}</option>
                    <option value="supporting">{tr('Другорядний')}</option>
                </select>
                <Button type="submit" disabled={form.name.trim().length < 2}>
                    <Plus className="size-4" />
                    {tr('Додати')}
                </Button>
            </form>

            <form
                className="mb-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    router.get(
                        '/admin/card-characters',
                        { q: search },
                        { preserveState: true },
                    );
                }}
            >
                <Input
                    placeholder={tr('Пошук за ім’ям')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
            </form>

            {characters.data.length === 0 ? (
                <p className="text-sm text-white/55">
                    {tr(
                        'Персонажів ще немає. Вони підтягуються щодня для опублікованих тайтлів (для фільмів і серіалів потрібен ключ TMDB).',
                    )}
                </p>
            ) : (
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {characters.data.map((c) => (
                        <li
                            key={c.id}
                            className="gc-solid flex items-center gap-3 rounded-xl p-2.5"
                        >
                            {c.image_url ? (
                                <img
                                    src={c.image_url}
                                    alt=""
                                    className="size-12 shrink-0 rounded-lg object-cover"
                                />
                            ) : (
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/10 font-bold text-white/50">
                                    {c.name.slice(0, 1)}
                                </span>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">
                                    {c.name}
                                </div>
                                <div className="truncate text-xs text-white/50">
                                    {c.movie} · {c.source}
                                </div>
                            </div>
                            {c.is_hidden && <Pill>{tr('Приховано')}</Pill>}
                            <Button
                                size="icon"
                                variant="ghost"
                                aria-label={
                                    c.is_hidden
                                        ? tr('Показати')
                                        : tr('Приховати')
                                }
                                onClick={() =>
                                    router.post(
                                        `/admin/card-characters/${c.id}/toggle`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                {c.is_hidden ? (
                                    <Eye className="size-4" />
                                ) : (
                                    <EyeOff className="size-4" />
                                )}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

import { Head, Link, router } from '@inertiajs/react';
import { ListMusic, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, selectClass } from '@/components/gc/admin';
import { PlaylistCover } from '@/components/music/playlist-card';
import { Input } from '@/components/ui/input';
import { moodLabel } from '@/pages/music/new';
import type { PlaylistCard, UserCard } from '@/types';
import { tr } from '@/lib/i18n';

type AdminPlaylist = PlaylistCard & {
    is_featured: boolean;
    category: string | null;
    owner: UserCard | null;
};

type Props = {
    groups: { category: string | null; playlists: AdminPlaylist[] }[];
    results: AdminPlaylist[];
    categories: string[];
    filters: { q: string };
};

/** Записати позначку добірки й категорію (null — банер «Добірка редакції» без настрою). */
function feature(
    playlist: AdminPlaylist,
    isFeatured: boolean,
    category: string | null,
) {
    router.patch(
        `/admin/music/featured/${playlist.id}`,
        { is_featured: isFeatured, category },
        { preserveScroll: true, preserveState: true },
    );
}

export default function AdminMusicFeatured({
    groups,
    results,
    categories,
    filters,
}: Props) {
    const [q, setQ] = useState(filters.q);

    const search = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/admin/music/featured',
            { q: q.trim() || undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    return (
        <>
            <Head title={tr('Підбірки — Адмін-панель')} />
            <PageHeader
                title={tr('Підбірки')}
                description={tr(
                    'Добірки редакції у вкладці «Нове». Без категорії плейлист стає великим банером, з категорією — потрапляє в полицю настрою.',
                )}
            />

            <form
                onSubmit={search}
                className="glass relative mb-4 rounded-2xl p-2.5"
            >
                <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-white/30" />
                <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={tr(
                        'Знайти публічний плейлист за назвою або ID',
                    )}
                    className="h-10 pl-10"
                />
            </form>

            {filters.q !== '' && (
                <section className="glass mb-6 overflow-hidden rounded-3xl">
                    <h2 className="border-b border-white/[0.06] px-4 py-3 text-sm font-medium text-white/60">
                        {tr('Знайдено: {count}', { count: results.length })}
                    </h2>
                    {results.map((playlist) => (
                        <Row
                            key={playlist.id}
                            playlist={playlist}
                            categories={categories}
                        />
                    ))}
                    {results.length === 0 && (
                        <p className="px-6 py-10 text-center text-sm text-white/40">
                            {tr(
                                'Нічого не знайдено. У добірки можна додати лише публічні плейлисти.',
                            )}
                        </p>
                    )}
                </section>
            )}

            <div className="grid gap-4">
                {groups.map((group) => (
                    <section
                        key={group.category ?? ''}
                        className="glass overflow-hidden rounded-3xl"
                    >
                        <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                            <h2 className="font-display text-base font-bold text-white">
                                {group.category
                                    ? moodLabel(group.category)
                                    : tr('Добірка редакції')}
                            </h2>
                            <Pill>{group.playlists.length}</Pill>
                        </header>
                        {group.playlists.map((playlist) => (
                            <Row
                                key={playlist.id}
                                playlist={playlist}
                                categories={categories}
                            />
                        ))}
                    </section>
                ))}
                {groups.length === 0 && (
                    <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                        <ListMusic className="mx-auto mb-2 size-6 text-white/25" />
                        {tr(
                            'Добірок ще немає. Знайдіть публічний плейлист і додайте його.',
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function Row({
    playlist,
    categories,
}: {
    playlist: AdminPlaylist;
    categories: string[];
}) {
    const [category, setCategory] = useState(playlist.category ?? '');

    return (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-4 py-3 last:border-0">
            <PlaylistCover
                playlist={playlist}
                className="size-11 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
                <Link
                    href={`/music/playlists/${playlist.id}`}
                    className="block truncate font-medium text-white hover:underline"
                >
                    {playlist.title}
                </Link>
                <p className="truncate text-xs text-white/40">
                    {playlist.owner?.name ?? '—'} ·{' '}
                    {tr('{count} треків', { count: playlist.tracks_count })}
                    {!playlist.is_public && ` · ${tr('приватний')}`}
                </p>
            </div>
            <select
                value={category}
                onChange={(e) => {
                    setCategory(e.target.value);
                    if (playlist.is_featured) {
                        feature(playlist, true, e.target.value || null);
                    }
                }}
                aria-label={tr('Категорія')}
                className={selectClass}
            >
                <option value="">{tr('Без категорії — банер')}</option>
                {categories.map((key) => (
                    <option key={key} value={key}>
                        {moodLabel(key)}
                    </option>
                ))}
            </select>
            {playlist.is_featured ? (
                <button
                    type="button"
                    onClick={() => feature(playlist, false, null)}
                    className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/60 transition hover:bg-rose-400/10 hover:text-rose-200"
                >
                    <X className="size-4" /> {tr('Прибрати')}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => feature(playlist, true, category || null)}
                    disabled={!playlist.is_public}
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-brand px-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                    <Plus className="size-4" /> {tr('У добірки')}
                </button>
            )}
        </div>
    );
}

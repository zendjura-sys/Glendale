import { Head, Link, router } from '@inertiajs/react';
import {
    Clock3,
    Disc3,
    ListMusic,
    Mic2,
    MoreHorizontal,
    Music2,
    Star,
    Tags,
    Upload,
} from 'lucide-react';
import { useState } from 'react';
import { CircleButton, NavRow, Tile } from '@/components/am/ui';
import { PlaylistCover } from '@/components/music/playlist-card';
import { SpotifyLogo, TrackCover } from '@/components/music/track-cover';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BackToGameCon, useUploadMusic } from '@/layouts/music-layout';
import { tr } from '@/lib/i18n';
import { playQueue } from '@/lib/player';
import type { RecentItem } from '@/types';

type Data = {
    counts: Record<
        'playlists' | 'artists' | 'albums' | 'songs' | 'favorites' | 'genres',
        number
    >;
    recently_added: RecentItem[];
};

const SECTIONS = [
    'playlists',
    'artists',
    'albums',
    'songs',
    'favorites',
    'genres',
    'spotify',
] as const;
type Section = (typeof SECTIONS)[number];

function sectionMeta(section: Section) {
    return {
        playlists: {
            label: tr('Плейлисти'),
            icon: <ListMusic className="size-[22px]" />,
        },
        artists: {
            label: tr('Виконавці'),
            icon: <Mic2 className="size-[22px]" />,
        },
        albums: {
            label: tr('Альбоми'),
            icon: <Disc3 className="size-[22px]" />,
        },
        songs: { label: tr('Пісні'), icon: <Music2 className="size-[22px]" /> },
        favorites: {
            label: tr('Улюблені пісні'),
            icon: <Star className="size-[22px]" />,
        },
        genres: { label: tr('Жанри'), icon: <Tags className="size-[22px]" /> },
        spotify: { label: 'Spotify', icon: <SpotifyLogo className="size-5" /> },
    }[section];
}

export default function MusicLibrary({
    data,
    sections,
}: {
    data: Data;
    sections: Section[];
}) {
    const upload = useUploadMusic();
    const [visible, setVisible] = useState<Section[]>(sections);

    // «Змінити»: які розділи показувати в медіатеці (зберігається на сервері).
    const toggleSection = (section: Section) => {
        const next = visible.includes(section)
            ? visible.filter((s) => s !== section)
            : SECTIONS.filter((s) => s === section || visible.includes(s));
        setVisible(next);
        router.post(
            '/music/library/sections',
            { sections: next },
            { preserveScroll: true, preserveState: true },
        );
    };

    return (
        <>
            <Head title={tr('Медіатека')} />
            <BackToGameCon />
            <header className="flex items-end justify-between px-[var(--am-gutter)] pt-1 pb-2 lg:pt-4">
                <h1 className="am-large-title">{tr('Медіатека')}</h1>
                <div className="mb-1 flex gap-2">
                    <CircleButton
                        label={tr('Завантажити музику')}
                        onClick={upload}
                    >
                        <Upload className="size-[18px]" />
                    </CircleButton>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            aria-label={tr('Змінити')}
                            className="flex size-9 items-center justify-center rounded-full bg-[var(--am-fill)] text-[var(--am-accent)] outline-none hover:bg-[var(--am-fill2)]"
                        >
                            <MoreHorizontal className="size-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="am w-60 rounded-2xl border-[var(--am-sep)] bg-[var(--am-elevated)] p-1.5 text-[var(--am-label)]"
                        >
                            <p className="am-footnote px-2.5 py-1.5 font-semibold text-[var(--am-label2)]">
                                {tr('Показувати в медіатеці')}
                            </p>
                            {SECTIONS.map((s) => (
                                <DropdownMenuCheckboxItem
                                    key={s}
                                    checked={visible.includes(s)}
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        toggleSection(s);
                                    }}
                                    className="rounded-lg text-[15px] focus:bg-[var(--am-fill)]"
                                >
                                    {sectionMeta(s).label}
                                </DropdownMenuCheckboxItem>
                            ))}
                            <DropdownMenuSeparator className="bg-[var(--am-sep)]" />
                            <DropdownMenuItem
                                className="rounded-lg text-[15px] focus:bg-[var(--am-fill)]"
                                onSelect={upload}
                            >
                                <Upload className="size-4" />{' '}
                                {tr('Завантажити музику')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <nav className="px-[var(--am-gutter)] lg:max-w-2xl">
                {visible.map((s) => {
                    const meta = sectionMeta(s);

                    return (
                        <NavRow
                            key={s}
                            href={`/music/library/${s}`}
                            icon={meta.icon}
                            label={meta.label}
                            count={s === 'spotify' ? undefined : data.counts[s]}
                        />
                    );
                })}
            </nav>

            <h2 className="am-title2 px-[var(--am-gutter)] pt-7 pb-3">
                {tr('Нещодавно додане')}
            </h2>
            {data.recently_added.length === 0 ? (
                <div className="px-[var(--am-gutter)]">
                    <p className="am-subhead text-[var(--am-label2)]">
                        {tr(
                            'Додавай пісні з «Нового» чи пошуку або завантаж свою музику.',
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={upload}
                        className="am-headline mt-3 text-[var(--am-accent)]"
                    >
                        {tr('Завантажити музику')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-[var(--am-gutter)] sm:grid-cols-3 lg:grid-cols-5">
                    {data.recently_added.map((item, i) => {
                        if (item.kind === 'album')
                            return (
                                <Tile
                                    key={`a${i}`}
                                    href={item.href}
                                    art={
                                        <TrackCover
                                            url={item.cover_url}
                                            seed={item.title}
                                            className="am-art aspect-square w-full"
                                        />
                                    }
                                    title={item.title}
                                    subtitle={item.subtitle}
                                />
                            );
                        if (item.kind === 'playlist')
                            return (
                                <Tile
                                    key={`p${i}`}
                                    href={item.href}
                                    art={
                                        <PlaylistCover
                                            playlist={item.playlist}
                                            className="am-art w-full rounded-[8px]"
                                        />
                                    }
                                    title={item.title}
                                    subtitle={tr('Плейлист')}
                                />
                            );

                        return (
                            <Tile
                                key={`t${i}`}
                                onClick={() => playQueue([item.track], 0)}
                                art={
                                    <TrackCover
                                        url={item.cover_url}
                                        seed={item.track.key}
                                        className="am-art aspect-square w-full"
                                    />
                                }
                                title={item.title}
                                subtitle={item.subtitle}
                            />
                        );
                    })}
                </div>
            )}
            <p className="am-footnote px-[var(--am-gutter)] pt-6 text-[var(--am-label3)]">
                <Clock3 className="mr-1 inline size-3.5" />
                {tr(
                    'Тут останні 60 доданих альбомів, пісень і плейлистів.',
                )}{' '}
                <Link
                    href="/music/library/songs"
                    className="text-[var(--am-accent)]"
                >
                    {tr('Усі пісні')}
                </Link>
            </p>
        </>
    );
}

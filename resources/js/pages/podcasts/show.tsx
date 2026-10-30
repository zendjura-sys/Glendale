import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Bell,
    BellOff,
    Headphones,
    Trash2,
    Upload,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { PodcastCover } from './index';
import type { PodcastCard } from './index';

type Episode = {
    id: number;
    title: string;
    description: string | null;
    url: string;
    duration: number;
    plays: number;
    created_at: string;
};

const field =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';
const mmss = (s: number) =>
    s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';

/** Сторінка подкасту: підписка, випуски з плеєром, завантаження нового випуску (автору). */
export default function PodcastShow({
    podcast,
    episodes,
    own,
}: {
    podcast: PodcastCard;
    episodes: Episode[];
    own: boolean;
}) {
    const [subscribed, setSubscribed] = useState(podcast.subscribed);
    const [subscribers, setSubscribers] = useState(podcast.subscribers);
    const form = useForm<{
        title: string;
        description: string;
        audio: File | null;
    }>({ title: '', description: '', audio: null });
    const played = new Set<number>();

    return (
        <>
            <Head title={podcast.title} />
            <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
                <Link
                    href="/podcasts"
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Подкасти')}
                </Link>
                <div className="glass flex flex-col gap-4 rounded-2xl p-4 sm:flex-row">
                    <PodcastCover
                        podcast={podcast}
                        className="w-32 shrink-0 sm:w-40"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/45">
                            {tr(podcast.category)}
                        </p>
                        <h1 className="font-display text-2xl font-semibold text-white">
                            {podcast.title}
                        </h1>
                        {podcast.author && (
                            <Link
                                href={`/${podcast.author.username}`}
                                className="text-sm text-gc-lilac-300 hover:text-white"
                            >
                                {podcast.author.name}
                            </Link>
                        )}
                        {podcast.description && (
                            <p className="mt-2 text-sm whitespace-pre-line text-white/70">
                                {podcast.description}
                            </p>
                        )}
                        <div className="mt-3 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    void api<{
                                        subscribed: boolean;
                                        subscribers: number;
                                    }>(
                                        'POST',
                                        `/podcasts/${podcast.id}/subscribe`,
                                    ).then((d) => {
                                        setSubscribed(d.subscribed);
                                        setSubscribers(d.subscribers);
                                    })
                                }
                                className={cn(
                                    'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition',
                                    subscribed
                                        ? 'bg-white/[0.08] text-white'
                                        : 'btn-glow',
                                )}
                            >
                                {subscribed ? (
                                    <BellOff className="size-4" />
                                ) : (
                                    <Bell className="size-4" />
                                )}
                                {subscribed
                                    ? tr('Ви підписані')
                                    : tr('Підписатися')}
                            </button>
                            <span className="text-sm text-white/50">
                                {tr('Підписників: {count}', {
                                    count: subscribers,
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                {own && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(`/podcasts/${podcast.id}/episodes`, {
                                forceFormData: true,
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                        className="glass space-y-3 rounded-2xl p-4"
                    >
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                            <Upload className="size-4" />
                            {tr('Новий випуск')}
                        </h2>
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Назва випуску')}
                            maxLength={160}
                            className={field}
                        />
                        <textarea
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder={tr('Опис і таймкоди (необовʼязково)')}
                            rows={3}
                            maxLength={5000}
                            className={cn(field, 'h-auto resize-y py-2.5')}
                        />
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) =>
                                form.setData(
                                    'audio',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                            className="block text-sm text-white/70"
                        />
                        {form.progress && (
                            <div className="h-1 overflow-hidden rounded-full bg-white/5">
                                <div
                                    className="h-full bg-gradient-brand"
                                    style={{
                                        width: `${form.progress.percentage}%`,
                                    }}
                                />
                            </div>
                        )}
                        {Object.values(form.errors)[0] && (
                            <p className="text-xs text-rose-300">
                                {Object.values(form.errors)[0]}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    !form.data.audio ||
                                    form.data.title.trim().length < 3
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Опублікувати')}
                            </button>
                        </div>
                    </form>
                )}

                <ul className="space-y-3">
                    {episodes.length === 0 && (
                        <li className="glass rounded-2xl p-6 text-center text-sm text-white/50">
                            {tr('Випусків ще немає.')}
                        </li>
                    )}
                    {episodes.map((e) => (
                        <li key={e.id} className="glass rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-white">
                                        {e.title}
                                    </p>
                                    <p className="text-xs text-white/45">
                                        {formatDate(e.created_at)}
                                        {e.duration > 0 &&
                                            ` · ${mmss(e.duration)}`}
                                        <span className="ml-2 inline-flex items-center gap-1">
                                            <Headphones className="size-3" />{' '}
                                            {e.plays}
                                        </span>
                                    </p>
                                </div>
                                {own && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            window.confirm(
                                                tr('Видалити випуск?'),
                                            ) &&
                                            router.delete(
                                                `/podcasts/${podcast.id}/episodes/${e.id}`,
                                                { preserveScroll: true },
                                            )
                                        }
                                        aria-label={tr('Видалити')}
                                        className="text-white/35 hover:text-rose-300"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </div>
                            {e.description && (
                                <p className="mt-2 text-sm whitespace-pre-line text-white/70">
                                    {e.description}
                                </p>
                            )}
                            <audio
                                src={e.url}
                                controls
                                preload="none"
                                className="mt-3 w-full"
                                onPlay={() => {
                                    if (played.has(e.id)) return;
                                    played.add(e.id);
                                    void api(
                                        'POST',
                                        `/podcasts/${podcast.id}/episodes/${e.id}/play`,
                                    ).catch(() => undefined);
                                }}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}

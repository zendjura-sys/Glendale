import { Link, router, useForm } from '@inertiajs/react';
import { Radio, Tv } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type StreamInfo = {
    platform: 'twitch' | 'youtube';
    platform_label: string;
    channel: string;
    url: string;
    live: boolean;
    manual: boolean;
    title: string | null;
    game: string | null;
    viewers: number | null;
    embed: string | null;
    user: UserCard | null;
};

/** Червона позначка LIVE. */
export function LiveBadge({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase',
                className,
            )}
        >
            <span className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
            Live
        </span>
    );
}

/** Ефір у профілі: плеєр, коли в ефірі; інакше — посилання на канал. */
export function ProfileStream({ stream }: { stream: StreamInfo }) {
    if (!stream.live) {
        return (
            <a
                href={stream.url}
                target="_blank"
                rel="noreferrer noopener"
                className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/75 transition hover:text-white"
            >
                <Tv className="size-4 shrink-0 text-gc-lilac-300" />
                <span className="min-w-0 flex-1 truncate">
                    {tr('Стрімить на {platform}', {
                        platform: stream.platform_label,
                    })}{' '}
                    · {stream.channel}
                </span>
            </a>
        );
    }

    return (
        <section className="glass overflow-hidden rounded-3xl">
            {stream.embed && (
                <div className="relative aspect-video w-full bg-black">
                    <iframe
                        src={stream.embed}
                        title={stream.title ?? stream.channel}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        className="absolute inset-0 size-full"
                    />
                </div>
            )}
            <div className="flex items-center gap-3 p-4">
                <LiveBadge />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                        {stream.title ?? tr('Зараз в ефірі')}
                    </div>
                    <div className="truncate text-xs text-white/45">
                        {[
                            stream.platform_label,
                            stream.game,
                            stream.viewers !== null
                                ? tr('{n} глядачів', {
                                      n: shortNumber(stream.viewers),
                                  })
                                : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </div>
                </div>
                <a
                    href={stream.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="shrink-0 rounded-xl bg-white/[0.08] px-3 py-2 text-sm font-medium text-white hover:bg-white/[0.12]"
                >
                    {tr('Відкрити')}
                </a>
            </div>
        </section>
    );
}

/** У стрічці: друзі, які зараз в ефірі. */
export function FriendsLive({ streams }: { streams: StreamInfo[] }) {
    if (streams.length === 0) return null;

    return (
        <section className="glass rounded-3xl p-4">
            <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-[13px] font-semibold tracking-wide text-white/90 uppercase">
                <Radio className="size-4 text-rose-400" />
                {tr('Друзі в ефірі')}
            </h2>
            <div className="-mx-1 scrollbar-none flex gap-2 overflow-x-auto px-1">
                {streams.map((s) =>
                    s.user ? (
                        <Link
                            key={s.user.id}
                            href={`/${s.user.username}`}
                            className="flex w-56 shrink-0 items-center gap-3 rounded-2xl bg-white/[0.04] p-2.5 transition hover:bg-white/[0.07]"
                        >
                            <span className="relative">
                                <UserAvatar
                                    user={s.user}
                                    size="md"
                                    showOnline={false}
                                />
                                <LiveBadge className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 py-0 text-[8px]" />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-white">
                                    {s.user.name}
                                </span>
                                <span className="block truncate text-xs text-white/45">
                                    {s.game ?? s.title ?? s.platform_label}
                                </span>
                            </span>
                        </Link>
                    ) : null,
                )}
            </div>
        </section>
    );
}

/** Налаштування: свій канал і ручна позначка «Я в ефірі». */
export function StreamSettings({ stream }: { stream: StreamInfo | null }) {
    const form = useForm({
        platform: stream?.platform ?? 'twitch',
        channel: stream?.channel ?? '',
    });
    const options = { preserveScroll: true };

    return (
        <div className="space-y-3">
            <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
                {(['twitch', 'youtube'] as const).map((p) => (
                    <button
                        key={p}
                        type="button"
                        aria-pressed={form.data.platform === p}
                        onClick={() => form.setData('platform', p)}
                        className={cn(
                            'h-9 flex-1 rounded-lg text-sm font-medium transition',
                            form.data.platform === p
                                ? 'bg-white/10 text-white'
                                : 'text-white/55 hover:text-white',
                        )}
                    >
                        {p === 'twitch' ? 'Twitch' : 'YouTube'}
                    </button>
                ))}
            </div>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.put('/settings/stream', options);
                }}
                className="flex flex-col gap-2 sm:flex-row"
            >
                <input
                    value={form.data.channel}
                    onChange={(e) => form.setData('channel', e.target.value)}
                    placeholder={
                        form.data.platform === 'twitch'
                            ? 'twitch.tv/nickname'
                            : 'youtube.com/@channel'
                    }
                    className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={form.processing || !form.data.channel.trim()}
                    className="btn-glow h-11 shrink-0 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                >
                    {tr('Зберегти')}
                </button>
            </form>
            {form.errors.channel && (
                <p className="text-xs text-rose-300">{form.errors.channel}</p>
            )}
            {stream && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3">
                    <span className="min-w-0 flex-1 text-sm text-white/70">
                        {stream.live ? (
                            <span className="inline-flex items-center gap-2">
                                <LiveBadge /> {tr('Ви в ефірі')}
                            </span>
                        ) : (
                            tr('Зараз не в ефірі')
                        )}
                    </span>
                    {!stream.live || stream.manual ? (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    '/settings/stream/live',
                                    { on: !stream.manual },
                                    options,
                                )
                            }
                            className="h-9 rounded-xl bg-white/[0.08] px-3 text-sm font-medium text-white hover:bg-white/[0.12]"
                        >
                            {stream.manual
                                ? tr('Завершити ефір')
                                : tr('Я в ефірі')}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() =>
                            router.delete('/settings/stream', options)
                        }
                        className="h-9 rounded-xl px-3 text-sm font-medium text-rose-200 hover:bg-rose-400/10"
                    >
                        {tr('Прибрати')}
                    </button>
                </div>
            )}
            <p className="text-xs text-white/40">
                {tr(
                    'Позначка LIVE з’являється сама, коли почнеться ефір. Друзі отримають сповіщення.',
                )}
            </p>
        </div>
    );
}

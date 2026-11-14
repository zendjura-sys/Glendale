import { Head, Link, router } from '@inertiajs/react';
import { ExternalLink, Radio, Users } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { LiveBadge } from '@/components/streams/stream';
import type { StreamInfo } from '@/components/streams/stream';
import { shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Props = {
    streams: StreamInfo[];
    games: { name: string; count: number }[];
    game: string | null;
};

export default function LiveNow({ streams, games, game }: Props) {
    const reduce = useReducedMotion();
    const [first, ...rest] = streams;
    const pick = (g: string | null) =>
        router.get('/streams/live', g ? { game: g } : {}, {
            preserveScroll: true,
        });

    return (
        <>
            <Head title={tr('Зараз в ефірі')} />
            <div className="mx-auto max-w-5xl space-y-5">
                <header className="flex flex-wrap items-end gap-3">
                    <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-white">
                        <Radio className="size-7 text-red-400" />
                        {tr('Зараз в ефірі')}
                    </h1>
                    <span className="pb-1 text-sm text-white/55">
                        {tr('{n} стрімерів GameCon на Twitch і YouTube', {
                            n: streams.length,
                        })}
                    </span>
                </header>

                {games.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => pick(null)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-sm',
                                !game
                                    ? 'bg-primary text-white'
                                    : 'gc-solid text-white/70',
                            )}
                        >
                            {tr('Усі')}
                        </button>
                        {games.map((g) => (
                            <button
                                key={g.name}
                                type="button"
                                onClick={() => pick(g.name)}
                                className={cn(
                                    'rounded-full px-3 py-1.5 text-sm',
                                    game === g.name
                                        ? 'bg-primary text-white'
                                        : 'gc-solid text-white/70',
                                )}
                            >
                                {g.name}{' '}
                                <span className="opacity-60">{g.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {!first ? (
                    <section className="gc-solid rounded-2xl p-8 text-center">
                        <p className="text-white/70">
                            {tr(
                                'Зараз ніхто не стрімить. Додайте свій канал у налаштуваннях — і ваш ефір з’явиться тут.',
                            )}
                        </p>
                    </section>
                ) : (
                    <>
                        <m.section
                            initial={reduce ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, RISE)}
                            className="gc-solid overflow-hidden rounded-2xl"
                        >
                            {first.embed ? (
                                <iframe
                                    src={first.embed}
                                    title={first.title ?? first.channel}
                                    allowFullScreen
                                    className="aspect-video w-full bg-black"
                                />
                            ) : null}
                            <StreamRow stream={first} big />
                        </m.section>
                        {rest.length > 0 && (
                            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {rest.map((s) => (
                                    <li
                                        key={`${s.platform}:${s.channel}`}
                                        className="gc-solid rounded-2xl"
                                    >
                                        <StreamRow stream={s} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

function StreamRow({
    stream,
    big = false,
}: {
    stream: StreamInfo;
    big?: boolean;
}) {
    return (
        <div className="flex items-center gap-3 p-3">
            {stream.user && (
                <Link href={`/${stream.user.username}`} className="shrink-0">
                    <UserAvatar
                        user={stream.user}
                        size={big ? 'lg' : 'md'}
                        showOnline={false}
                    />
                </Link>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <LiveBadge />
                    <span className="truncate text-sm font-semibold text-white">
                        {stream.user?.name ?? stream.channel}
                    </span>
                </div>
                <div
                    className={cn(
                        'truncate text-white/70',
                        big ? 'text-base' : 'text-xs',
                    )}
                >
                    {stream.title ?? stream.platform_label}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/45">
                    {stream.game && (
                        <span className="truncate">{stream.game}</span>
                    )}
                    {stream.viewers !== null && (
                        <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {shortNumber(stream.viewers)}
                        </span>
                    )}
                </div>
            </div>
            <a
                href={stream.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tr('Відкрити на {p}', { p: stream.platform_label })}
                className="shrink-0 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
                <ExternalLink className="size-4" />
            </a>
        </div>
    );
}

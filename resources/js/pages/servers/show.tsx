import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Crown,
    MessageCircle,
    Plus,
    Trophy,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { EventList, ServerEventForm } from '@/components/events/event-card';
import type { CalendarEvent } from '@/components/events/event-card';
import { PlayingNow } from '@/components/gc/playing';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import { FollowButton } from '@/components/gc/follow-button';
import { PinButton } from '@/components/gc/pin-button';
import { SaveButton } from '@/components/gc/save-button';
import { EmptyState } from '@/components/gc/widget';
import { FamilyLogo } from '@/components/families/family-logo';
import { ConnectButton, ServerLinks } from '@/components/servers/server-card';
import { OnlineMeter, ServerIcon } from '@/components/servers/server-icon';
import { timeAgo } from '@/lib/format';
import { cn, formText } from '@/lib/utils';
import type { FamilyCard, GtaServerCard, UserCard } from '@/types';
import { LOCALE, tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

type Props = {
    server: GtaServerCard & {
        description: string | null;
        icon_source: string | null;
        origin: string;
    };
    families: (FamilyCard & { score: number })[];
    events: CalendarEvent[];
    event_hosts: { id: number | null; name: string }[];
    event_types: Record<string, string>;
    discord_events: { connected: boolean; invite: string | null };
    playing_now: UserCard[];
    playing_count: number;
    saved: boolean;
    following: boolean;
    pinned: boolean;
    invites: {
        kind: 'family' | 'clan';
        id: number;
        name: string;
        href: string;
    }[];
    reviews: {
        average: number | null;
        count: number;
        can_review: boolean;
        items: {
            name: string;
            username: string;
            stars: number;
            body: string;
        }[];
    };
    ownership: {
        owner: UserCard | null;
        is_owner: boolean;
        can_tag: boolean;
        claim: string | null;
        news: { id: number; body: string; name: string }[];
        pending: {
            id: number;
            name: string;
            username: string;
            message: string | null;
        }[];
    };
    online: { day: string; players: number }[];
    similar: GtaServerCard[];
};

export default function ServerShow({
    server,
    families,
    events,
    event_hosts,
    event_types,
    discord_events,
    playing_now,
    playing_count,
    saved,
    following,
    pinned,
    invites,
    reviews,
    ownership,
    online,
    similar,
}: Props) {
    const [inviteUsername, setInviteUsername] = useState('');
    const compareOn = usePlugin('server_compare');
    const chartOn = usePlugin('server_online');
    const tagsOn = usePlugin('server_tags');
    const similarOn = usePlugin('similar_servers');
    const newsOn = usePlugin('server_news');
    const claimOn = usePlugin('server_claim');
    const [inviteTarget, setInviteTarget] = useState(
        invites[0] ? `${invites[0].kind}:${invites[0].id}` : '',
    );
    return (
        <>
            <Head title={server.name} />
            <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-4">
                    <Link
                        href="/servers"
                        className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
                    >
                        <ArrowLeft className="size-4" /> {tr('Усі сервери')}
                    </Link>
                    {compareOn && (
                        <Link
                            href={`/servers/compare?a=${server.slug}`}
                            className="text-sm text-white/50 hover:text-white"
                        >
                            {tr('Порівняти з іншим')}
                        </Link>
                    )}
                </div>

                <section className="glass noise relative overflow-hidden rounded-3xl p-6 sm:p-8">
                    {server.icon && (
                        <img
                            src={server.icon}
                            alt=""
                            className="pointer-events-none absolute -top-20 -right-20 size-[420px] rounded-full object-cover opacity-[0.07] blur-2xl"
                        />
                    )}
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                        <ServerIcon
                            name={server.name}
                            icon={server.icon}
                            className="size-24 rounded-3xl"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/65">
                                    {server.platform_label}
                                </span>
                                <span className="rounded-full bg-gc-indigo/15 px-2 py-0.5 text-[#b9b0ff]">
                                    {server.multiplayer_label}
                                </span>
                                <span className="rounded-full bg-[#facc15]/10 px-2 py-0.5 text-[#fde68a]">
                                    {server.language === 'uk'
                                        ? tr('🇺🇦 Україна')
                                        : server.language.toUpperCase()}
                                </span>
                            </div>
                            <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
                                {server.name}
                            </h1>
                            {server.tagline && (
                                <p className="mt-1.5 text-sm text-white/55">
                                    {server.tagline}
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                {server.connect && (
                                    <ConnectButton value={server.connect} />
                                )}
                                <SaveButton
                                    kind="server"
                                    id={server.id}
                                    saved={saved}
                                />
                                <FollowButton
                                    kind="server"
                                    id={server.id}
                                    following={following}
                                />
                                <PinButton
                                    kind="server"
                                    id={server.id}
                                    pinned={pinned}
                                />
                                {invites.length > 0 && (
                                    <form
                                        className="flex flex-wrap items-center gap-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const [kind, id] =
                                                inviteTarget.split(':');
                                            router.post(
                                                `/servers/${server.slug}/invite`,
                                                {
                                                    kind,
                                                    id: Number(id),
                                                    username: inviteUsername,
                                                },
                                            );
                                        }}
                                    >
                                        <select
                                            value={inviteTarget}
                                            onChange={(event) =>
                                                setInviteTarget(
                                                    event.target.value,
                                                )
                                            }
                                            className="h-11 rounded-xl bg-white/10 px-3 text-sm text-white"
                                        >
                                            {invites.map((item) => (
                                                <option
                                                    key={`${item.kind}-${item.id}`}
                                                    value={`${item.kind}:${item.id}`}
                                                >
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            value={inviteUsername}
                                            onChange={(event) =>
                                                setInviteUsername(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder={tr('Ім’я друга')}
                                            className="h-11 rounded-xl bg-white/10 px-3 text-sm text-white placeholder:text-white/40"
                                        />
                                        <button
                                            type="submit"
                                            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black"
                                        >
                                            {tr('Запросити')}
                                        </button>
                                    </form>
                                )}
                                <ServerLinks server={server} />
                            </div>
                        </div>
                        <div className="w-full space-y-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.06] sm:w-64">
                            <OnlineMeter
                                online={server.players_online}
                                max={server.players_max}
                            />
                            {server.players_peak !== null && (
                                <div className="text-xs text-white/45">
                                    {tr('Пік:')}{' '}
                                    <span className="font-semibold text-white/80">
                                        {server.players_peak.toLocaleString(
                                            LOCALE,
                                        )}
                                    </span>
                                </div>
                            )}
                            {server.discord_members !== null && (
                                <div className="flex items-center gap-2 text-xs text-white/55">
                                    <MessageCircle className="size-3.5 text-gc-lilac-400" />
                                    {server.discord_members.toLocaleString(
                                        LOCALE,
                                    )}{' '}
                                    {tr('у Discord')}
                                    {server.discord_online !== null &&
                                        tr(' · {toLocaleString} в мережі', {
                                            toLocaleString:
                                                server.discord_online.toLocaleString(
                                                    LOCALE,
                                                ),
                                        })}
                                </div>
                            )}
                            {server.stats_updated_at && (
                                <div className="text-xs text-white/30">
                                    {tr('Оновлено')}{' '}
                                    {timeAgo(server.stats_updated_at)}
                                </div>
                            )}
                        </div>
                    </div>
                    {server.description && (
                        <p className="relative mt-6 max-w-3xl text-sm leading-relaxed whitespace-pre-line text-white/60">
                            {server.description}
                        </p>
                    )}
                </section>

                <VoiceRooms
                    owner={{ type: 'server', id: server.id }}
                    label={server.name}
                    href={`/servers/${server.slug}`}
                />
                <PlayingNow users={playing_now} count={playing_count} />
                <section className="glass rounded-3xl p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <CalendarDays className="size-5 text-gc-lilac-200" />{' '}
                        {tr('Події сервера')}
                    </h2>
                    {events.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('Найближчих подій немає.')}
                            {event_hosts.length > 0 &&
                                tr(
                                    ' Додайте першу — її побачать усі сім’ї сервера в календарі.',
                                )}
                        </p>
                    ) : (
                        <EventList events={events} />
                    )}
                    {discord_events.connected ? (
                        <p className="mt-3 text-xs text-white/40">
                            {tr(
                                'Події з Discord проєкту підтягуються автоматично.',
                            )}
                        </p>
                    ) : (
                        discord_events.invite && (
                            <p className="mt-3 text-xs text-white/45">
                                {tr('Адміністрація проєкту? Додайте')}{' '}
                                <a
                                    href={discord_events.invite}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-gc-lilac-200 hover:text-white"
                                >
                                    {tr('бота GameCon')}
                                </a>{' '}
                                {tr(
                                    'на свій Discord — заплановані події звідти самі з’являться тут і в календарі гравців.',
                                )}
                            </p>
                        )
                    )}
                    {event_hosts.length > 0 && (
                        <details className="mt-4 rounded-2xl bg-white/[0.03] p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-white/80">
                                {tr('Нова подія сервера')}
                            </summary>
                            <div className="mt-3">
                                <ServerEventForm
                                    serverSlug={server.slug}
                                    hosts={event_hosts}
                                    types={event_types}
                                />
                            </div>
                        </details>
                    )}
                </section>
                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-semibold text-white">
                        {tr('Відгуки')}
                        {reviews.average !== null && (
                            <span className="ml-2 text-sm font-medium text-amber-200">
                                {reviews.average} · {reviews.count}
                            </span>
                        )}
                    </h2>
                    {reviews.can_review && (
                        <form
                            className="mt-3 space-y-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                const form = new FormData(event.currentTarget);
                                router.post(`/servers/${server.slug}/reviews`, {
                                    stars: Number(form.get('stars')),
                                    body: formText(form, 'body'),
                                });
                            }}
                        >
                            <select
                                name="stars"
                                defaultValue="5"
                                className="h-11 rounded-xl bg-white/10 px-3 text-sm text-white"
                            >
                                {[5, 4, 3, 2, 1].map((star) => (
                                    <option key={star} value={star}>
                                        {star}
                                    </option>
                                ))}
                            </select>
                            <textarea
                                name="body"
                                required
                                maxLength={500}
                                placeholder={tr('Як тут грається')}
                                className="min-h-20 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
                            />
                            <button
                                type="submit"
                                className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black"
                            >
                                {tr('Залишити відгук')}
                            </button>
                        </form>
                    )}
                    <div className="mt-4 space-y-3">
                        {reviews.items.map((review) => (
                            <div
                                key={`${review.username}-${review.body.slice(0, 12)}`}
                                className="rounded-2xl bg-white/[0.04] p-3"
                            >
                                <Link
                                    href={`/${review.username}`}
                                    className="text-sm font-medium text-white"
                                >
                                    {review.name}
                                </Link>
                                <p className="text-xs text-amber-200">
                                    {'★'.repeat(review.stars)}
                                </p>
                                <p className="mt-1 text-sm text-white/75">
                                    {review.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="glass rounded-3xl p-5">
                    <header className="mb-4 flex flex-wrap items-center gap-3">
                        <Trophy className="size-5 text-amber-300" />
                        <h2 className="font-display text-lg font-semibold text-white">
                            {tr('Рейтинг сімей сервера')}
                        </h2>
                        <span className="text-xs text-white/40">
                            {tr('бали за поточний місяць')}
                        </span>
                        <Link
                            href={`/families/create?server=${server.slug}`}
                            className="btn-glow ml-auto inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="size-4" />{' '}
                            {tr('Зареєструвати сім’ю')}
                        </Link>
                    </header>
                    {families.length === 0 ? (
                        <EmptyState
                            icon={Crown}
                            title={tr('Тут ще немає сімей')}
                            text={tr(
                                'Станьте першими: створіть сім’ю й ведіть звіти, банк і склад на GameCon.',
                            )}
                        />
                    ) : (
                        <div className="divide-y divide-white/[0.05]">
                            {families.map((family, i) => (
                                <Link
                                    key={family.id}
                                    href={`/f/${family.slug}`}
                                    className="flex items-center gap-4 rounded-2xl px-2 py-3 transition hover:bg-white/[0.03]"
                                >
                                    <span
                                        className={cn(
                                            'w-7 text-center font-display text-lg font-bold',
                                            i === 0
                                                ? 'text-amber-300'
                                                : i === 1
                                                  ? 'text-slate-200'
                                                  : i === 2
                                                    ? 'text-orange-300'
                                                    : 'text-white/30',
                                        )}
                                    >
                                        {i + 1}
                                    </span>
                                    <FamilyLogo family={family} />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold text-white">
                                            <span className="text-gc-lilac-200">
                                                [{family.tag}]
                                            </span>{' '}
                                            {family.name}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-white/45">
                                            <UsersRound className="size-3" />
                                            {family.members_count}{' '}
                                            {tr('учасників')}
                                            {family.is_recruiting &&
                                                tr(' · набір відкрито')}
                                        </div>
                                    </div>
                                    <span className="font-display text-lg font-bold text-white">
                                        {family.score}
                                        <span className="ml-1 text-xs font-medium text-white/40">
                                            {tr('балів')}
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {(chartOn || tagsOn || similarOn) && (
                    <section className="glass space-y-4 rounded-3xl p-5">
                        {chartOn && (
                            <h2 className="font-display text-xl font-bold text-white">
                                {tr('Онлайн за два тижні')}
                            </h2>
                        )}
                        {chartOn &&
                            (online.length === 0 ? (
                                <p className="text-sm text-white/45">
                                    {tr('Ще немає зрізів онлайну.')}
                                </p>
                            ) : (
                                <div className="flex h-24 items-end gap-1">
                                    {online.map((point) => {
                                        const peak = Math.max(
                                            ...online.map((row) => row.players),
                                            1,
                                        );

                                        return (
                                            <div
                                                key={point.day}
                                                className="flex flex-1 flex-col items-center gap-1"
                                            >
                                                <div
                                                    className="w-full rounded-t bg-emerald-300/80"
                                                    style={{
                                                        height: `${Math.max(8, (point.players / peak) * 72)}px`,
                                                    }}
                                                    title={`${point.day}: ${point.players}`}
                                                />
                                                <span className="text-[10px] text-white/35">
                                                    {point.players}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        {tagsOn && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                                {server.tags?.mode && (
                                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                                        {server.tags.mode.toUpperCase()}
                                    </span>
                                )}
                                {server.tags?.region && (
                                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                                        {server.tags.region}
                                    </span>
                                )}
                            </div>
                        )}
                        {tagsOn && ownership.can_tag && (
                            <form
                                className="flex flex-wrap gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const data = new FormData(
                                        event.currentTarget,
                                    );
                                    router.post(
                                        `/servers/${server.slug}/tags`,
                                        {
                                            mode: formText(data, 'mode'),
                                            region: formText(data, 'region'),
                                        },
                                    );
                                }}
                            >
                                <select
                                    name="mode"
                                    defaultValue={server.tags?.mode ?? 'rp'}
                                    className="h-10 rounded-xl bg-white/10 px-3 text-sm text-white"
                                >
                                    <option value="rp">RP</option>
                                    <option value="pvp">PvP</option>
                                    <option value="mixed">
                                        {tr('RP і PvP')}
                                    </option>
                                </select>
                                <input
                                    name="region"
                                    defaultValue={server.tags?.region ?? ''}
                                    placeholder={tr('Регіон')}
                                    className="input-glass h-10 rounded-xl px-3 text-sm text-white"
                                />
                                <button
                                    type="submit"
                                    className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-black"
                                >
                                    {tr('Зберегти теги')}
                                </button>
                            </form>
                        )}
                        {similarOn && similar.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {similar.map((item) => (
                                    <Link
                                        key={item.id}
                                        href={`/servers/${item.slug}`}
                                        className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 hover:text-white"
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {(newsOn || claimOn) && (
                    <section className="glass space-y-4 rounded-3xl p-5">
                        {newsOn && (
                            <h2 className="font-display text-xl font-bold text-white">
                                {tr('Новини власника')}
                            </h2>
                        )}
                        {ownership.owner && (
                            <p className="text-sm text-white/55">
                                {tr('Власник:')} {ownership.owner.name}
                            </p>
                        )}
                        {newsOn && ownership.news.length === 0 ? (
                            <p className="text-sm text-white/45">
                                {tr('Новин ще немає.')}
                            </p>
                        ) : (
                            ownership.news.map((item) => (
                                <article
                                    key={item.id}
                                    className="rounded-2xl bg-white/[0.04] px-4 py-3"
                                >
                                    <div className="text-xs text-white/40">
                                        {item.name}
                                    </div>
                                    <p className="mt-1 text-sm whitespace-pre-wrap text-white/85">
                                        {item.body}
                                    </p>
                                </article>
                            ))
                        )}
                        {newsOn && ownership.is_owner && (
                            <form
                                className="flex flex-col gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const data = new FormData(
                                        event.currentTarget,
                                    );
                                    router.post(
                                        `/servers/${server.slug}/news`,
                                        {
                                            body: formText(data, 'body'),
                                        },
                                    );
                                    event.currentTarget.reset();
                                }}
                            >
                                <textarea
                                    name="body"
                                    required
                                    maxLength={1000}
                                    rows={3}
                                    placeholder={tr(
                                        'Новина для сторінки сервера',
                                    )}
                                    className="input-glass rounded-xl px-3 py-2 text-sm text-white"
                                />
                                <button
                                    type="submit"
                                    className="h-10 self-start rounded-xl bg-white px-4 text-sm font-semibold text-black"
                                >
                                    {tr('Опублікувати')}
                                </button>
                            </form>
                        )}
                        {claimOn &&
                            !ownership.is_owner &&
                            ownership.claim !== 'pending' && (
                                <form
                                    className="flex flex-col gap-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        const data = new FormData(
                                            event.currentTarget,
                                        );
                                        router.post(
                                            `/servers/${server.slug}/claim`,
                                            {
                                                message: formText(
                                                    data,
                                                    'message',
                                                ),
                                            },
                                        );
                                    }}
                                >
                                    <input
                                        name="message"
                                        placeholder={tr('Чому це ваш сервер')}
                                        className="input-glass h-11 rounded-xl px-3 text-sm text-white"
                                    />
                                    <button
                                        type="submit"
                                        className="h-10 self-start rounded-xl bg-white/10 px-4 text-sm text-white"
                                    >
                                        {tr('Це мій сервер')}
                                    </button>
                                </form>
                            )}
                        {claimOn && ownership.claim === 'pending' && (
                            <p className="text-sm text-white/55">
                                {tr('Заявку надіслано, чекаємо підтвердження.')}
                            </p>
                        )}
                        {claimOn &&
                            ownership.pending.map((claim) => (
                                <div
                                    key={claim.id}
                                    className="flex flex-wrap items-center gap-2 text-sm text-white/75"
                                >
                                    <span>
                                        {claim.name}
                                        {claim.message
                                            ? ` — ${claim.message}`
                                            : ''}
                                    </span>
                                    <button
                                        type="button"
                                        className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-black"
                                        onClick={() =>
                                            router.post(
                                                `/servers/${server.slug}/claims/${claim.id}`,
                                                { status: 'approved' },
                                            )
                                        }
                                    >
                                        {tr('Підтвердити')}
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white"
                                        onClick={() =>
                                            router.post(
                                                `/servers/${server.slug}/claims/${claim.id}`,
                                                { status: 'rejected' },
                                            )
                                        }
                                    >
                                        {tr('Відхилити')}
                                    </button>
                                </div>
                            ))}
                    </section>
                )}
            </div>
        </>
    );
}

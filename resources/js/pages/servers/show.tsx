import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Crown,
    MessageCircle,
    Plus,
    Trophy,
    UsersRound,
} from 'lucide-react';
import { EventList, ServerEventForm } from '@/components/events/event-card';
import type { CalendarEvent } from '@/components/events/event-card';
import { PlayingNow } from '@/components/gc/playing';
import { EmptyState } from '@/components/gc/widget';
import { FamilyLogo } from '@/components/families/family-logo';
import { ConnectButton, ServerLinks } from '@/components/servers/server-card';
import { OnlineMeter, ServerIcon } from '@/components/servers/server-icon';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { FamilyCard, GtaServerCard, UserCard } from '@/types';
import { LOCALE, tr } from '@/lib/i18n';

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
}: Props) {
    return (
        <>
            <Head title={server.name} />
            <div className="space-y-5">
                <Link
                    href="/servers"
                    className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> {tr('Усі сервери')}
                </Link>

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
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/65">
                                    {server.platform_label}
                                </span>
                                <span className="rounded-full bg-[#6d5dfc]/15 px-2 py-0.5 text-[#b9b0ff]">
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
                                    <MessageCircle className="size-3.5 text-[#8fa0ff]" />
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
                                <div className="text-[11px] text-white/30">
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

                <PlayingNow users={playing_now} count={playing_count} />
                <section className="glass rounded-3xl p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <CalendarDays className="size-5 text-[#a5b4fc]" />{' '}
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
                                    className="text-[#a5b4fc] hover:text-white"
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
                                            <span className="text-[#a5b4fc]">
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
            </div>
        </>
    );
}

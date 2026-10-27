import { Link } from '@inertiajs/react';
import { ArrowUp, Clock3, Gamepad2, Server, Users, Vote } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { clockTime, dayLabel } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import type { TimePollData } from './time-poll';

export type PartyCardData = {
    id: number;
    href: string;
    title: string;
    note: string | null;
    platform: string | null;
    platform_label: string | null;
    roles: string[];
    taken_roles: string[];
    slots: number;
    count: number;
    starts_at: string | null;
    expires_at: string;
    open: boolean;
    /** GameCon+: підняте нагору на годину. */
    bumped?: boolean;
    mine: boolean;
    joined: boolean;
    host: UserCard;
    game: { slug: string; name: string; cover: string | null } | null;
    server: { slug: string; name: string; icon: string | null } | null;
    members: (UserCard & { role: string | null })[];
    /** Голосування за час гри (null — час задав автор). */
    time_poll?: TimePollData | null;
};

export const PARTY_PLATFORMS = (): Record<string, string> => ({
    pc: tr('ПК'),
    playstation: 'PlayStation',
    xbox: 'Xbox',
    switch: 'Switch',
    mobile: tr('Мобільні'),
});

/** «Зараз» або «Сьогодні · 20:00». */
export function partyWhen(startsAt: string | null): string {
    if (!startsAt || new Date(startsAt).getTime() <= Date.now()) {
        return tr('Зараз');
    }

    return `${dayLabel(startsAt)} · ${clockTime(startsAt)}`;
}

export function PartyCard({ party }: { party: PartyCardData }) {
    const full = party.count >= party.slots;
    const voting = Boolean(party.time_poll && !party.time_poll.decided);
    const now = !voting && partyWhen(party.starts_at) === tr('Зараз');

    return (
        <Link
            href={party.href}
            className="glass flex min-w-0 flex-col gap-3 rounded-2xl p-5 transition hover:border-white/15"
        >
            <div className="flex items-start gap-3">
                <UserAvatar user={party.host} size="md" />
                <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-display text-[16px] font-bold break-words text-white">
                        {party.title}
                    </h3>
                    <p className="flex items-center gap-1 truncate text-xs text-white/45">
                        {party.host.name}
                        {party.bumped && (
                            <span className="inline-flex items-center gap-1 text-indigo-200">
                                · <ArrowUp className="size-3" />
                                {tr('Піднято')}
                            </span>
                        )}
                    </p>
                </div>
                <span
                    className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-chip px-2.5 py-1 text-xs font-semibold tabular-nums',
                        full
                            ? 'bg-white/[0.06] text-white/50'
                            : 'bg-emerald-400/10 text-emerald-200',
                    )}
                >
                    <Users className="size-3.5" />
                    {party.count}/{party.slots}
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs font-medium">
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-chip px-2 py-0.5',
                        now
                            ? 'bg-gc-indigo/20 text-[#c4b5fd]'
                            : 'bg-white/[0.06] text-white/70',
                    )}
                >
                    {voting ? (
                        <Vote className="size-3" />
                    ) : (
                        <Clock3 className="size-3" />
                    )}
                    {voting
                        ? tr('Час — голосуванням')
                        : partyWhen(party.starts_at)}
                </span>
                {party.game && (
                    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/70">
                        <Gamepad2 className="size-3 shrink-0" />
                        <span className="truncate">{party.game.name}</span>
                    </span>
                )}
                {party.server && (
                    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/70">
                        <Server className="size-3 shrink-0" />
                        <span className="truncate">{party.server.name}</span>
                    </span>
                )}
                {party.platform && (
                    <span className="rounded-chip bg-white/[0.06] px-2 py-0.5 text-white/70">
                        {PARTY_PLATFORMS()[party.platform] ?? party.platform}
                    </span>
                )}
            </div>

            {party.note && (
                <p className="line-clamp-2 text-[13px] leading-relaxed text-white/55">
                    {party.note}
                </p>
            )}

            {party.roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {party.roles.map((role) => {
                        const taken = party.taken_roles.includes(role);

                        return (
                            <span
                                key={role}
                                className={cn(
                                    'rounded-lg px-2 py-1 text-xs',
                                    taken
                                        ? 'bg-white/[0.03] text-white/35 line-through'
                                        : 'bg-amber-300/10 text-amber-100',
                                )}
                            >
                                {role}
                            </span>
                        );
                    })}
                </div>
            )}
        </Link>
    );
}

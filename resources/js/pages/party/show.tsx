import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Clock3,
    Crown,
    Gamepad2,
    LogOut,
    Server,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import { PARTY_PLATFORMS, partyWhen } from '@/components/party/party-card';
import type { PartyCardData } from '@/components/party/party-card';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export default function PartyShow({ party }: { party: PartyCardData }) {
    const free = party.roles.filter(
        (role) => !party.taken_roles.includes(role),
    );
    const [role, setRole] = useState<string | null>(free[0] ?? null);
    const full = party.count >= party.slots;
    const canJoin = party.open && !party.joined && !full;

    return (
        <>
            <Head title={party.title} />
            <div className="mx-auto max-w-3xl space-y-5">
                <Link
                    href="/party"
                    className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Пошук паті')}
                </Link>

                <section className="glass space-y-4 rounded-3xl p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <UserAvatar user={party.host} size="lg" />
                        <div className="min-w-0 flex-1">
                            <h1 className="font-display text-xl font-bold break-words text-white sm:text-2xl">
                                {party.title}
                            </h1>
                            <Link
                                href={`/${party.host.username}`}
                                className="text-sm text-white/55 hover:text-white"
                            >
                                {party.host.name}
                            </Link>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-gc-indigo/15 px-3 py-1.5 text-[#c4b5fd]">
                            <Clock3 className="size-4" />
                            {partyWhen(party.starts_at)}
                        </span>
                        {party.game && (
                            <Link
                                href={`/games/${party.game.slug}`}
                                className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-white/80 hover:bg-white/10"
                            >
                                <Gamepad2 className="size-4 shrink-0" />
                                <span className="truncate">
                                    {party.game.name}
                                </span>
                            </Link>
                        )}
                        {party.server && (
                            <Link
                                href={`/servers/${party.server.slug}`}
                                className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-white/80 hover:bg-white/10"
                            >
                                <Server className="size-4 shrink-0" />
                                <span className="truncate">
                                    {party.server.name}
                                </span>
                            </Link>
                        )}
                        {party.platform && (
                            <span className="rounded-xl bg-white/[0.06] px-3 py-1.5 text-white/80">
                                {PARTY_PLATFORMS()[party.platform] ??
                                    party.platform}
                            </span>
                        )}
                    </div>

                    {party.note && (
                        <p className="text-sm leading-relaxed whitespace-pre-line text-white/75">
                            {party.note}
                        </p>
                    )}

                    {!party.open && (
                        <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/60">
                            {tr('Оголошення закрите.')}
                        </p>
                    )}

                    {canJoin && (
                        <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4">
                            {free.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {free.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            aria-pressed={role === item}
                                            onClick={() => setRole(item)}
                                            className={cn(
                                                'rounded-lg px-3 py-1.5 text-sm transition',
                                                role === item
                                                    ? 'bg-amber-300/20 text-amber-50'
                                                    : 'bg-white/[0.05] text-white/70 hover:text-white',
                                            )}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        `/party/${party.id}/join`,
                                        { role },
                                        { preserveScroll: true },
                                    )
                                }
                                className="btn-glow inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold sm:w-auto"
                            >
                                {role
                                    ? tr('Приєднатися як {role}', { role })
                                    : tr('Приєднатися')}
                            </button>
                        </div>
                    )}
                    {party.open && !party.joined && full && (
                        <p className="text-sm text-white/50">
                            {tr('Місць більше немає.')}
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {party.joined && !party.mine && (
                            <button
                                type="button"
                                onClick={() =>
                                    router.delete(`/party/${party.id}/join`, {
                                        preserveScroll: true,
                                    })
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] px-4 text-sm font-medium text-white/75 transition hover:bg-white/10"
                            >
                                <LogOut className="size-4" />
                                {tr('Вийти з паті')}
                            </button>
                        )}
                        {party.mine && party.open && (
                            <button
                                type="button"
                                onClick={() =>
                                    router.delete(`/party/${party.id}`)
                                }
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-400/10"
                            >
                                <XCircle className="size-4" />
                                {tr('Закрити оголошення')}
                            </button>
                        )}
                    </div>
                </section>

                <section className="glass rounded-3xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Склад')} · {party.count}/{party.slots}
                    </h2>
                    <ul className="mt-3 space-y-1">
                        <li className="flex min-w-0 items-center gap-3 rounded-2xl px-1.5 py-1.5">
                            <UserAvatar user={party.host} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                                {party.host.name}
                            </span>
                            <Crown
                                className="size-4 shrink-0 text-amber-300"
                                aria-label={tr('Автор')}
                            />
                        </li>
                        {party.members.map((member) => (
                            <li key={member.id}>
                                <Link
                                    href={`/${member.username}`}
                                    className="flex min-w-0 items-center gap-3 rounded-2xl px-1.5 py-1.5 transition hover:bg-white/[0.05]"
                                >
                                    <UserAvatar user={member} size="sm" />
                                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                                        {member.name}
                                    </span>
                                    {member.role && (
                                        <span className="shrink-0 rounded-lg bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
                                            {member.role}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                {party.joined && party.open && (
                    <VoiceRooms
                        owner={{ type: 'party', id: party.id }}
                        label={party.title}
                        href={party.href}
                    />
                )}
            </div>
        </>
    );
}

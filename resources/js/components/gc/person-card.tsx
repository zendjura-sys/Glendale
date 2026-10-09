import { Link } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { plural } from '@/lib/format';
import type { PersonCard as Person } from '@/types';
import { FriendButton } from './friend-button';
import { PlayingBadge } from './playing';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';

export function PersonCard({ person }: { person: Person }) {
    return (
        <div className="glass group relative flex flex-col items-center overflow-hidden rounded-3xl p-5 text-center transition hover:-translate-y-0.5 hover:border-white/15">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-gc-indigo/20 to-transparent opacity-0 transition group-hover:opacity-100" />
            <Link href={`/${person.username}`} className="relative">
                <UserAvatar user={person} size="xl" />
            </Link>
            <Link
                href={`/${person.username}`}
                className="relative mt-3 flex max-w-full items-center gap-1 truncate text-[15px] font-semibold text-white hover:underline"
            >
                <span className="truncate">{person.name}</span>
                {person.is_verified && <VerifiedBadge />}
            </Link>
            {person.playing && (
                <PlayingBadge
                    playing={person.playing}
                    className="relative mt-1.5"
                />
            )}
            <div className="relative mt-1 min-h-5 text-xs text-white/45">
                {person.mutual ? (
                    <span>
                        {person.mutual}{' '}
                        {plural(person.mutual, [
                            'спільний друг',
                            'спільні друзі',
                            'спільних друзів',
                        ])}
                    </span>
                ) : person.city ? (
                    <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {person.city}
                    </span>
                ) : (
                    <span>@{person.username}</span>
                )}
            </div>
            {person.relation && (
                <div className="relative mt-4 w-full">
                    <FriendButton
                        username={person.username}
                        relation={person.relation}
                        size="sm"
                        className="w-full"
                    />
                </div>
            )}
        </div>
    );
}

export function PersonRow({
    person,
    action,
}: {
    person: Person;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.035]">
            <Link href={`/${person.username}`}>
                <UserAvatar user={person} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
                <Link
                    href={`/${person.username}`}
                    className="flex items-center gap-1 truncate text-sm font-semibold text-white hover:underline"
                >
                    <span className="truncate">{person.name}</span>
                    {person.is_verified && (
                        <VerifiedBadge className="size-3.5" />
                    )}
                </Link>
                {person.playing ? (
                    <PlayingBadge
                        playing={person.playing}
                        className="mt-0.5 py-0.5"
                    />
                ) : (
                    <div className="truncate text-xs text-white/45">
                        {person.mutual
                            ? `${person.mutual} ${plural(person.mutual, ['спільний друг', 'спільні друзі', 'спільних друзів'])}`
                            : person.status ||
                              person.city ||
                              `@${person.username}`}
                    </div>
                )}
            </div>
            {action}
        </div>
    );
}

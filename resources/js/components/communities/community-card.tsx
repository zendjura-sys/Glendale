import { Link } from '@inertiajs/react';
import { Lock, Megaphone, UsersRound } from 'lucide-react';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { compactNumber, plural } from '@/lib/format';
import type { CommunityListItem } from '@/types';
import { JoinButton } from './join-button';
import { tr } from '@/lib/i18n';

export function membersLabel(count: number, isPublic: boolean): string {
    return `${compactNumber(count)} ${
        isPublic
            ? plural(count, ['підписник', 'підписники', 'підписників'])
            : plural(count, ['учасник', 'учасники', 'учасників'])
    }`;
}

export function CommunityTile({ community }: { community: CommunityListItem }) {
    const isPublic = community.type === 'public';

    return (
        <article className="glass group relative flex animate-rise flex-col overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_24px_60px_-30px_rgb(109_93_252/0.8)]">
            <Link
                href={`/c/${community.slug}`}
                className="relative block h-24 overflow-hidden"
            >
                {community.cover_url ? (
                    <img
                        src={community.cover_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="size-full bg-[radial-gradient(circle_at_15%_20%,#4f8bff_0%,transparent_55%),radial-gradient(circle_at_85%_40%,#a855f7_0%,transparent_55%)] opacity-70" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] to-transparent" />
            </Link>

            <div className="relative -mt-9 flex flex-1 flex-col px-4 pb-4">
                <Link href={`/c/${community.slug}`} className="w-fit">
                    <CommunityAvatar
                        community={community}
                        size="lg"
                        className="ring-4 ring-[#0b1020]"
                    />
                </Link>
                <Link
                    href={`/c/${community.slug}`}
                    className="mt-2.5 flex items-center gap-1.5 font-display text-[15px] font-semibold text-white hover:underline"
                >
                    <span className="truncate">{community.name}</span>
                    {community.is_verified && (
                        <VerifiedBadge className="size-4 shrink-0" />
                    )}
                </Link>
                <p className="mt-0.5 line-clamp-1 min-h-[18px] text-xs text-white/50">
                    {community.status ?? community.category_label}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1">
                        {isPublic ? (
                            <Megaphone className="size-3.5 text-gc-violet-300" />
                        ) : (
                            <UsersRound className="size-3.5 text-[#6fa2ff]" />
                        )}
                        {membersLabel(community.members_count, isPublic)}
                    </span>
                    {community.privacy === 'closed' && (
                        <span className="inline-flex items-center gap-1">
                            <Lock className="size-3.5" /> {tr('Закрита')}
                        </span>
                    )}
                </div>
                <div className="mt-auto pt-4">
                    <JoinButton
                        community={community}
                        status={community.membership}
                        role={community.managed ? 'admin' : null}
                        size="sm"
                        className="w-full"
                    />
                </div>
            </div>
        </article>
    );
}

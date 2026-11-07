import { Link } from '@inertiajs/react';
import {
    KeyRound,
    Lock,
    Megaphone,
    MessagesSquare,
    UsersRound,
    Volume2,
} from 'lucide-react';
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

/** Спільнота в каталозі — рядок списку: аватар, назва, опис і кількість учасників, кнопка праворуч. */
export function CommunityTile({ community }: { community: CommunityListItem }) {
    const isPublic = community.type === 'public';

    return (
        <article className="group flex animate-rise items-center gap-3.5 py-3.5 sm:gap-4">
            <Link href={`/c/${community.slug}`} className="shrink-0">
                <CommunityAvatar community={community} size="lg" />
            </Link>
            <div className="min-w-0 flex-1">
                <Link
                    href={`/c/${community.slug}`}
                    className="flex items-center gap-1.5 font-display text-[15px] font-semibold text-white hover:underline"
                >
                    <span className="break-words">{community.name}</span>
                    {community.is_verified && (
                        <VerifiedBadge className="size-4 shrink-0" />
                    )}
                </Link>
                <p className="mt-0.5 text-[13px] break-words text-white/60">
                    {community.status ?? community.category_label}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                    <span className="inline-flex items-center gap-1">
                        {isPublic ? (
                            <Megaphone className="size-3.5 text-gc-lilac-400" />
                        ) : (
                            <UsersRound className="size-3.5 text-gc-lilac-400" />
                        )}
                        {membersLabel(community.members_count, isPublic)}
                    </span>
                    {community.privacy === 'closed' && (
                        <span className="inline-flex items-center gap-1">
                            <Lock className="size-3.5" /> {tr('Закрита')}
                        </span>
                    )}
                    {community.has_password && (
                        <span className="inline-flex items-center gap-1">
                            <KeyRound className="size-3.5" /> {tr('З паролем')}
                        </span>
                    )}
                    {!!community.voice_now && (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                            <Volume2 className="size-3.5" />
                            {tr('{n} у голосових', {
                                n: community.voice_now,
                            })}
                        </span>
                    )}
                    {!!community.active_today && (
                        <span className="inline-flex items-center gap-1">
                            <MessagesSquare className="size-3.5" />
                            {compactNumber(community.active_today)}{' '}
                            {plural(community.active_today, [
                                'повідомлення',
                                'повідомлення',
                                'повідомлень',
                            ])}{' '}
                            {tr('за добу')}
                        </span>
                    )}
                </div>
            </div>
            <JoinButton
                community={community}
                status={community.membership}
                role={community.managed ? 'admin' : null}
                size="sm"
                className="shrink-0"
            />
        </article>
    );
}

import type { ReactNode } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { ago, useLive } from '@/lib/api';
import { useMe } from '@/lib/me';

type Post = { id: number; body: string | null; created_at: string; likes_count: number };

/** «Моя сторінка»: профіль і останні власні записи. */
export function ProfileModule({ header }: { header?: ReactNode }) {
    const { me } = useMe();
    const { data } = useLive<{ posts?: { data: Post[] } }>(me?.username ? `/api/v1/users/${me.username}` : null, 120_000, ['feed']);
    const posts = data?.posts?.data ?? [];
    return (
        <NotchedCard title="Моя сторінка" subtitle={me?.username ? `@${me.username}` : undefined} glow="cyan" header={header} badge={<NotchBadge tone="muted">{posts.length}</NotchBadge>} badgeWidth={44}>
            {me && (
                <div className="mb-3 flex items-center gap-3 px-1">
                    <Avatar user={me} size={52} dot="online" />
                    <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{me.name}</div>
                        <div className="text-xs text-white/45">У мережі</div>
                    </div>
                </div>
            )}
            {posts.length === 0 ? <Empty>{data ? 'Ще немає записів.' : 'Завантажуємо…'}</Empty> : null}
            <ul className="space-y-1.5">
                {posts.slice(0, 15).map((p) => (
                    <li key={p.id} className="rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/5">
                        <p data-selectable className="line-clamp-3 text-[13px] text-white/85">
                            {p.body ?? '—'}
                        </p>
                        <span className="text-[11px] text-white/40">
                            {ago(p.created_at)} · ♥ {p.likes_count}
                        </span>
                    </li>
                ))}
            </ul>
        </NotchedCard>
    );
}

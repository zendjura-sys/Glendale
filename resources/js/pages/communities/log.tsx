import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, History } from 'lucide-react';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { UserAvatar } from '@/components/gc/user-avatar';
import { EmptyState } from '@/components/gc/widget';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { CommunityCard, UserCard } from '@/types';

type Entry = {
    id: number;
    action: string;
    label: string;
    actor: UserCard | null;
    target: UserCard | null;
    note: string | null;
    at: string | null;
};

/** Журнал дій керівників спільноти: прозоро, хто що змінив. */
export default function CommunityLogPage({
    community,
    entries,
}: {
    community: CommunityCard;
    entries: Entry[];
}) {
    return (
        <>
            <Head title={tr('Журнал дій — {name}', { name: community.name })} />
            <div className="mx-auto max-w-3xl space-y-3.5">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/c/${community.slug}/settings`}
                        className="gc-solid-2 flex size-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Назад')}
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <CommunityAvatar community={community} size="md" />
                    <div>
                        <h1 className="font-display text-xl font-bold text-white">
                            {tr('Журнал дій')}
                        </h1>
                        <p className="text-sm text-white/50">
                            {tr(
                                'Хто з керівників кого прийняв, видалив, яку роль змінив і що в налаштуваннях.',
                            )}
                        </p>
                    </div>
                </div>
                {entries.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title={tr('Поки порожньо')}
                        text={tr(
                            'Тут з’являтимуться дії адміністраторів і редакторів.',
                        )}
                    />
                ) : (
                    <ol className="gc-solid divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
                        {entries.map((entry) => (
                            <li
                                key={entry.id}
                                className="flex items-start gap-3 px-4 py-3"
                            >
                                {entry.actor ? (
                                    <UserAvatar user={entry.actor} size="sm" />
                                ) : (
                                    <span className="size-8 shrink-0 rounded-full bg-white/[0.06]" />
                                )}
                                <div className="min-w-0 flex-1 text-sm">
                                    <p className="text-white/85">
                                        <span className="font-semibold text-white">
                                            {entry.actor?.name ?? tr('Система')}
                                        </span>{' '}
                                        {tr(entry.label).toLowerCase()}
                                        {entry.target && (
                                            <>
                                                {' · '}
                                                <Link
                                                    href={`/${entry.target.username}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {entry.target.name}
                                                </Link>
                                            </>
                                        )}
                                    </p>
                                    {entry.note && (
                                        <p className="mt-0.5 truncate text-xs text-white/45">
                                            {entry.note}
                                        </p>
                                    )}
                                </div>
                                {entry.at && (
                                    <time className="shrink-0 text-xs text-white/40">
                                        {timeAgo(entry.at)}
                                    </time>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </>
    );
}

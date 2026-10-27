import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import { ListSkeleton } from '@/components/gc/skeletons';
import {
    ArrowLeft,
    Check,
    Crown,
    MoreHorizontal,
    Search,
    ShieldCheck,
    Tag,
    UserMinus,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    RoleBadge,
    RoleTitleDialog,
} from '@/components/communities/role-badge';
import { roleLabels } from '@/components/communities/roles';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { EmptyState } from '@/components/gc/widget';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    CommunityCard,
    CommunityMemberItem,
    CommunityRole,
    MembershipStatus,
    ScrollData,
} from '@/types';
import { tr } from '@/lib/i18n';

type Tab = 'all' | 'managers' | 'friends' | 'requests';

type Props = {
    community: CommunityCard;
    tab: Tab;
    q: string;
    my: { role: CommunityRole; status: MembershipStatus } | null;
    isAdmin: boolean;
    counts: Record<Tab, number>;
    members: ScrollData<CommunityMemberItem>;
};

const roleStyle: Record<CommunityRole, string> = {
    owner: 'bg-gc-gold/10 text-gc-gold',
    admin: 'bg-gc-blue/10 text-[#8fb4ff]',
    editor: 'bg-gc-purple/10 text-[#cfa8ff]',
    member: '',
};

export default function CommunityMembers({
    community,
    tab,
    q,
    my,
    isAdmin,
    counts,
    members,
}: Props) {
    const [query, setQuery] = useState(q);
    const base = `/c/${community.slug}/members`;
    const isOwner = my?.role === 'owner';
    const options = { preserveScroll: true, preserveState: true } as const;

    useEffect(() => {
        if (query === q) return;
        const timer = setTimeout(
            () =>
                router.get(
                    base,
                    { tab, q: query || undefined },
                    { preserveState: true, replace: true },
                ),
            300,
        );

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const tabs: { value: Tab; label: string }[] = [
        {
            value: 'all',
            label:
                community.type === 'public' ? tr('Підписники') : tr('Учасники'),
        },
        { value: 'managers', label: tr('Керівники') },
        { value: 'friends', label: tr('Друзі') },
        ...(isAdmin ? [{ value: 'requests' as Tab, label: tr('Заявки') }] : []),
    ];

    const setRole = (member: CommunityMemberItem, role: CommunityRole) => {
        if (
            role === 'owner' &&
            !window.confirm(
                tr(
                    'Передати права власника {name}? Ви станете адміністратором.',
                    { name: member.name },
                ),
            )
        ) {
            return;
        }
        router.patch(`${base}/${member.username}`, { role }, options);
    };

    const remove = (member: CommunityMemberItem) => {
        if (
            window.confirm(
                tr('Виключити {name} зі спільноти?', { name: member.name }),
            )
        ) {
            router.delete(`${base}/${member.username}`, options);
        }
    };

    const [titling, setTitling] = useState<CommunityMemberItem | null>(null);
    const saveTitle = (title: string, color: string) => {
        if (!titling) return;
        router.patch(
            `${base}/${titling.username}/title`,
            { title, color },
            { ...options, onSuccess: () => setTitling(null) },
        );
    };

    const canManage = (member: CommunityMemberItem) =>
        isAdmin &&
        member.role !== 'owner' &&
        (isOwner || member.role !== 'admin');

    return (
        <>
            <Head title={tr('Учасники — {name}', { name: community.name })} />
            <div className="space-y-5">
                <section className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6">
                    <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-gc-indigo/20 blur-3xl" />
                    <div className="relative flex items-center gap-4">
                        <Link
                            href={`/c/${community.slug}`}
                            className="flex size-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
                            aria-label={tr('Назад')}
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <CommunityAvatar community={community} size="md" />
                        <div className="min-w-0">
                            <h1 className="flex items-center gap-1.5 truncate font-display text-xl font-bold text-white">
                                {community.name}
                                {community.is_verified && (
                                    <VerifiedBadge className="size-4" />
                                )}
                            </h1>
                            <p className="text-sm text-white/50">
                                {tr('Учасники спільноти')}
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-5 flex flex-col gap-3 md:flex-row">
                        <div className="flex shrink-0 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
                            {tabs.map((item) => (
                                <Link
                                    key={item.value}
                                    href={`${base}?tab=${item.value}`}
                                    preserveState
                                    className={cn(
                                        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition',
                                        tab === item.value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    {item.label}
                                    <span
                                        className={cn(
                                            'rounded-full px-1.5 text-[11px] leading-5',
                                            item.value === 'requests' &&
                                                counts.requests > 0
                                                ? 'bg-gradient-brand text-white'
                                                : 'bg-white/10 text-white/60',
                                        )}
                                    >
                                        {counts[item.value]}
                                    </span>
                                </Link>
                            ))}
                        </div>
                        <label className="input-glass flex h-11 min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3.5">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder={tr('Пошук учасників')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                            />
                        </label>
                    </div>
                </section>

                {members.data.length === 0 ? (
                    <EmptyState
                        icon={UsersRound}
                        title={
                            tab === 'requests'
                                ? tr('Нових заявок немає')
                                : tr('Нікого не знайдено')
                        }
                    />
                ) : (
                    <InfiniteScroll
                        data="members"
                        loading={<ListSkeleton rows={3} card={false} />}
                        preserveUrl
                        className="glass divide-y divide-white/[0.05] overflow-hidden rounded-2xl"
                    >
                        {members.data.map((member) => (
                            <div
                                key={member.id}
                                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] sm:px-5"
                            >
                                <Link href={`/${member.username}`}>
                                    <UserAvatar user={member} size="md" />
                                </Link>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/${member.username}`}
                                        className="flex items-center gap-1.5 text-[15px] font-semibold text-white hover:underline"
                                    >
                                        <span className="truncate">
                                            {member.name}
                                        </span>
                                        {member.is_verified && (
                                            <VerifiedBadge className="size-3.5 shrink-0" />
                                        )}
                                        {member.title && (
                                            <RoleBadge
                                                title={member.title}
                                                color={member.color}
                                                className="shrink-0"
                                            />
                                        )}
                                    </Link>
                                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-white/45">
                                        {member.is_friend && (
                                            <span className="text-emerald-300/80">
                                                {tr('Ваш друг')}
                                            </span>
                                        )}
                                        {member.joined_at && (
                                            <span>
                                                {tab === 'requests'
                                                    ? tr('Заявка ')
                                                    : tr('У спільноті з ')}
                                                {timeAgo(member.joined_at)}
                                            </span>
                                        )}
                                    </p>
                                    {member.answers &&
                                        member.answers.length > 0 && (
                                            <dl className="mt-2 space-y-1.5 rounded-xl bg-white/[0.04] p-2.5 text-xs">
                                                {member.answers.map(
                                                    (item, i) => (
                                                        <div key={i}>
                                                            <dt className="text-white/45">
                                                                {item.q}
                                                            </dt>
                                                            <dd className="whitespace-pre-line text-white/85">
                                                                {item.a}
                                                            </dd>
                                                        </div>
                                                    ),
                                                )}
                                            </dl>
                                        )}
                                </div>

                                {member.role !== 'member' && (
                                    <span
                                        className={cn(
                                            'hidden items-center gap-1 rounded-chip px-2.5 py-1 text-xs font-medium sm:inline-flex',
                                            roleStyle[member.role],
                                        )}
                                    >
                                        {member.role === 'owner' ? (
                                            <Crown className="size-3" />
                                        ) : (
                                            <ShieldCheck className="size-3" />
                                        )}
                                        {roleLabels[member.role]}
                                    </span>
                                )}

                                {tab === 'requests' ? (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    `${base}/${member.username}/approve`,
                                                    {},
                                                    options,
                                                )
                                            }
                                            className="btn-glow inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold"
                                        >
                                            <Check className="size-4" />
                                            {tr('Прийняти')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.delete(
                                                    `${base}/${member.username}/request`,
                                                    options,
                                                )
                                            }
                                            className="inline-flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 transition hover:bg-rose-500/15 hover:text-rose-200"
                                            aria-label={tr('Відхилити')}
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                ) : (
                                    isAdmin && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger className="rounded-full p-2 text-white/45 transition outline-none hover:bg-white/[0.06] hover:text-white">
                                                <MoreHorizontal className="size-5" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="glass-strong w-60 rounded-2xl border-white/10 p-1.5 text-white"
                                            >
                                                <DropdownMenuItem
                                                    className="rounded-lg focus:bg-white/[0.06]"
                                                    onSelect={() =>
                                                        setTitling(member)
                                                    }
                                                >
                                                    <Tag />
                                                    {tr('Підпис ролі')}
                                                </DropdownMenuItem>
                                                {canManage(member) && (
                                                    <>
                                                        <DropdownMenuSeparator className="bg-white/5" />
                                                        <DropdownMenuLabel className="text-xs text-white/45">
                                                            {tr('Роль')}
                                                        </DropdownMenuLabel>
                                                        {(
                                                            [
                                                                ...(isOwner
                                                                    ? ([
                                                                          'admin',
                                                                      ] as const)
                                                                    : []),
                                                                'editor',
                                                                'member',
                                                            ] as CommunityRole[]
                                                        ).map((role) => (
                                                            <DropdownMenuItem
                                                                key={role}
                                                                className="rounded-lg focus:bg-white/[0.06]"
                                                                onSelect={() =>
                                                                    setRole(
                                                                        member,
                                                                        role,
                                                                    )
                                                                }
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        member.role ===
                                                                            role
                                                                            ? 'opacity-100'
                                                                            : 'opacity-0',
                                                                    )}
                                                                />
                                                                {
                                                                    roleLabels[
                                                                        role
                                                                    ]
                                                                }
                                                            </DropdownMenuItem>
                                                        ))}
                                                        {isOwner && (
                                                            <DropdownMenuItem
                                                                className="rounded-lg text-gc-gold focus:bg-gc-gold/10 focus:text-[#ffe39b]"
                                                                onSelect={() =>
                                                                    setRole(
                                                                        member,
                                                                        'owner',
                                                                    )
                                                                }
                                                            >
                                                                <Crown className="text-gc-gold" />
                                                                {tr(
                                                                    'Передати права власника',
                                                                )}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator className="bg-white/5" />
                                                        <DropdownMenuItem
                                                            className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                                            onSelect={() =>
                                                                remove(member)
                                                            }
                                                        >
                                                            <UserMinus className="text-rose-300" />
                                                            {tr('Виключити')}
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )
                                )}
                            </div>
                        ))}
                    </InfiniteScroll>
                )}
            </div>
            {titling && (
                <RoleTitleDialog
                    open
                    name={titling.name}
                    initial={{
                        title: titling.title ?? '',
                        color: titling.color ?? null,
                    }}
                    onClose={() => setTitling(null)}
                    onSave={saveTitle}
                />
            )}
        </>
    );
}

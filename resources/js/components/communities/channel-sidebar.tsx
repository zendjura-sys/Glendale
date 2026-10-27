import { Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronDown,
    FolderPlus,
    Lock,
    Pencil,
    Plus,
    Settings2,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import type { DragEvent } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { CHANNEL_ICONS } from './channel-dialog';
import type { ChannelCard, ChannelCategory } from './channel-dialog';

export type ChannelTree = {
    categories: ChannelCategory[];
    uncategorized: ChannelCard[];
};

type Group = { category_id: number | null; channels: ChannelCard[] };

/**
 * Бічна панель спільноти: обкладинка, категорії (згортаються) й канали з непрочитаним.
 * Адміністратори створюють канали й категорії та перетягують канали між категоріями.
 */
export function ChannelSidebar({
    community,
    tree,
    activeId,
    canManage,
    onCreate,
    onEdit,
    className,
}: {
    community: {
        slug: string;
        name: string;
        avatar_url: string | null;
        cover_url?: string | null;
        members_count: number;
    };
    tree: ChannelTree;
    activeId: number | null;
    canManage: boolean;
    onCreate: (categoryId: number | null) => void;
    onEdit: (channel: ChannelCard) => void;
    className?: string;
}) {
    const [collapsed, setCollapsed] = useState<number[]>([]);
    const [dragging, setDragging] = useState<number | null>(null);
    const [over, setOver] = useState<string | null>(null);

    const groups: Group[] = [
        ...(tree.uncategorized.length > 0 || canManage
            ? [{ category_id: null, channels: tree.uncategorized }]
            : []),
        ...tree.categories.map((c) => ({
            category_id: c.id,
            channels: c.channels,
        })),
    ];

    // Перенести канал перед іншим (або в кінець категорії) і зберегти порядок.
    const drop = (categoryId: number | null, beforeId: number | null) => {
        if (dragging === null) return;
        const moved = groups
            .flatMap((g) => g.channels)
            .find((c) => c.id === dragging);
        if (!moved) return;
        const next = groups.map((g) => ({
            category_id: g.category_id,
            channels: g.channels
                .filter((c) => c.id !== dragging)
                .map((c) => c.id),
        }));
        const target = next.find((g) => g.category_id === categoryId);
        if (!target) return;
        const index =
            beforeId === null ? -1 : target.channels.indexOf(beforeId);
        target.channels.splice(
            index < 0 ? target.channels.length : index,
            0,
            moved.id,
        );
        setDragging(null);
        setOver(null);
        router.put(
            `/c/${community.slug}/channels/order`,
            {
                categories: tree.categories.map((c) => c.id),
                groups: next,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const dropProps = (
        key: string,
        categoryId: number | null,
        beforeId: number | null,
    ) =>
        canManage
            ? {
                  onDragOver: (e: DragEvent) => {
                      e.preventDefault();
                      setOver(key);
                  },
                  onDragLeave: () => setOver((v) => (v === key ? null : v)),
                  onDrop: (e: DragEvent) => {
                      e.preventDefault();
                      drop(categoryId, beforeId);
                  },
              }
            : {};

    const renameCategory = (category: ChannelCategory) => {
        const name = prompt(tr('Нова назва категорії'), category.name)?.trim();
        if (name && name !== category.name) {
            router.patch(
                `/c/${community.slug}/channel-categories/${category.id}`,
                { name },
                { preserveScroll: true },
            );
        }
    };
    const removeCategory = (category: ChannelCategory) => {
        if (
            confirm(
                tr(
                    'Видалити категорію «{name}»? Канали лишаться без категорії.',
                    { name: category.name },
                ),
            )
        ) {
            router.delete(
                `/c/${community.slug}/channel-categories/${category.id}`,
                { preserveScroll: true },
            );
        }
    };
    const addCategory = () => {
        const name = prompt(tr('Назва нової категорії'))?.trim();
        if (name) {
            router.post(
                `/c/${community.slug}/channel-categories`,
                { name },
                { preserveScroll: true },
            );
        }
    };

    const row = (channel: ChannelCard, categoryId: number | null) => {
        const Icon = CHANNEL_ICONS[channel.type];
        const active = channel.id === activeId;
        const key = `ch-${channel.id}`;

        return (
            <li
                key={channel.id}
                draggable={canManage}
                onDragStart={() => setDragging(channel.id)}
                onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                }}
                {...dropProps(key, categoryId, channel.id)}
                className={cn(
                    'group/channel relative',
                    over === key &&
                        dragging !== channel.id &&
                        'before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded-full before:bg-primary',
                    dragging === channel.id && 'opacity-40',
                )}
            >
                <Link
                    href={`/c/${community.slug}/channels/${channel.id}`}
                    preserveScroll
                    className={cn(
                        'flex min-h-9 items-center gap-2 rounded-lg px-2 text-[14px] transition',
                        active
                            ? 'nav-active font-semibold text-white'
                            : channel.unread > 0
                              ? 'font-semibold text-white hover:bg-white/[0.05]'
                              : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                    )}
                >
                    <Icon
                        className={cn(
                            'size-4 shrink-0',
                            active ? 'text-gc-lilac-300' : 'text-white/40',
                        )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                        {channel.name}
                    </span>
                    {channel.is_private && (
                        <Lock className="size-3 shrink-0 text-white/35" />
                    )}
                    {channel.unread > 0 && !active && (
                        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-semibold text-white tabular-nums">
                            {channel.unread > 99 ? '99+' : channel.unread}
                        </span>
                    )}
                    {canManage && (
                        <button
                            type="button"
                            aria-label={tr('Налаштування каналу')}
                            onClick={(e) => {
                                e.preventDefault();
                                onEdit(channel);
                            }}
                            className="hidden size-6 shrink-0 items-center justify-center rounded-md text-white/45 group-hover/channel:flex hover:text-white"
                        >
                            <Settings2 className="size-3.5" />
                        </button>
                    )}
                </Link>
                {channel.type === 'voice' && channel.voice.length > 0 && (
                    <ul className="mt-0.5 mb-1 space-y-0.5 pl-8">
                        {channel.voice.map((user) => (
                            <li
                                key={user.id}
                                className="flex items-center gap-2 text-xs text-white/65"
                            >
                                <UserAvatar user={user} size="xs" />
                                <span className="truncate">{user.name}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </li>
        );
    };

    return (
        <aside
            className={cn(
                'glass flex min-h-0 flex-col overflow-hidden rounded-2xl',
                className,
            )}
        >
            <Link
                href={`/c/${community.slug}`}
                className="relative block h-28 shrink-0 overflow-hidden"
            >
                {community.cover_url ? (
                    <img
                        src={community.cover_url}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <span className="absolute inset-0 bg-gradient-to-br from-gc-indigo/50 to-gc-cyan/30" />
                )}
                {/* Підпис усередині затемнення: на ньому білий лишається білим і у світлій темі. */}
                <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-white">
                        <ArrowLeft className="size-4 shrink-0 opacity-80" />
                        <span className="min-w-0">
                            <span className="block truncate font-display text-[15px] font-semibold">
                                {community.name}
                            </span>
                            <span className="block text-[11px] text-white/70 tabular-nums">
                                {tr('{n} учасників', {
                                    n: community.members_count,
                                })}
                            </span>
                        </span>
                    </span>
                </span>
            </Link>

            <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-3">
                {groups.map((group) => {
                    const category = tree.categories.find(
                        (c) => c.id === group.category_id,
                    );
                    const folded =
                        category !== undefined &&
                        collapsed.includes(category.id);
                    const headKey = `cat-${group.category_id ?? 0}`;

                    return (
                        <section key={headKey}>
                            {category ? (
                                <div
                                    {...dropProps(headKey, category.id, null)}
                                    className={cn(
                                        'group/cat flex items-center gap-1 rounded-md px-1',
                                        over === headKey && 'bg-primary/15',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCollapsed((v) =>
                                                v.includes(category.id)
                                                    ? v.filter(
                                                          (id) =>
                                                              id !==
                                                              category.id,
                                                      )
                                                    : [...v, category.id],
                                            )
                                        }
                                        className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left text-xs font-semibold text-white/50 hover:text-white/80"
                                    >
                                        <ChevronDown
                                            className={cn(
                                                'size-3.5 shrink-0 transition',
                                                folded && '-rotate-90',
                                            )}
                                        />
                                        <span className="truncate">
                                            {category.name}
                                        </span>
                                    </button>
                                    {canManage && (
                                        <span className="hidden items-center group-hover/cat:flex">
                                            <button
                                                type="button"
                                                aria-label={tr(
                                                    'Перейменувати категорію',
                                                )}
                                                onClick={() =>
                                                    renameCategory(category)
                                                }
                                                className="flex size-6 items-center justify-center rounded-md text-white/45 hover:text-white"
                                            >
                                                <Pencil className="size-3" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={tr(
                                                    'Видалити категорію',
                                                )}
                                                onClick={() =>
                                                    removeCategory(category)
                                                }
                                                className="flex size-6 items-center justify-center rounded-md text-white/45 hover:text-rose-300"
                                            >
                                                <Trash2 className="size-3" />
                                            </button>
                                        </span>
                                    )}
                                    {canManage && (
                                        <button
                                            type="button"
                                            aria-label={tr('Новий канал')}
                                            onClick={() =>
                                                onCreate(category.id)
                                            }
                                            className="flex size-6 items-center justify-center rounded-md text-white/45 hover:text-white"
                                        >
                                            <Plus className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                canManage &&
                                dragging !== null &&
                                group.channels.length === 0 && (
                                    <div
                                        {...dropProps(headKey, null, null)}
                                        className={cn(
                                            'rounded-md px-2 py-1 text-[11px] text-white/30',
                                            over === headKey && 'bg-primary/15',
                                        )}
                                    >
                                        {tr('Без категорії')}
                                    </div>
                                )
                            )}
                            {!folded && (
                                <ul
                                    className="mt-0.5 space-y-0.5"
                                    {...(group.channels.length === 0
                                        ? dropProps(
                                              `${headKey}-empty`,
                                              group.category_id,
                                              null,
                                          )
                                        : {})}
                                >
                                    {group.channels.map((c) =>
                                        row(c, group.category_id),
                                    )}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </nav>

            {canManage && (
                <div className="flex gap-1.5 border-t border-white/[0.06] p-2">
                    <button
                        type="button"
                        onClick={() => onCreate(null)}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                        <Plus className="size-3.5" />
                        {tr('Канал')}
                    </button>
                    <button
                        type="button"
                        onClick={addCategory}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                        <FolderPlus className="size-3.5" />
                        {tr('Категорія')}
                    </button>
                </div>
            )}
        </aside>
    );
}

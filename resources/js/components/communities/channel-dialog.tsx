import { router } from '@inertiajs/react';
import {
    Hash,
    Lock,
    Megaphone,
    Search,
    Trash2,
    Volume2,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toggle } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type ChannelType = 'text' | 'announcement' | 'voice';

export type ChannelCard = {
    id: number;
    name: string;
    type: ChannelType;
    topic: string | null;
    is_private: boolean;
    category_id: number | null;
    conversation_id: number | null;
    voice_room_id: number | null;
    unread: number;
    voice: UserCard[];
    members?: UserCard[];
};

export type ChannelCategory = {
    id: number;
    name: string;
    channels: ChannelCard[];
};

export const CHANNEL_ICONS: Record<ChannelType, LucideIcon> = {
    text: Hash,
    announcement: Megaphone,
    voice: Volume2,
};

const TYPES: { key: ChannelType; title: string; text: string }[] = [
    {
        key: 'text',
        title: tr('Текст'),
        text: tr('Повідомлення, фото, відео, GIF, стікери й голосові'),
    },
    {
        key: 'announcement',
        title: tr('Оголошення'),
        text: tr('Важливі новини: пишуть лише адміністратори'),
    },
    {
        key: 'voice',
        title: tr('Голос'),
        text: tr('Розмова з учасниками через мікрофон'),
    },
];

const field =
    'input-glass h-11 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/35 focus:outline-none';

/**
 * Новий канал або налаштування наявного: категорія, тип, назва, тема, приватність
 * і хто бачить приватний канал. Видалення — лише в режимі налаштувань.
 */
export function ChannelDialog({
    open,
    onOpenChange,
    slug,
    categories,
    channel = null,
    defaultCategory = null,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    slug: string;
    categories: { id: number; name: string }[];
    channel?: ChannelCard | null;
    defaultCategory?: number | null;
}) {
    const editing = channel !== null;
    const [type, setType] = useState<ChannelType>(channel?.type ?? 'text');
    const [name, setName] = useState(channel?.name ?? '');
    const [topic, setTopic] = useState(channel?.topic ?? '');
    const [category, setCategory] = useState<number | null>(
        channel?.category_id ?? defaultCategory,
    );
    const [isPrivate, setPrivate] = useState(channel?.is_private ?? false);
    const [members, setMembers] = useState<UserCard[]>(channel?.members ?? []);
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<UserCard[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setType(channel?.type ?? 'text');
        setName(channel?.name ?? '');
        setTopic(channel?.topic ?? '');
        setCategory(channel?.category_id ?? defaultCategory);
        setPrivate(channel?.is_private ?? false);
        setMembers(channel?.members ?? []);
        setError(null);
    }, [open, channel, defaultCategory]);

    useEffect(() => {
        if (!open || !isPrivate) return;
        const timer = setTimeout(() => {
            void api<{ members: UserCard[] }>(
                'GET',
                `/c/${slug}/channels/members?q=${encodeURIComponent(query.trim())}`,
            )
                .then((response) => setFound(response.members))
                .catch(() => setFound([]));
        }, 250);

        return () => clearTimeout(timer);
    }, [open, isPrivate, query, slug]);

    const submit = () => {
        if (!name.trim()) {
            setError(tr('Вкажіть назву каналу.'));

            return;
        }
        setBusy(true);
        const payload = {
            name: name.trim(),
            topic: topic.trim() || null,
            category_id: category,
            is_private: isPrivate,
            members: members.map((member) => member.id),
        };
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
            onError: (errors: Record<string, string>) =>
                setError(Object.values(errors)[0] ?? null),
            onFinish: () => setBusy(false),
        };
        if (editing) {
            router.patch(`/c/${slug}/channels/${channel.id}`, payload, options);
        } else {
            router.post(`/c/${slug}/channels`, { ...payload, type }, options);
        }
    };

    const remove = () => {
        if (
            editing &&
            confirm(
                tr('Видалити канал «{name}» разом із повідомленнями?', {
                    name: channel.name,
                }),
            )
        ) {
            router.delete(`/c/${slug}/channels/${channel.id}`, {
                onSuccess: () => onOpenChange(false),
            });
        }
    };

    const toggleMember = (user: UserCard) =>
        setMembers((current) =>
            current.some((m) => m.id === user.id)
                ? current.filter((m) => m.id !== user.id)
                : [...current, user],
        );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 sm:max-w-xl">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {editing
                            ? tr('Налаштування каналу')
                            : tr('Новий канал')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {editing
                            ? tr('Назва, тема, категорія й доступ.')
                            : tr(
                                  'Канали тримають розмови спільноти окремо за темами.',
                              )}
                    </DialogDescription>
                </div>

                <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-white/80">
                        {tr('Категорія')}
                    </span>
                    <select
                        value={category ?? ''}
                        onChange={(e) =>
                            setCategory(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        className={field}
                    >
                        <option value="">{tr('Без категорії')}</option>
                        {categories.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </label>

                {!editing && (
                    <div className="space-y-1.5">
                        <span className="text-sm font-medium text-white/80">
                            {tr('Тип каналу')}
                        </span>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {TYPES.map((item) => {
                                const Icon = CHANNEL_ICONS[item.key];
                                const on = type === item.key;

                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setType(item.key)}
                                        className={cn(
                                            'rounded-xl p-3 text-left transition',
                                            on
                                                ? 'bg-primary/90 text-white'
                                                : 'bg-white/[0.05] text-white/75 hover:bg-white/[0.08]',
                                        )}
                                    >
                                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                                            <Icon className="size-4" />
                                            {item.title}
                                        </span>
                                        <span
                                            className={cn(
                                                'mt-1 block text-xs leading-snug',
                                                on
                                                    ? 'text-white/85'
                                                    : 'text-white/50',
                                            )}
                                        >
                                            {item.text}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-white/80">
                        {tr('Назва')}
                    </span>
                    <div className="relative">
                        {(() => {
                            const Icon = CHANNEL_ICONS[channel?.type ?? type];

                            return (
                                <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
                            );
                        })()}
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={40}
                            placeholder={tr('назва-каналу')}
                            className={cn(field, 'pl-9')}
                        />
                    </div>
                </label>

                {(channel?.type ?? type) !== 'voice' && (
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-white/80">
                            {tr('Тема')}{' '}
                            <span className="text-white/40">
                                {tr('(необов’язково)')}
                            </span>
                        </span>
                        <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            maxLength={200}
                            placeholder={tr('Про що цей канал')}
                            className={field}
                        />
                    </label>
                )}

                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Lock className="size-4 text-white/60" />
                        <span className="flex-1 text-sm font-medium text-white/85">
                            {tr('Приватний канал')}
                        </span>
                        <Toggle
                            checked={isPrivate}
                            onChange={setPrivate}
                            label={tr('Приватний канал')}
                        />
                    </div>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Бачать лише вибрані учасники й адміністратори спільноти.',
                        )}
                    </p>
                    {isPrivate && (
                        <div className="space-y-2 rounded-xl bg-white/[0.03] p-3">
                            {members.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {members.map((member) => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => toggleMember(member)}
                                            className="inline-flex items-center gap-1.5 rounded-chip bg-primary/20 py-0.5 pr-2 pl-0.5 text-xs text-white"
                                        >
                                            <UserAvatar
                                                user={member}
                                                size="xs"
                                            />
                                            {member.first_name}
                                            <X className="size-3" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={tr('Знайти учасника')}
                                    className={cn(field, 'h-10 pl-9')}
                                />
                            </div>
                            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                                {found.map((user) => {
                                    const picked = members.some(
                                        (m) => m.id === user.id,
                                    );

                                    return (
                                        <li key={user.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleMember(user)
                                                }
                                                className={cn(
                                                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition',
                                                    picked
                                                        ? 'bg-primary/15 text-white'
                                                        : 'text-white/75 hover:bg-white/[0.05]',
                                                )}
                                            >
                                                <UserAvatar
                                                    user={user}
                                                    size="xs"
                                                />
                                                <span className="flex-1 truncate">
                                                    {user.name}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                {error && <p className="text-sm text-rose-300">{error}</p>}

                <div className="flex items-center gap-2">
                    {editing && (
                        <button
                            type="button"
                            onClick={remove}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-rose-300 transition hover:bg-rose-400/10"
                        >
                            <Trash2 className="size-4" />
                            {tr('Видалити')}
                        </button>
                    )}
                    <span className="flex-1" />
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="h-10 rounded-xl px-4 text-sm font-medium text-white/70 hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={submit}
                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                    >
                        {editing ? tr('Зберегти') : tr('Створити канал')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

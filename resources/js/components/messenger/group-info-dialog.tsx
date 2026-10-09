import { Link, router, usePage } from '@inertiajs/react';
import {
    Camera,
    Crown,
    LogOut,
    Pencil,
    ShieldCheck,
    UserMinus,
    UserPlus,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { plural } from '@/lib/format';
import type { ConversationDetails, UserCard } from '@/types';
import { ContactPicker } from './contact-picker';
import { ConversationAvatar } from './conversation-avatar';
import { tr } from '@/lib/i18n';

const reload = { preserveScroll: true, preserveState: true } as const;

export function GroupInfoDialog({
    open,
    onOpenChange,
    conversation,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    conversation: ConversationDetails;
}) {
    const { auth } = usePage().props;
    const [adding, setAdding] = useState(false);
    const [picked, setPicked] = useState<UserCard[]>([]);
    const [renaming, setRenaming] = useState(false);
    const [title, setTitle] = useState(conversation.title);
    const fileRef = useRef<HTMLInputElement>(null);
    const canManage =
        conversation.my_role === 'owner' || conversation.my_role === 'admin';
    const base = `/messages/${conversation.id}`;

    const close = (value: boolean) => {
        onOpenChange(value);
        if (!value) {
            setAdding(false);
            setPicked([]);
            setRenaming(false);
        }
    };

    const saveTitle = () => {
        const next = title.trim();
        if (!next || next === conversation.title) {
            setRenaming(false);

            return;
        }
        router.post(
            `${base}/settings`,
            { title: next },
            { ...reload, onSuccess: () => setRenaming(false) },
        );
    };

    const uploadAvatar = (file: File | undefined) => {
        if (!file) return;
        router.post(
            `${base}/settings`,
            { avatar: file },
            { ...reload, forceFormData: true },
        );
    };

    const addMembers = () => {
        router.post(
            `${base}/members`,
            { user_ids: picked.map((u) => u.id) },
            {
                ...reload,
                onSuccess: () => {
                    setAdding(false);
                    setPicked([]);
                },
            },
        );
    };

    const remove = (user: { id: number; first_name: string }) => {
        const leaving = user.id === auth.user.id;
        const question = leaving
            ? tr('Вийти з бесіди? Ви більше не отримуватимете повідомлення.')
            : tr('Виключити {first_name} з бесіди?', {
                  first_name: user.first_name,
              });

        if (!window.confirm(question)) return;

        router.delete(`${base}/members/${user.id}`, {
            ...reload,
            onSuccess: () => leaving && close(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="glass-strong gap-0 overflow-hidden rounded-3xl border-white/10 p-0 text-white sm:max-w-md">
                <div className="relative flex flex-col items-center bg-gradient-to-b from-gc-indigo/25 to-transparent px-5 pt-7 pb-5 text-center">
                    <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => fileRef.current?.click()}
                        className="group relative rounded-full"
                        aria-label={tr('Змінити фото')}
                    >
                        <ConversationAvatar
                            conversation={conversation}
                            size="lg"
                            className="shadow-[0_0_50px_-8px_rgb(124_92_255/0.9)]"
                        />
                        {canManage && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
                                <Camera className="size-6 text-white" />
                            </span>
                        )}
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                            uploadAvatar(event.target.files?.[0]);
                            event.target.value = '';
                        }}
                    />

                    {renaming ? (
                        <div className="mt-4 flex w-full gap-2">
                            <input
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                onKeyDown={(event) =>
                                    event.key === 'Enter' && saveTitle()
                                }
                                maxLength={80}
                                autoFocus
                                className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={saveTitle}
                                className="btn-glow rounded-xl px-4 text-sm font-semibold"
                            >
                                {tr('Зберегти')}
                            </button>
                        </div>
                    ) : (
                        <DialogTitle className="mt-4 flex items-center gap-2 font-display text-xl">
                            {conversation.title}
                            {canManage && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTitle(conversation.title);
                                        setRenaming(true);
                                    }}
                                    className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
                                    aria-label={tr('Перейменувати')}
                                >
                                    <Pencil className="size-4" />
                                </button>
                            )}
                        </DialogTitle>
                    )}
                    <DialogDescription className="mt-1 text-sm text-white/45">
                        {conversation.members_count}{' '}
                        {plural(conversation.members_count, [
                            'учасник',
                            'учасники',
                            'учасників',
                        ])}
                    </DialogDescription>
                </div>

                <div className="px-4 pb-4">
                    {adding ? (
                        <>
                            <ContactPicker
                                open={adding}
                                multiple
                                selected={picked.map((u) => u.id)}
                                exclude={conversation.members.map((m) => m.id)}
                                onPick={(user) =>
                                    setPicked((current) =>
                                        current.some((u) => u.id === user.id)
                                            ? current.filter(
                                                  (u) => u.id !== user.id,
                                              )
                                            : [...current, user],
                                    )
                                }
                            />
                            <div className="mt-3 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAdding(false)}
                                    className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                                >
                                    {tr('Скасувати')}
                                </button>
                                <button
                                    type="button"
                                    disabled={picked.length === 0}
                                    onClick={addMembers}
                                    className="btn-glow rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                >
                                    {tr('Додати')}
                                    {picked.length > 0 && ` (${picked.length})`}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {canManage && (
                                <label className="mb-1 flex items-center justify-between gap-3 rounded-xl p-2 text-sm text-white/70">
                                    <span>{tr('Повільний режим')}</span>
                                    <select
                                        value={conversation.slow_seconds ?? 0}
                                        onChange={(event) =>
                                            router.post(
                                                `${base}/slow`,
                                                {
                                                    seconds: Number(
                                                        event.target.value,
                                                    ),
                                                },
                                                reload,
                                            )
                                        }
                                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                                    >
                                        <option value={0}>{tr('Вимкнено')}</option>
                                        <option value={10}>{tr('10 секунд')}</option>
                                        <option value={30}>{tr('30 секунд')}</option>
                                        <option value={60}>{tr('60 секунд')}</option>
                                    </select>
                                </label>
                            )}
                            <button
                                type="button"
                                onClick={() => setAdding(true)}
                                className="mb-1 flex w-full items-center gap-3 rounded-xl p-2 text-sm font-medium text-[#9fb0ff] transition hover:bg-white/[0.05]"
                            >
                                <span className="flex size-10 items-center justify-center rounded-full bg-gc-indigo/15">
                                    <UserPlus className="size-[18px]" />
                                </span>
                                {tr('Додати учасників')}
                            </button>
                            <div className="max-h-[42vh] overflow-y-auto">
                                {conversation.members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]"
                                    >
                                        <Link
                                            href={`/${member.username}`}
                                            className="flex min-w-0 flex-1 items-center gap-3"
                                        >
                                            <UserAvatar
                                                user={member}
                                                size="sm"
                                                className="size-10"
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium text-white">
                                                    {member.name}
                                                    {member.id ===
                                                        auth.user.id && (
                                                        <span className="text-white/40">
                                                            {' '}
                                                            {tr('(ви)')}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-white/40">
                                                    {member.is_online
                                                        ? tr('в мережі')
                                                        : `@${member.username}`}
                                                </span>
                                            </span>
                                        </Link>
                                        {member.role === 'owner' ? (
                                            <span className="flex items-center gap-1 rounded-full bg-gc-gold/10 px-2 py-0.5 text-xs font-medium text-gc-gold">
                                                <Crown className="size-3" />
                                                {tr('Творець')}
                                            </span>
                                        ) : member.role === 'admin' ? (
                                            <span className="flex items-center gap-1 rounded-full bg-gc-blue/10 px-2 py-0.5 text-xs font-medium text-[#8fb4ff]">
                                                <ShieldCheck className="size-3" />
                                                {tr('Адмін')}
                                            </span>
                                        ) : null}
                                        {conversation.my_role === 'owner' &&
                                            member.role !== 'owner' &&
                                            member.id !== auth.user.id && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.post(
                                                            `/messages/${conversation.id}/members/${member.username}/role`,
                                                            {
                                                                role:
                                                                    member.role === 'admin'
                                                                        ? 'member'
                                                                        : 'admin',
                                                            },
                                                            reload,
                                                        )
                                                    }
                                                    className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
                                                >
                                                    {member.role === 'admin'
                                                        ? tr('Зняти адміна')
                                                        : tr('Зробити адміном')}
                                                </button>
                                            )}
                                        {canManage &&
                                            member.role !== 'owner' &&
                                            member.id !== auth.user.id && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        remove(member)
                                                    }
                                                    className="rounded-lg p-1.5 text-white/40 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300 [@media(hover:none)]:opacity-100"
                                                    aria-label={tr('Виключити')}
                                                    title={tr('Виключити')}
                                                >
                                                    <UserMinus className="size-4" />
                                                </button>
                                            )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => remove(auth.user)}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/20 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
                            >
                                <LogOut className="size-4" />
                                {tr('Вийти з бесіди')}
                            </button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

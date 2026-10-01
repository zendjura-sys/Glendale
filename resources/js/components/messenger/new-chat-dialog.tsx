import { router } from '@inertiajs/react';
import { MessageCircle, UsersRound, X } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import { ContactPicker } from './contact-picker';

type Mode = 'direct' | 'group';

export function NewChatDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [mode, setMode] = useState<Mode>('direct');
    const [title, setTitle] = useState('');
    const [members, setMembers] = useState<UserCard[]>([]);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = (value: boolean) => {
        onOpenChange(value);
        if (!value) {
            setMode('direct');
            setTitle('');
            setMembers([]);
            setError(null);
        }
    };

    const pick = (user: UserCard) => {
        if (mode === 'direct') {
            close(false);
            router.visit(`/messages/with/${user.username}`);

            return;
        }

        setMembers((current) =>
            current.some((m) => m.id === user.id)
                ? current.filter((m) => m.id !== user.id)
                : [...current, user],
        );
    };

    const createGroup = () => {
        router.post(
            '/messages/groups',
            { title: title.trim(), user_ids: members.map((m) => m.id) },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => close(false),
                onError: (errors) =>
                    setError(Object.values(errors)[0] ?? 'Помилка'),
            },
        );
    };

    const tabs: { value: Mode; label: string; icon: typeof UsersRound }[] = [
        { value: 'direct', label: 'Повідомлення', icon: MessageCircle },
        { value: 'group', label: 'Нова бесіда', icon: UsersRound },
    ];

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-5 text-white sm:max-w-md">
                <DialogTitle className="font-display text-lg">
                    {mode === 'direct' ? 'Нове повідомлення' : 'Нова бесіда'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/45">
                    {mode === 'direct'
                        ? 'Оберіть друга, якому хочете написати.'
                        : 'Створіть груповий чат із друзями — до 200 учасників.'}
                </DialogDescription>

                <div className="mt-4 mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setMode(tab.value)}
                            className={cn(
                                'flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition',
                                mode === tab.value
                                    ? 'bg-gradient-brand text-white shadow-[0_0_20px_-4px_rgb(124_92_255/0.8)]'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            <tab.icon className="size-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {mode === 'group' && (
                    <div className="mb-3 space-y-3">
                        <input
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={80}
                            placeholder="Назва бесіди"
                            className="input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
                        />
                        {members.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {members.map((member) => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => pick(member)}
                                        className="flex animate-in items-center gap-1.5 rounded-full bg-[#6d5dfc]/20 py-0.5 pr-2 pl-0.5 text-xs text-white zoom-in-90 hover:bg-[#6d5dfc]/30"
                                    >
                                        <UserAvatar
                                            user={member}
                                            size="xs"
                                            showOnline={false}
                                            className="size-6"
                                        />
                                        {member.first_name}
                                        <X className="size-3 text-white/60" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <ContactPicker
                    open={open}
                    multiple={mode === 'group'}
                    selected={members.map((m) => m.id)}
                    onPick={pick}
                />

                {mode === 'group' && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-rose-300">{error}</span>
                        <button
                            type="button"
                            onClick={createGroup}
                            disabled={
                                processing ||
                                !title.trim() ||
                                members.length === 0
                            }
                            className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                        >
                            Створити бесіду
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

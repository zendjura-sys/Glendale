import { router } from '@inertiajs/react';
import { Check, Clock, UserCheck, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Relation } from '@/types';

type Props = {
    username: string;
    relation: Relation;
    size?: 'sm' | 'md';
    className?: string;
};

export function FriendButton({
    username,
    relation,
    size = 'md',
    className,
}: Props) {
    const [busy, setBusy] = useState(false);
    const base = cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50',
        size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs',
        className,
    );
    const options = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    if (relation === 'self') {
        return null;
    }

    if (relation === 'friends') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn(
                        base,
                        'bg-white/[0.07] text-white outline-none hover:bg-white/[0.11]',
                    )}
                    disabled={busy}
                >
                    <UserCheck className="size-4 text-emerald-300" /> У друзях
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="glass-strong rounded-xl border-white/10 p-1 text-white"
                >
                    <DropdownMenuItem
                        className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                        onSelect={() =>
                            router.delete(`/friends/${username}`, options)
                        }
                    >
                        <UserMinus className="text-rose-300" /> Видалити з
                        друзів
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    if (relation === 'incoming') {
        return (
            <span className="inline-flex gap-1.5">
                <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        router.post(`/friends/${username}/accept`, {}, options)
                    }
                    className={cn(base, 'btn-glow')}
                >
                    <Check className="size-4" /> Прийняти
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        router.delete(`/friends/${username}`, options)
                    }
                    className={cn(
                        base,
                        'bg-white/[0.06] px-3 text-white/70 hover:bg-white/10 hover:text-white',
                    )}
                    aria-label="Відхилити"
                >
                    <X className="size-4" />
                </button>
            </span>
        );
    }

    if (relation === 'outgoing') {
        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => router.delete(`/friends/${username}`, options)}
                className={cn(
                    base,
                    'group bg-white/[0.06] text-white/75 hover:bg-white/10',
                )}
            >
                <Clock className="size-4 group-hover:hidden" />
                <X className="hidden size-4 group-hover:block" />
                <span className="group-hover:hidden">Заявку надіслано</span>
                <span className="hidden group-hover:inline">Скасувати</span>
            </button>
        );
    }

    return (
        <button
            type="button"
            disabled={busy}
            onClick={() => router.post(`/friends/${username}`, {}, options)}
            className={cn(base, 'btn-glow')}
        >
            <UserPlus className="size-4" /> Додати в друзі
        </button>
    );
}

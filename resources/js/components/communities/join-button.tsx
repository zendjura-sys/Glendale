import { router } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    Clock3,
    LogOut,
    Plus,
    UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CommunityCard, CommunityRole, MembershipStatus } from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    community: Pick<CommunityCard, 'slug' | 'type' | 'privacy'>;
    status: MembershipStatus | null;
    role?: CommunityRole | null;
    size?: 'sm' | 'md';
    className?: string;
};

export function JoinButton({
    community,
    status,
    role = null,
    size = 'md',
    className,
}: Props) {
    const [busy, setBusy] = useState(false);
    const isPublic = community.type === 'public';
    const height =
        size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-10 px-4 text-sm';
    const url = `/c/${community.slug}/join`;
    const options = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    if (status === null) {
        const label = isPublic
            ? tr('Підписатися')
            : community.privacy === 'closed'
              ? tr('Подати заявку')
              : tr('Вступити');

        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => router.post(url, {}, options)}
                className={cn(
                    'btn-glow inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-60',
                    height,
                    className,
                )}
            >
                {isPublic ? (
                    <Plus className="size-4" />
                ) : (
                    <UserPlus className="size-4" />
                )}
                {label}
            </button>
        );
    }

    if (status === 'pending') {
        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => router.delete(url, options)}
                title={tr('Скасувати заявку')}
                className={cn(
                    'group inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.07] font-semibold text-white/80 transition hover:bg-rose-500/15 hover:text-rose-200',
                    height,
                    className,
                )}
            >
                <Clock3 className="size-4" />
                <span className="group-hover:hidden">
                    {tr('Заявку надіслано')}
                </span>
                <span className="hidden group-hover:inline">
                    {tr('Скасувати')}
                </span>
            </button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={busy}
                className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.07] font-semibold text-white transition outline-none hover:bg-white/[0.11]',
                    height,
                    className,
                )}
            >
                <Check className="size-4 text-emerald-300" />
                {isPublic ? tr('Ви підписані') : tr('Ви учасник')}
                <ChevronDown className="size-4 text-white/45" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="glass-strong w-56 rounded-2xl border-white/10 p-1.5 text-white"
            >
                {role === 'owner' ? (
                    <div className="px-2.5 py-2 text-xs leading-relaxed text-white/50">
                        {tr(
                            'Ви власник. Щоб вийти, передайте права іншому адміністратору в розділі «Учасники».',
                        )}
                    </div>
                ) : (
                    <DropdownMenuItem
                        className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                        onSelect={() => router.delete(url, options)}
                    >
                        <LogOut className="text-rose-300" />
                        {isPublic
                            ? tr('Відписатися')
                            : tr('Вийти зі спільноти')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

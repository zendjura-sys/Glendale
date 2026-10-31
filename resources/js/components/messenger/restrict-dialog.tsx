import { router } from '@inertiajs/react';
import { Clock3, UserX } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

const DURATIONS = [5, 60, 1440, 10080];

/** Покарати учасника: тайм-аут (читає, не пише) або виключення на час. */
export function RestrictDialog({
    conversationId,
    user,
    onClose,
}: {
    conversationId: number;
    user: UserCard | null;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const label: Record<number, string> = {
        5: tr('5 хвилин'),
        60: tr('Година'),
        1440: tr('Доба'),
        10080: tr('Тиждень'),
    };
    const apply = (kind: 'timeout' | 'kick', minutes: number) => {
        if (!user) return;
        router.post(
            `/messages/${conversationId}/members/${user.username}/restrict`,
            { kind, minutes },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onSuccess: onClose,
            },
        );
    };

    return (
        <Dialog
            open={user !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="gap-5 sm:max-w-md">
                {user && (
                    <>
                        <div className="flex items-center gap-3">
                            <UserAvatar user={user} size="sm" />
                            <div className="min-w-0">
                                <DialogTitle className="truncate font-display text-lg font-semibold text-white">
                                    {user.name}
                                </DialogTitle>
                                <DialogDescription className="text-sm text-white/50">
                                    {tr(
                                        'Обмеження зніметься саме, коли мине строк.',
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                        {(
                            [
                                [
                                    'timeout',
                                    Clock3,
                                    tr('Тайм-аут'),
                                    tr('Читає, але не пише.'),
                                ],
                                [
                                    'kick',
                                    UserX,
                                    tr('Виключити на час'),
                                    tr(
                                        'Виходить і не може повернутися до строку.',
                                    ),
                                ],
                            ] as const
                        ).map(([kind, Icon, title, hint]) => (
                            <div key={kind} className="space-y-2">
                                <div>
                                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                                        <Icon className="size-4 text-white/55" />
                                        {title}
                                    </p>
                                    <p className="mt-0.5 pl-6 text-xs text-white/45">
                                        {hint}
                                    </p>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {DURATIONS.map((minutes) => (
                                        <button
                                            key={minutes}
                                            type="button"
                                            disabled={busy}
                                            onClick={() => apply(kind, minutes)}
                                            className={
                                                kind === 'kick'
                                                    ? 'h-10 rounded-xl bg-rose-500/12 text-[13px] font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50'
                                                    : 'h-10 rounded-xl bg-white/[0.06] text-[13px] font-medium text-white/80 transition hover:bg-white/[0.1] disabled:opacity-50'
                                            }
                                        >
                                            {label[minutes]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

import { Ban } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Toggle } from '@/components/gc/admin';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

const DAYS = [1, 7, 30, 0];

/**
 * Бан гостя гостьового чату за відбитком IP: більше не зможе писати в спільноті
 * (адміністрація сайту — всюди). Повідомлення гостя видаляється.
 */
export function GuestBanDialog({
    conversationId,
    message,
    canBanEverywhere,
    onClose,
    onBanned,
}: {
    conversationId: number;
    message: ChatMessage | null;
    canBanEverywhere: boolean;
    onClose: () => void;
    onBanned: (message: ChatMessage) => void;
}) {
    const [days, setDays] = useState(7);
    const [everywhere, setEverywhere] = useState(false);
    const [busy, setBusy] = useState(false);
    const label: Record<number, string> = {
        1: tr('Доба'),
        7: tr('Тиждень'),
        30: tr('Місяць'),
        0: tr('Назавжди'),
    };

    const ban = () => {
        if (!message) return;
        setBusy(true);
        void api(
            'POST',
            `/messages/${conversationId}/messages/${message.id}/ban-guest`,
            { days: days || null, everywhere },
        )
            .then(() => {
                toast.success(tr('Гостя заблоковано.'));
                onBanned(message);
                onClose();
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError ? e.message : tr('Не вдалося.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    return (
        <Dialog
            open={message !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="gap-4 sm:max-w-md">
                <div>
                    <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <Ban className="size-5 text-rose-300" />
                        {tr('Заблокувати гостя «{name}»', {
                            name: message?.guest?.name ?? '',
                        })}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr(
                            'Гість більше не зможе писати в гостьовий чат з цієї адреси. Його повідомлення буде видалено.',
                        )}
                    </DialogDescription>
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/[0.04] p-1">
                    {DAYS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setDays(value)}
                            className={cn(
                                'h-9 rounded-lg text-sm font-medium transition',
                                days === value
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/50 hover:text-white',
                            )}
                        >
                            {label[value]}
                        </button>
                    ))}
                </div>
                {canBanEverywhere && (
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-white/70">
                            {tr('На всьому сайті, не лише в цій спільноті')}
                        </p>
                        <Toggle
                            checked={everywhere}
                            onChange={setEverywhere}
                            label={tr('На всьому сайті')}
                        />
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-xl px-4 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={ban}
                        className="h-10 rounded-xl bg-rose-500/20 px-5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-50"
                    >
                        {tr('Заблокувати')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

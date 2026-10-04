import { useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const REASONS = {
    spam: 'Спам або реклама',
    abuse: 'Образи, мат, цькування',
    scam: 'Шахрайство',
    other: 'Інше',
} as const;

/** Скарга на повідомлення: причина й коментар — модераторам (у чаті сім’ї — ще й керівництву сім’ї). */
export function ReportDialog({
    url,
    onClose,
}: {
    url: string | null;
    onClose: () => void;
}) {
    const [reason, setReason] = useState<keyof typeof REASONS>('abuse');
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);

    const send = () => {
        if (!url) return;
        setBusy(true);
        void api<{ message: string }>('POST', url, { reason, comment })
            .then((r) => {
                toast.success(r.message);
                setComment('');
                onClose();
            })
            .catch((e: Error) => toast.error(e.message))
            .finally(() => setBusy(false));
    };

    return (
        <Dialog open={url !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>Поскаржитися на повідомлення</DialogTitle>
                <DialogDescription>
                    Модератори перевірять повідомлення й вирішать, що з ним
                    робити.
                </DialogDescription>
                <div className="space-y-1.5">
                    {Object.entries(REASONS).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() =>
                                setReason(key as keyof typeof REASONS)
                            }
                            className={cn(
                                'block w-full rounded-xl px-3 py-2 text-left text-sm transition',
                                reason === key
                                    ? 'bg-[var(--accent)]/20 text-white'
                                    : 'bg-white/[0.04] text-white/70 hover:bg-white/[0.07]',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <textarea
                    value={comment}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Коментар (необов’язково)"
                    className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <button
                    type="button"
                    disabled={busy}
                    onClick={send}
                    className="btn-glow h-10 w-full rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                    Надіслати скаргу
                </button>
            </DialogContent>
        </Dialog>
    );
}

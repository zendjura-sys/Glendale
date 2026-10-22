import { useForm } from '@inertiajs/react';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const REASONS = () => [
    { value: 'spam', label: tr('Спам або реклама') },
    { value: 'abuse', label: tr('Образи, цькування') },
    { value: 'fake', label: tr('Фейкова сторінка') },
    { value: 'scam', label: tr('Шахрайство') },
    { value: 'cheat', label: tr('Читерство') },
    { value: 'other', label: tr('Інше') },
];

/** Скарга на людину, а не на окреме повідомлення. */
export function ReportPersonButton({
    username,
    name,
    className,
}: {
    username: string;
    name: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({ reason: 'spam', comment: '' });

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={className}
            >
                <Flag className="size-4" />
                {tr('Поскаржитися')}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="glass-strong rounded-dialog border-white/10 p-6 text-white sm:max-w-md">
                    <DialogTitle className="font-display text-lg">
                        {tr('Скарга на {name}', { name })}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/50">
                        {tr(
                            'Модератори перевірять сторінку. Людина не дізнається, хто поскаржився.',
                        )}
                    </DialogDescription>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.post(`/report/${username}`, {
                                preserveScroll: true,
                                onSuccess: () => {
                                    setOpen(false);
                                    form.reset();
                                },
                            });
                        }}
                        className="space-y-3"
                    >
                        <div role="radiogroup" className="grid gap-1.5">
                            {REASONS().map((reason) => (
                                <label
                                    key={reason.value}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
                                        form.data.reason === reason.value
                                            ? 'bg-gc-indigo/20 text-white'
                                            : 'text-white/70 hover:bg-white/[0.05]',
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="reason"
                                        value={reason.value}
                                        checked={
                                            form.data.reason === reason.value
                                        }
                                        onChange={() =>
                                            form.setData('reason', reason.value)
                                        }
                                        className="accent-gc-indigo"
                                    />
                                    {reason.label}
                                </label>
                            ))}
                        </div>
                        <textarea
                            value={form.data.comment}
                            onChange={(event) =>
                                form.setData('comment', event.target.value)
                            }
                            rows={3}
                            maxLength={1000}
                            placeholder={tr('Що сталося (необов’язково)')}
                            className="input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                        {form.errors.reason && (
                            <p className="text-xs text-rose-300">
                                {form.errors.reason}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Надіслати скаргу')}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

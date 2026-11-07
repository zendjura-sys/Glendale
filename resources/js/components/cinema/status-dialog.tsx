import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { MovieOption, MovieStatus } from '@/types';

/** Вибір статусу перегляду: радіо-список «Не дивлюсь» + статуси, як у мобільних каталогах. */
export function StatusDialog({
    open,
    onOpenChange,
    statuses,
    value,
    onPick,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    statuses: MovieOption<MovieStatus>[];
    value: MovieStatus | null;
    onPick: (status: MovieStatus | null) => void;
}) {
    const options: { key: MovieStatus | null; label: string }[] = [
        { key: null, label: tr('Не дивлюсь') },
        ...statuses,
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm rounded-[28px] p-6">
                <DialogTitle className="text-xl font-semibold text-white">
                    {tr('Виберіть статус перегляду')}
                </DialogTitle>
                <div role="radiogroup" className="mt-2 space-y-1">
                    {options.map((option) => {
                        const on = option.key === value;

                        return (
                            <button
                                key={option.key ?? 'none'}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => {
                                    onPick(option.key);
                                    onOpenChange(false);
                                }}
                                className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[16px] text-white hover:bg-white/[0.05]"
                            >
                                <span
                                    className={cn(
                                        'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                                        on ? 'border-white' : 'border-white/40',
                                    )}
                                >
                                    {on && (
                                        <span className="size-3 rounded-full bg-white" />
                                    )}
                                </span>
                                {option.label}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-full px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.06]"
                    >
                        {tr('Скасувати')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

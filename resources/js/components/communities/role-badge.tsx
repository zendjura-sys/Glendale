import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const BADGE_COLORS = [
    'indigo',
    'sky',
    'emerald',
    'amber',
    'rose',
    'violet',
] as const;

export type BadgeColor = (typeof BADGE_COLORS)[number];

export const badgeTone: Record<BadgeColor, string> = {
    indigo: 'bg-gc-indigo/15 text-gc-lilac-300',
    sky: 'bg-gc-blue/15 text-gc-sky',
    emerald: 'bg-gc-mint/15 text-gc-mint',
    amber: 'bg-gc-amber/15 text-gc-amber',
    rose: 'bg-gc-coral/15 text-gc-coral',
    violet: 'bg-gc-purple/15 text-gc-violet-300',
};

/** Підпис ролі учасника спільноти з кольором. */
export function RoleBadge({
    title,
    color,
    className,
}: {
    title: string;
    color?: string | null;
    className?: string;
}) {
    const tone =
        badgeTone[(color as BadgeColor) ?? 'indigo'] ?? badgeTone.indigo;

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-chip px-2 py-0.5 text-[11px] leading-4 font-semibold',
                tone,
                className,
            )}
        >
            {title}
        </span>
    );
}

/** Діалог підпису ролі: назва і колір. */
export function RoleTitleDialog({
    open,
    name,
    initial,
    onClose,
    onSave,
}: {
    open: boolean;
    name: string;
    initial: { title: string; color: string | null };
    onClose: () => void;
    onSave: (title: string, color: BadgeColor) => void;
}) {
    const [title, setTitle] = useState(initial.title);
    const [color, setColor] = useState<BadgeColor>(
        (BADGE_COLORS as readonly string[]).includes(initial.color ?? '')
            ? (initial.color as BadgeColor)
            : 'indigo',
    );

    return (
        <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
            <DialogContent className="glass-strong rounded-dialog border-white/10 p-6 text-white sm:max-w-md">
                <DialogTitle className="font-display text-lg">
                    {tr('Підпис ролі')}
                </DialogTitle>
                <DialogDescription className="text-sm text-white/50">
                    {tr('Видно біля імені {name} у записах спільноти.', {
                        name,
                    })}
                </DialogDescription>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSave(title.trim(), color);
                    }}
                    className="space-y-4"
                >
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={32}
                        placeholder={tr('Наприклад, «Модератор» чи «Ветеран»')}
                        aria-label={tr('Підпис')}
                        className="input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <div
                        role="radiogroup"
                        aria-label={tr('Колір')}
                        className="flex flex-wrap gap-2"
                    >
                        {BADGE_COLORS.map((item) => (
                            <button
                                key={item}
                                type="button"
                                role="radio"
                                aria-checked={color === item}
                                onClick={() => setColor(item)}
                                className={cn(
                                    'rounded-full ring-offset-2 ring-offset-transparent transition',
                                    color === item && 'ring-2 ring-white/60',
                                )}
                            >
                                <RoleBadge
                                    title={title.trim() || tr('Підпис')}
                                    color={item}
                                />
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2">
                        {initial.title && (
                            <button
                                type="button"
                                onClick={() => onSave('', color)}
                                className="h-10 rounded-xl px-4 text-sm font-medium text-white/60 hover:text-white"
                            >
                                {tr('Прибрати')}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={title.trim() === ''}
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

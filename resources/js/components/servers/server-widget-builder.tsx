import { Check, Copy, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const PARTS = ['online', 'families', 'vote', 'discord'] as const;
const ACCENTS = [
    '#6366f1',
    '#0ea5e9',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#a855f7',
];

function partLabel(p: (typeof PARTS)[number]): string {
    switch (p) {
        case 'online':
            return tr('Онлайн');
        case 'families':
            return tr('Топ сімей');
        case 'vote':
            return tr('Голосування');
        default:
            return 'Discord';
    }
}

/** Конструктор віджета для сайту сервера: тема, блоки, колір, перегляд наживо й код. */
export function ServerWidgetBuilder({ slug }: { slug: string }) {
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [parts, setParts] = useState<string[]>([...PARTS]);
    const [accent, setAccent] = useState(ACCENTS[0]);
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const show = PARTS.filter((p) => parts.includes(p)).join(',');
    const code = `<script src="${origin}/widget/s/${slug}/widget.js" data-theme="${theme}" data-show="${show}" data-accent="${accent}" async></script>`;
    const preview = `/widget/s/${slug}/preview?theme=${theme}&show=${encodeURIComponent(show)}&accent=${encodeURIComponent(accent)}`;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]"
            >
                <LayoutTemplate className="size-4" />
                {tr('Віджет для сайту сервера')}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="gap-4 sm:max-w-2xl">
                    <div>
                        <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                            <LayoutTemplate className="size-5 text-sky-400" />
                            {tr('Віджет для сайту сервера')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Онлайн наживо, топ сімей, кнопка голосування й Discord — на вашому сайті. Оновлюється кожні 2 хвилини.',
                            )}
                        </DialogDescription>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="text-xs text-white/50">
                                    {tr('Тема')}
                                </div>
                                <div className="flex gap-2">
                                    {(['dark', 'light'] as const).map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setTheme(t)}
                                            className={cn(
                                                'flex-1 rounded-xl px-3 py-2 text-sm',
                                                theme === t
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white/5 text-white/70',
                                            )}
                                        >
                                            {t === 'dark'
                                                ? tr('Темна')
                                                : tr('Світла')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs text-white/50">
                                    {tr('Що показувати')}
                                </div>
                                {PARTS.map((p) => (
                                    <label
                                        key={p}
                                        className="flex items-center gap-2 text-sm text-white/80"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={parts.includes(p)}
                                            onChange={(e) =>
                                                setParts((list) =>
                                                    e.target.checked
                                                        ? [...list, p]
                                                        : list.filter(
                                                              (x) => x !== p,
                                                          ),
                                                )
                                            }
                                        />
                                        {partLabel(p)}
                                    </label>
                                ))}
                            </div>
                            <div className="space-y-1.5">
                                <div className="text-xs text-white/50">
                                    {tr('Колір')}
                                </div>
                                <div className="flex gap-2">
                                    {ACCENTS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            aria-label={c}
                                            onClick={() => setAccent(c)}
                                            className="flex size-7 items-center justify-center rounded-full"
                                            style={{ background: c }}
                                        >
                                            {accent === c && (
                                                <Check className="size-4 text-white" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <iframe
                            key={preview}
                            src={preview}
                            title={tr('Попередній перегляд')}
                            className="h-80 w-full rounded-xl border border-white/10"
                        />
                    </div>
                    <textarea
                        readOnly
                        rows={3}
                        value={code}
                        onFocus={(e) => e.currentTarget.select()}
                        className="input-glass w-full resize-none rounded-xl px-3 py-2.5 font-mono text-xs text-white"
                    />
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                void navigator.clipboard.writeText(code);
                                toast.success(tr('Код скопійовано'));
                            }}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold"
                        >
                            <Copy className="size-4" />
                            {tr('Копіювати код')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

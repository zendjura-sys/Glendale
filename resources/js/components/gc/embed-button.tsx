import { Code2, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

/**
 * «Віджет для сайту»: код <script>, що показує картку гравця чи сервера на будь-якому сайті
 * (Discord-боти, форуми, сайт сервера).
 */
export function EmbedButton({
    path,
    className,
}: {
    /** Наприклад, /widget/u/nick або /widget/s/quant-rp */
    path: string;
    className?: string;
}) {
    const on = usePlugin('embed_widgets');
    const [open, setOpen] = useState(false);
    if (!on) return null;
    const code = `<script src="${window.location.origin}${path}/card.js" async></script>`;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]',
                    className,
                )}
            >
                <Code2 className="size-4" />
                {tr('Віджет')}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="gap-4 sm:max-w-lg">
                    <div>
                        <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                            <Code2 className="size-5 text-gc-lilac-300" />
                            {tr('Віджет для сайту')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Вставте код на свій сайт чи форум — з’явиться картка з посиланням на GameCon. Дані оновлюються самі.',
                            )}
                        </DialogDescription>
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
                            {tr('Копіювати')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

import { RefreshCw, Sparkles } from 'lucide-react';
import { TextSkeleton } from '@/components/gc/skeletons';
import { useCallback, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';

/** «Підсумок від ШІ»: коротко, про що говорили в групі останнім часом. */
export function AiSummaryDialog({
    conversationId,
    open,
    onOpenChange,
}: {
    conversationId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        setBusy(true);
        setError(null);
        void api<{ summary: string }>(
            'POST',
            `/messages/${conversationId}/ai/summary`,
        )
            .then((data) => setSummary(data.summary))
            .catch((e: unknown) =>
                setError(
                    e instanceof ApiError
                        ? e.message
                        : tr('ШІ зараз недоступний.'),
                ),
            )
            .finally(() => setBusy(false));
    }, [conversationId]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-4 sm:max-w-lg">
                <div>
                    <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <Sparkles className="size-5 text-gc-lilac-300" />
                        {tr('Підсумок від ШІ')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr('Останні ~80 повідомлень. ШІ може помилятися.')}
                    </DialogDescription>
                </div>
                {busy ? (
                    <TextSkeleton lines={5} />
                ) : error ? (
                    <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">
                        {error}
                    </p>
                ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-line text-white/85">
                        {summary}
                    </p>
                )}
                <div className="flex justify-end">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={load}
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                    >
                        <RefreshCw className="size-4" />
                        {tr('Оновити')}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

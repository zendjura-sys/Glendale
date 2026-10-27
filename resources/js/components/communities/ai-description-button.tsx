import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';

/** «Написати з ШІ»: чернетка опису спільноти з назви, тематики й правил. */
export function AiDescriptionButton({
    slug,
    onResult,
}: {
    slug: string;
    onResult: (text: string) => void;
}) {
    const [busy, setBusy] = useState(false);

    const write = () => {
        setBusy(true);
        void api<{ text: string }>('POST', `/c/${slug}/ai/description`)
            .then((data) => {
                onResult(data.text);
                toast.success(tr('Чернетку готово — перегляньте й збережіть.'));
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError
                        ? e.message
                        : tr('ШІ зараз недоступний.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    return (
        <button
            type="button"
            disabled={busy}
            onClick={write}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-gc-lilac-300 transition hover:bg-white/[0.06] disabled:opacity-60"
        >
            {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
            ) : (
                <Sparkles className="size-3.5" />
            )}
            {tr('Написати з ШІ')}
        </button>
    );
}

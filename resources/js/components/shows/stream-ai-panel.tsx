import { Loader2, Sparkles, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Watch = {
    mood: string;
    risks: string[];
    tips: string[];
    promo: string;
};

/** Панель ШІ для ведучого GameCast / LiveCast. */
export function StreamAiPanel({
    endpointBase,
    className,
}: {
    endpointBase: string;
    className?: string;
}) {
    const [busy, setBusy] = useState<'watch' | 'promo' | null>(null);
    const [watch, setWatch] = useState<Watch | null>(null);
    const [promo, setPromo] = useState('');

    const run = async (kind: 'watch' | 'promo') => {
        setBusy(kind);
        try {
            if (kind === 'watch') {
                const data = await api<Watch>(
                    'POST',
                    `${endpointBase}/ai/watch`,
                );
                setWatch(data);
                if (data.promo) setPromo(data.promo);
            } else {
                const data = await api<{ promo: string }>(
                    'POST',
                    `${endpointBase}/ai/promo`,
                );
                setPromo(data.promo);
            }
        } catch (e) {
            toast.error(
                e instanceof ApiError ? e.message : tr('ШІ зараз не відповів'),
            );
        } finally {
            setBusy(null);
        }
    };

    return (
        <section
            className={cn(
                'gc-solid space-y-3 rounded-2xl border border-violet-400/20 p-4',
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-violet-300" />
                <h3 className="font-display text-sm font-bold text-white">
                    {tr('ШІ-помічник ефіру')}
                </h3>
            </div>
            <p className="text-xs text-white/50">
                {tr(
                    'Слідкує за чатом і залученістю, підказує ризики й текст для промо. Ключ — з адмінки → Інтеграції.',
                )}
            </p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void run('watch')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-500/90 px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                    {busy === 'watch' ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <Sparkles className="size-3.5" />
                    )}
                    {tr('Оглянути ефір')}
                </button>
                <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void run('promo')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                    {busy === 'promo' ? (
                        <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                        <Megaphone className="size-3.5" />
                    )}
                    {tr('Текст для промо')}
                </button>
            </div>
            {watch && (
                <div className="space-y-2 text-sm">
                    <p className="text-violet-200">
                        <span className="font-semibold">{tr('Настрій')}:</span>{' '}
                        {watch.mood}
                    </p>
                    {watch.risks.length > 0 && (
                        <ul className="list-inside list-disc text-amber-200/90">
                            {watch.risks.map((r) => (
                                <li key={r}>{r}</li>
                            ))}
                        </ul>
                    )}
                    {watch.tips.length > 0 && (
                        <ul className="list-inside list-disc text-white/70">
                            {watch.tips.map((t) => (
                                <li key={t}>{t}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {promo && (
                <div className="rounded-xl bg-white/[0.04] p-3 text-sm text-white/80">
                    <div className="mb-1 text-xs font-semibold text-white/45">
                        {tr('Промо')}
                    </div>
                    {promo}
                    <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-violet-300 hover:underline"
                        onClick={() => {
                            void navigator.clipboard.writeText(promo);
                            toast.success(tr('Скопійовано'));
                        }}
                    >
                        {tr('Копіювати')}
                    </button>
                </div>
            )}
        </section>
    );
}

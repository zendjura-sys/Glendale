import { Link } from '@inertiajs/react';
import { Check, HeartHandshake, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Tier = { id: number; name: string; price: number; perks: string | null };
type State = {
    tiers: Tier[];
    balance: number;
    current: { tier_id: number | null; expires_at: string } | null;
};

export const uah = (kopecks: number) =>
    `${(kopecks / 100).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} ₴`;

/** «Підтримати» на сторінці автора: рівні підписки, оплата з рахунку (лише сайт). */
export function SupportAuthorButton({
    username,
    name,
    className,
}: {
    username: string;
    name: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<State | null>(null);
    const [busy, setBusy] = useState<number | null>(null);

    const load = async () => {
        setOpen(true);
        setState(await api<State>('GET', `/u/${username}/tiers`));
    };
    const subscribe = async (tier: Tier) => {
        setBusy(tier.id);
        try {
            await api('POST', '/author-subscriptions', { tier_id: tier.id });
            toast.success(tr('Дякуємо за підтримку!'));
            setOpen(false);
            window.location.reload();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : tr('Не вдалося'),
            );
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={load}
                className={cn(
                    'btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold',
                    className,
                )}
            >
                <HeartHandshake className="size-4" />
                {tr('Підтримати')}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="gap-4 sm:max-w-md">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Підтримати {name}', { name })}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-white/55">
                            {tr(
                                'Щомісячна підписка з вашого рахунку GameCon: відкриває записи «лише для підписників». Скасувати автопродовження можна будь-коли.',
                            )}
                        </DialogDescription>
                    </div>
                    {!state ? (
                        <div className="space-y-2">
                            <div className="skeleton h-20 rounded-2xl" />
                            <div className="skeleton h-20 rounded-2xl" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {state.tiers.map((tier) => {
                                    const current =
                                        state.current?.tier_id === tier.id;

                                    return (
                                        <div
                                            key={tier.id}
                                            className="rounded-2xl bg-white/[0.06] p-4"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-white">
                                                        {tier.name}
                                                    </p>
                                                    <p className="text-sm text-white/55 tabular-nums">
                                                        {tr(
                                                            '{price} на місяць',
                                                            {
                                                                price: uah(
                                                                    tier.price,
                                                                ),
                                                            },
                                                        )}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={
                                                        busy !== null ||
                                                        state.balance <
                                                            tier.price
                                                    }
                                                    onClick={() =>
                                                        subscribe(tier)
                                                    }
                                                    className="btn-glow inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                                                >
                                                    {current && (
                                                        <Check className="size-4" />
                                                    )}
                                                    {current
                                                        ? tr('Продовжити')
                                                        : tr('Обрати')}
                                                </button>
                                            </div>
                                            {tier.perks && (
                                                <p className="mt-2 text-sm whitespace-pre-line text-white/70">
                                                    {tier.perks}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm">
                                <span className="inline-flex items-center gap-2 text-white/60">
                                    <Wallet className="size-4" />
                                    {tr('На рахунку: {sum}', {
                                        sum: uah(state.balance),
                                    })}
                                </span>
                                <Link
                                    href="/plus/billing"
                                    className="font-medium text-gc-lilac-300 hover:underline"
                                >
                                    {tr('Поповнити')}
                                </Link>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

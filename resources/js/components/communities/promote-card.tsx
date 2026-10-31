import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';

export type Promotion = {
    until: string | null;
    price: string;
    days: number;
    listed: boolean;
};

/** Для керівників: просування спільноти в каталозі за одиниці балансу GameCon. */
export function CommunityPromoteCard({
    slug,
    promotion,
}: {
    slug: string;
    promotion: Promotion;
}) {
    const [until, setUntil] = useState(promotion.until);
    const [busy, setBusy] = useState(false);
    const buy = async () => {
        setBusy(true);
        try {
            const result = await api<{ promoted_until: string }>(
                'POST',
                `/c/${slug}/promote`,
            );
            setUntil(result.promoted_until);
            toast.success(tr('Спільнота просувається в каталозі.'));
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : tr('Не вдалося'),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gc-indigo/20">
                <Megaphone className="size-5 text-gc-lilac-300" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                    {until
                        ? tr('Просувається до {date}', {
                              date: formatDate(until, false),
                          })
                        : tr('Просування в каталозі')}
                </p>
                <p className="text-xs text-white/50">
                    {promotion.listed
                        ? tr(
                              '{days} днів угорі «Огляду» за {price} з балансу GameCon.',
                              {
                                  days: promotion.days,
                                  price: promotion.price,
                              },
                          )
                        : tr('Спершу зробіть спільноту видимою в каталозі.')}
                </p>
            </div>
            <button
                type="button"
                disabled={busy || !promotion.listed}
                onClick={buy}
                className="btn-glow h-10 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
            >
                {until ? tr('Продовжити') : tr('Просувати')}
            </button>
        </section>
    );
}

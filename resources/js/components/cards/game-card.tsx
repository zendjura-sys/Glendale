import { Layers } from 'lucide-react';
import { useState } from 'react';
import { Widget } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type CardData = {
    id: number;
    slug: string;
    name: string;
    cover: string | null;
    rarity: Rarity;
    set: string;
};

export type ShowcaseData = { cards: CardData[]; owned: number; total: number };

/** Колір рамки й підпис рідкості. */
export const RARITY: Record<Rarity, { ring: string; glow: string }> = {
    common: { ring: '#94a3b8', glow: 'rgba(148,163,184,0.25)' },
    rare: { ring: '#38bdf8', glow: 'rgba(56,189,248,0.35)' },
    epic: { ring: '#a855f7', glow: 'rgba(168,85,247,0.4)' },
    legendary: { ring: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
};

export function rarityLabel(r: Rarity): string {
    switch (r) {
        case 'legendary':
            return tr('Легендарна');
        case 'epic':
            return tr('Епічна');
        case 'rare':
            return tr('Рідкісна');
        default:
            return tr('Звичайна');
    }
}

/** Картка гри: обкладинка, рамка рідкості, назва. Без картки в колекції — силует. */
export function GameCardArt({
    card,
    locked = false,
    copies,
    className,
}: {
    card: CardData;
    locked?: boolean;
    copies?: number;
    className?: string;
}) {
    const tone = RARITY[card.rarity];
    // Обкладинка не завантажилась — показуємо літеру гри.
    const [broken, setBroken] = useState(false);

    return (
        <div
            data-on-dark
            className={cn(
                'relative aspect-[5/7] overflow-hidden rounded-xl bg-[#0B1220] p-[3px] text-white',
                className,
            )}
            style={{
                backgroundImage: locked
                    ? undefined
                    : `linear-gradient(160deg, ${tone.ring}, #0B1220 55%, ${tone.ring})`,
                boxShadow: locked ? undefined : `0 6px 18px ${tone.glow}`,
            }}
        >
            <div className="relative flex size-full flex-col overflow-hidden rounded-[10px] bg-[#0B1220]">
                <div className="relative flex-1 overflow-hidden">
                    {card.cover && !broken ? (
                        <img
                            src={card.cover}
                            alt=""
                            loading="lazy"
                            onError={() => setBroken(true)}
                            className={cn(
                                'size-full object-cover',
                                locked && 'opacity-20 grayscale',
                            )}
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center font-display text-4xl font-black text-white/20">
                            {locked ? '?' : card.name.slice(0, 1)}
                        </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0B1220] to-transparent" />
                    {copies !== undefined && copies > 1 && (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-1.5 text-[11px] font-semibold tabular-nums">
                            ×{copies}
                        </span>
                    )}
                </div>
                <div className="px-2 pt-1 pb-2">
                    <div className="line-clamp-2 text-xs leading-tight font-semibold">
                        {locked ? '???' : card.name}
                    </div>
                    <div
                        className="mt-0.5 text-[10px] font-medium"
                        style={{ color: tone.ring }}
                    >
                        {rarityLabel(card.rarity)}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Вітрина карток у профілі. */
export function CardShowcase({
    data,
    isSelf,
}: {
    data: ShowcaseData;
    isSelf: boolean;
}) {
    return (
        <Widget
            title={tr('Колекційні картки')}
            icon={Layers}
            href={isSelf ? '/cards' : undefined}
        >
            <div className="grid grid-cols-3 gap-2 px-1">
                {data.cards.map((c) => (
                    <GameCardArt key={c.id} card={c} />
                ))}
            </div>
            <p className="mt-2 px-1 text-xs text-white/55">
                {tr('Зібрано {owned} з {total}', {
                    owned: data.owned,
                    total: data.total,
                })}
            </p>
        </Widget>
    );
}

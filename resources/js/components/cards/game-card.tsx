import { Layers } from 'lucide-react';
import { useState } from 'react';
import { Widget } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Ранги від найнижчого до найвищого. */
export const RANKS = [
    'N',
    'G',
    'F',
    'E',
    'D',
    'C',
    'B',
    'A',
    'R',
    'SR',
    'SSR',
    'S',
    'SS',
    'SSS',
    'EX',
    'U',
] as const;

export type Rarity = (typeof RANKS)[number];

export type CardKind = 'game' | 'anime' | 'movie' | 'serial';

export type CardData = {
    key: string;
    kind: CardKind;
    name: string;
    cover: string | null;
    rarity: Rarity;
    set: string;
    href: string | null;
};

export type ShowcaseData = { cards: CardData[]; owned: number; total: number };

/** Колір рамки рангу: від сірого через синій і фіолетовий до золота й веселки. */
export const RARITY: Record<
    Rarity,
    { ring: string; glow: string; ring2?: string }
> = {
    N: { ring: '#64748b', glow: 'rgba(100,116,139,0.18)' },
    G: { ring: '#78716c', glow: 'rgba(120,113,108,0.18)' },
    F: { ring: '#94a3b8', glow: 'rgba(148,163,184,0.2)' },
    E: { ring: '#a3e635', glow: 'rgba(163,230,53,0.22)' },
    D: { ring: '#4ade80', glow: 'rgba(74,222,128,0.25)' },
    C: { ring: '#2dd4bf', glow: 'rgba(45,212,191,0.28)' },
    B: { ring: '#38bdf8', glow: 'rgba(56,189,248,0.3)' },
    A: { ring: '#3b82f6', glow: 'rgba(59,130,246,0.35)' },
    R: { ring: '#6366f1', glow: 'rgba(99,102,241,0.38)' },
    SR: { ring: '#a855f7', glow: 'rgba(168,85,247,0.4)' },
    SSR: { ring: '#d946ef', glow: 'rgba(217,70,239,0.42)' },
    S: { ring: '#f59e0b', glow: 'rgba(245,158,11,0.45)' },
    SS: { ring: '#f97316', glow: 'rgba(249,115,22,0.48)', ring2: '#fbbf24' },
    SSS: { ring: '#ef4444', glow: 'rgba(239,68,68,0.5)', ring2: '#f59e0b' },
    EX: { ring: '#22d3ee', glow: 'rgba(34,211,238,0.55)', ring2: '#e879f9' },
    U: { ring: '#fde047', glow: 'rgba(253,224,71,0.6)', ring2: '#a855f7' },
};

/** Назва рангу: літера й розшифровка. */
export function rarityLabel(r: Rarity): string {
    const names: Record<Rarity, string> = {
        N: tr('Звичайна'),
        G: tr('Брак'),
        F: tr('Слабка'),
        E: tr('Новачок'),
        D: tr('Посередня'),
        C: tr('Середній клас'),
        B: tr('Профі'),
        A: tr('Еліта'),
        R: tr('Рідкісна'),
        SR: tr('Суперрідкісна'),
        SSR: tr('Надрідкісна'),
        S: tr('Вища еліта'),
        SS: tr('Катастрофічна'),
        SSS: tr('Легенда'),
        EX: tr('Аномалія'),
        U: tr('Унікальна'),
    };

    return `${r} · ${names[r]}`;
}

export function kindLabel(kind: CardKind): string {
    switch (kind) {
        case 'anime':
            return tr('Аніме');
        case 'movie':
            return tr('Фільм');
        case 'serial':
            return tr('Серіал');
        default:
            return tr('Гра');
    }
}

/** Картка гри: обкладинка, рамка рідкості, назва. Без картки в колекції — силует. */
export function GameCardArt({
    card,
    locked = false,
    copies,
    className,
    compact = false,
}: {
    card: CardData;
    locked?: boolean;
    copies?: number;
    className?: string;
    /** Без підпису внизу (маленькі картки у вітрині профілю). */
    compact?: boolean;
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
                    : `linear-gradient(160deg, ${tone.ring}, #0B1220 55%, ${tone.ring2 ?? tone.ring})`,
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
                    {!locked && (
                        <span
                            className="absolute top-1.5 left-1.5 rounded-md bg-black/65 px-1.5 text-[11px] font-black tracking-tight"
                            style={{ color: tone.ring }}
                        >
                            {card.rarity}
                        </span>
                    )}
                    {copies !== undefined && copies > 1 && (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 px-1.5 text-[11px] font-semibold tabular-nums">
                            ×{copies}
                        </span>
                    )}
                </div>
                <div className={cn('px-2 pt-1 pb-2', compact && 'hidden')}>
                    <div className="line-clamp-2 text-xs leading-tight font-semibold">
                        {locked ? '???' : card.name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-white/55">
                        {card.kind === 'game' ? (
                            <span style={{ color: tone.ring }}>
                                {rarityLabel(card.rarity)}
                            </span>
                        ) : (
                            card.set
                        )}
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
            title={tr('Найдорожчі картки')}
            icon={Layers}
            href={isSelf ? '/cards' : undefined}
        >
            <div className="grid grid-cols-5 gap-1.5 px-1">
                {data.cards.map((c) => (
                    <div
                        key={c.key}
                        title={`${c.name} · ${rarityLabel(c.rarity)}`}
                    >
                        <GameCardArt card={c} compact />
                    </div>
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

import { Link } from '@inertiajs/react';
import { Clock3, Lock, Smile, Sticker as StickerIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { EMOJI_CATEGORIES, recentEmoji, rememberEmoji } from '@/lib/emoji';
import { cn } from '@/lib/utils';
import type { StickerItem, StickerPackItem } from '@/types';
import { tr } from '@/lib/i18n';

let packsCache: Promise<StickerPackItem[]> | null = null;

function loadPacks(): Promise<StickerPackItem[]> {
    packsCache ??= api<{ packs: StickerPackItem[] }>(
        'GET',
        '/messages/stickers',
    )
        .then((response) => response.packs)
        .catch((error: unknown) => {
            packsCache = null;
            throw error;
        });

    return packsCache;
}

const RECENT_STICKERS = 'gc.stickers.recent';

function recentStickers(): StickerItem[] {
    try {
        const value = JSON.parse(localStorage.getItem(RECENT_STICKERS) ?? '[]');

        return Array.isArray(value) ? value.slice(0, 16) : [];
    } catch {
        return [];
    }
}

function rememberSticker(sticker: StickerItem) {
    const next = [
        sticker,
        ...recentStickers().filter((s) => s.id !== sticker.id),
    ].slice(0, 16);
    try {
        localStorage.setItem(RECENT_STICKERS, JSON.stringify(next));
    } catch {
        // Не критично: недавні стікери просто не збережуться.
    }
}

type Tab = 'emoji' | 'stickers';

export function EmojiPanel({
    allowStickers,
    onEmoji,
    onSticker,
}: {
    allowStickers: boolean;
    onEmoji: (emoji: string) => void;
    onSticker: (sticker: StickerItem) => void;
}) {
    const [tab, setTab] = useState<Tab>('emoji');

    return (
        <div className="glass-strong flex h-[380px] w-[min(352px,calc(100vw-24px))] animate-rise flex-col overflow-hidden rounded-2xl">
            {tab === 'emoji' || !allowStickers ? (
                <EmojiGrid onPick={onEmoji} />
            ) : (
                <StickerGrid onPick={onSticker} />
            )}
            {allowStickers && (
                <div className="flex shrink-0 justify-center gap-1 border-t border-white/[0.06] p-1.5">
                    {(
                        [
                            { key: 'emoji', label: tr('Емодзі'), icon: Smile },
                            {
                                key: 'stickers',
                                label: tr('Стікери'),
                                icon: StickerIcon,
                            },
                        ] as const
                    ).map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={cn(
                                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                                tab === key
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/45 hover:text-white',
                            )}
                        >
                            <Icon className="size-4" />
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
    const [recent, setRecent] = useState<string[]>(recentEmoji);
    const [active, setActive] = useState(
        recent.length ? 'recent' : EMOJI_CATEGORIES[0].key,
    );
    const scrollRef = useRef<HTMLDivElement>(null);

    const sections = [
        ...(recent.length
            ? [{ key: 'recent', label: tr('Недавні'), icon: '', items: recent }]
            : []),
        ...EMOJI_CATEGORIES,
    ];

    const jump = (key: string) => {
        setActive(key);
        scrollRef.current
            ?.querySelector(`[data-section="${key}"]`)
            ?.scrollIntoView({ block: 'start' });
    };

    const onScroll = () => {
        const root = scrollRef.current;
        if (!root) return;
        const top = root.scrollTop + 8;
        let current = sections[0]?.key;
        root.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
            if (el.offsetTop <= top) current = el.dataset.section ?? current;
        });
        if (current && current !== active) setActive(current);
    };

    return (
        <>
            <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-white/[0.06] px-1.5 py-1">
                {sections.map((section) => (
                    <button
                        key={section.key}
                        type="button"
                        onClick={() => jump(section.key)}
                        title={section.label}
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-lg text-lg transition',
                            active === section.key
                                ? 'bg-white/10'
                                : 'opacity-55 grayscale hover:opacity-100 hover:grayscale-0',
                        )}
                    >
                        {section.key === 'recent' ? (
                            <Clock3 className="size-4 text-white/80" />
                        ) : (
                            section.icon
                        )}
                    </button>
                ))}
            </div>
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="relative min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
            >
                {sections.map((section) => (
                    <section key={section.key} data-section={section.key}>
                        <h4 className="sticky top-0 z-10 bg-[#11162a]/95 px-1.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-white/45 uppercase backdrop-blur">
                            {section.label}
                        </h4>
                        <div className="grid grid-cols-8 gap-0.5">
                            {section.items.map((emoji, index) => (
                                <button
                                    key={`${section.key}-${emoji}-${index}`}
                                    type="button"
                                    onClick={() => {
                                        onPick(emoji);
                                        setRecent(rememberEmoji(emoji));
                                    }}
                                    className="flex aspect-square items-center justify-center rounded-lg text-[22px] leading-none transition hover:scale-110 hover:bg-white/10"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

function StickerGrid({ onPick }: { onPick: (sticker: StickerItem) => void }) {
    const [packs, setPacks] = useState<StickerPackItem[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [recent] = useState<StickerItem[]>(recentStickers);
    const [active, setActive] = useState<string>(recent.length ? 'recent' : '');

    useEffect(() => {
        let alive = true;
        loadPacks()
            .then((value) => alive && setPacks(value))
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, []);

    const currentPack =
        active === 'recent'
            ? null
            : (packs?.find((p) => p.slug === active) ?? packs?.[0]);
    const current = active === 'recent' ? recent : currentPack?.stickers;
    const locked = currentPack?.locked === true;
    const activeKey =
        active === 'recent' ? 'recent' : ((active || packs?.[0]?.slug) ?? '');

    return (
        <>
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] px-1.5 py-1">
                {recent.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setActive('recent')}
                        title={tr('Недавні')}
                        className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg transition',
                            activeKey === 'recent'
                                ? 'bg-white/10'
                                : 'opacity-60 hover:opacity-100',
                        )}
                    >
                        <Clock3 className="size-4 text-white/80" />
                    </button>
                )}
                {packs?.map((pack) => (
                    <button
                        key={pack.id}
                        type="button"
                        onClick={() => setActive(pack.slug)}
                        title={pack.name}
                        className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg p-1 transition',
                            activeKey === pack.slug
                                ? 'bg-white/10'
                                : 'opacity-60 hover:opacity-100',
                        )}
                    >
                        <img
                            loading="lazy"
                            decoding="async"
                            src={pack.stickers[0]?.url}
                            alt={pack.name}
                            className="size-full object-contain"
                        />
                    </button>
                ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {failed ? (
                    <p className="px-4 py-16 text-center text-sm text-white/45">
                        {tr('Не вдалося завантажити стікери.')}
                    </p>
                ) : packs === null ? (
                    <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <span
                                key={i}
                                className="skeleton aspect-square rounded-xl"
                            />
                        ))}
                    </div>
                ) : !current?.length ? (
                    <p className="px-4 py-16 text-center text-sm text-white/45">
                        {tr(
                            'Стікерів поки немає. Адміністратор може додати набори в адмін-панелі.',
                        )}
                    </p>
                ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                        {locked && (
                            <Link
                                href="/plus"
                                className="col-span-4 mb-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500/15 px-3 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25"
                            >
                                <Lock className="size-3.5" />
                                {tr(
                                    'Набір GameCon+ — надсилати можна з підпискою',
                                )}
                            </Link>
                        )}
                        {current.map((sticker) => (
                            <button
                                key={sticker.id}
                                type="button"
                                disabled={locked}
                                onClick={() => {
                                    rememberSticker(sticker);
                                    onPick(sticker);
                                }}
                                title={sticker.emoji ?? undefined}
                                className="aspect-square rounded-xl p-1 transition hover:scale-105 hover:bg-white/[0.07] disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-transparent"
                            >
                                <img
                                    src={sticker.url}
                                    alt={sticker.emoji ?? ''}
                                    loading="lazy"
                                    className="size-full object-contain"
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

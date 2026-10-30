import { Head, router } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_TIERS, TIER_COLORS } from '@/components/games/tier-colors';
import type { Tier } from '@/components/games/tier-colors';
import { Toggle } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    list: {
        id: number;
        title: string;
        tiers: Tier[];
        is_public: boolean;
    } | null;
    game: { id: number; slug: string; name: string } | null;
    colors: string[];
};

/**
 * Редактор тір-листа: пункти додаються в «запас» і перетягуються в рівні.
 * На телефоні — дотик по пункту, потім по рівню (без перетягування).
 */
export default function TierListEdit({ list, game, colors }: Props) {
    const [title, setTitle] = useState(
        list?.title ??
            (game ? tr('Тір-лист: {game}', { game: game.name }) : ''),
    );
    const [tiers, setTiers] = useState<Tier[]>(list?.tiers ?? DEFAULT_TIERS);
    const [pool, setPool] = useState<string[]>([]);
    const [draft, setDraft] = useState('');
    const [isPublic, setIsPublic] = useState(list?.is_public ?? true);
    const [picked, setPicked] = useState<{
        from: number;
        index: number;
    } | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    // from: -1 — запас, інакше номер рівня.
    const move = (from: number, index: number, to: number) => {
        const item = from === -1 ? pool[index] : tiers[from].items[index];
        if (item === undefined || from === to) return;
        const nextTiers = tiers.map((t, i) => ({
            ...t,
            items: [
                ...(i === from
                    ? t.items.filter((_, j) => j !== index)
                    : t.items),
                ...(i === to ? [item] : []),
            ],
        }));
        setTiers(nextTiers);
        setPool([
            ...(from === -1 ? pool.filter((_, j) => j !== index) : pool),
            ...(to === -1 ? [item] : []),
        ]);
        setPicked(null);
    };

    const addItems = () => {
        const items = draft
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 30);
        if (items.length) setPool([...pool, ...items]);
        setDraft('');
    };

    const save = () => {
        const payload = {
            title,
            game_id: game?.id ?? null,
            is_public: isPublic,
            tiers,
        };
        const options = {
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
            onError: (e: Record<string, string>) => setErrors(e),
        };
        if (list) router.put(`/tierlists/${list.id}`, payload, options);
        else router.post('/tierlists', payload, options);
    };

    const drop = (to: number) => (event: React.DragEvent) => {
        event.preventDefault();
        const [from, index] = event.dataTransfer
            .getData('text/plain')
            .split(':')
            .map(Number);
        move(from, index, to);
    };
    const chip = (item: string, from: number, index: number) => (
        <button
            key={`${from}-${index}-${item}`}
            type="button"
            draggable
            onDragStart={(e) =>
                e.dataTransfer.setData('text/plain', `${from}:${index}`)
            }
            onClick={(e) => {
                e.stopPropagation();
                setPicked(
                    picked?.from === from && picked.index === index
                        ? null
                        : { from, index },
                );
            }}
            className={cn(
                'cursor-grab rounded-lg px-2.5 py-1.5 text-sm text-white transition',
                picked?.from === from && picked.index === index
                    ? 'bg-gc-indigo ring-2 ring-white/60'
                    : 'bg-white/[0.08] hover:bg-white/[0.12]',
            )}
        >
            {item}
        </button>
    );

    return (
        <>
            <Head
                title={list ? tr('Змінити тір-лист') : tr('Новий тір-лист')}
            />
            <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={tr('Назва тір-листа')}
                    maxLength={100}
                    className="input-glass h-12 w-full rounded-xl px-4 font-display text-lg text-white placeholder:text-white/30"
                />
                {errors.title && (
                    <p className="text-xs text-rose-300">{errors.title}</p>
                )}

                <div className="glass overflow-hidden rounded-2xl">
                    {tiers.map((tier, i) => (
                        <div
                            key={i}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={drop(i)}
                            onClick={() =>
                                picked && move(picked.from, picked.index, i)
                            }
                            className="flex min-h-16 border-b border-white/[0.06] last:border-0"
                        >
                            <div
                                className={cn(
                                    'flex w-16 shrink-0 flex-col items-center justify-center gap-1 sm:w-20',
                                    TIER_COLORS[tier.color],
                                )}
                            >
                                <input
                                    value={tier.label}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                        setTiers(
                                            tiers.map((t, j) =>
                                                j === i
                                                    ? {
                                                          ...t,
                                                          label: e.target.value,
                                                      }
                                                    : t,
                                            ),
                                        )
                                    }
                                    maxLength={12}
                                    aria-label={tr('Назва рівня')}
                                    className="w-full bg-transparent text-center font-display text-xl font-bold text-black/80 outline-none"
                                />
                                <div
                                    className="flex gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {colors.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            aria-label={c}
                                            onClick={() =>
                                                setTiers(
                                                    tiers.map((t, j) =>
                                                        j === i
                                                            ? { ...t, color: c }
                                                            : t,
                                                    ),
                                                )
                                            }
                                            className={cn(
                                                'size-2 rounded-full ring-1 ring-black/30',
                                                TIER_COLORS[c],
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-1 flex-wrap content-center gap-1.5 p-2">
                                {tier.items.map((item, j) => chip(item, i, j))}
                            </div>
                            {tiers.length > 2 && (
                                <button
                                    type="button"
                                    aria-label={tr('Прибрати рівень')}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPool([...pool, ...tier.items]);
                                        setTiers(
                                            tiers.filter((_, j) => j !== i),
                                        );
                                    }}
                                    className="px-2 text-white/30 hover:text-rose-300"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                {tiers.length < 8 && (
                    <button
                        type="button"
                        onClick={() =>
                            setTiers([
                                ...tiers,
                                { label: 'F', color: 'slate', items: [] },
                            ])
                        }
                        className="inline-flex items-center gap-1.5 text-sm text-gc-lilac-300 hover:text-white"
                    >
                        <Plus className="size-4" />
                        {tr('Ще рівень')}
                    </button>
                )}

                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={drop(-1)}
                    onClick={() =>
                        picked && move(picked.from, picked.index, -1)
                    }
                    className="glass space-y-3 rounded-2xl p-4"
                >
                    <p className="text-sm text-white/55">
                        {tr(
                            'Запас: перетягніть пункт у рівень (на телефоні — торкніться пункту, потім рівня).',
                        )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {pool.map((item, j) => chip(item, -1, j))}
                    </div>
                    <div
                        className="flex gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === 'Enter' &&
                                (e.preventDefault(), addItems())
                            }
                            placeholder={tr(
                                'Додати пункти через кому: Jett, Sage, Omen',
                            )}
                            className="input-glass h-10 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30"
                        />
                        <button
                            type="button"
                            onClick={addItems}
                            className="h-10 rounded-xl bg-white/[0.07] px-4 text-sm font-medium text-white hover:bg-white/[0.11]"
                        >
                            {tr('Додати')}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3 text-sm text-white/75">
                        <Toggle
                            checked={isPublic}
                            onChange={setIsPublic}
                            label={tr('Видно всім')}
                        />
                        {tr('Видно всім')}
                    </label>
                    <button
                        type="button"
                        disabled={busy || title.trim().length < 3}
                        onClick={save}
                        className="btn-glow h-11 rounded-xl px-6 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
                {Object.keys(errors).some((k) => k.startsWith('tiers')) && (
                    <p className="text-xs text-rose-300">
                        {tr(
                            'Перевірте рівні: до 8 рівнів, до 30 пунктів у кожному.',
                        )}
                    </p>
                )}
            </div>
        </>
    );
}

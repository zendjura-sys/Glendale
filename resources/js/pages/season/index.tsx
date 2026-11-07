import { Head, Link, router } from '@inertiajs/react';
import { Clock, Plus, Shirt, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    LevelTrack,
    RewardIcon,
    rewardKind,
} from '@/components/season/level-track';
import type { PassLevel, Reward, Track } from '@/components/season/level-track';
import { Button } from '@/components/ui/button';
import { shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Item = Reward & {
    equippable: boolean;
    equipped: boolean;
    source: string | null;
};

type Props = {
    season: {
        key: string;
        title: string;
        theme: string;
        colors: string[];
        starts_at: string;
        ends_at: string;
    };
    max_level: number;
    points: number;
    level: number;
    into: number;
    need: number;
    plus: boolean;
    levels: PassLevel[];
    inventory: Item[];
};

/** Скільки лишилося до кінця сезону: дні, години, хвилини (оновлюється щохвилини). */
function useCountdown(until: string) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 60_000);

        return () => window.clearInterval(id);
    }, []);
    const left = Math.max(0, new Date(until).getTime() - now);

    return {
        days: Math.floor(left / 86_400_000),
        hours: Math.floor((left % 86_400_000) / 3_600_000),
        minutes: Math.floor((left % 3_600_000) / 60_000),
    };
}

export default function SeasonPass({
    season,
    max_level,
    points,
    level,
    into,
    need,
    plus,
    levels,
    inventory,
}: Props) {
    const [busy, setBusy] = useState<string | null>(null);
    const left = useCountdown(season.ends_at);
    const done = level >= max_level;
    const ready = levels.filter(
        (row) =>
            row.level <= level &&
            ((row.free && !row.free_claimed) ||
                (plus && row.plus && !row.plus_claimed)),
    ).length;

    const claim = (lvl: number, track: Track) => {
        setBusy(`${lvl}:${track}`);
        router.post(
            `/season/levels/${lvl}/${track}/claim`,
            {},
            { preserveScroll: true, onFinish: () => setBusy(null) },
        );
    };

    const equip = (item: Item) => {
        setBusy(`${item.type}:${item.value}`);
        router.post(
            '/season/equip',
            { type: item.type, value: item.equipped ? null : item.value },
            { preserveScroll: true, onFinish: () => setBusy(null) },
        );
    };

    return (
        <>
            <Head title={tr('Сезонний пропуск')} />
            <div className="mx-auto max-w-4xl space-y-5">
                <section
                    className="relative overflow-hidden rounded-xl border border-white/[0.08] p-5 sm:p-7"
                    style={{
                        backgroundImage: `linear-gradient(120deg, ${season.colors.join(', ')})`,
                    }}
                >
                    <span
                        aria-hidden
                        className="pointer-events-none absolute -right-4 -bottom-10 font-display text-[160px] leading-none font-black text-white/[0.07] select-none sm:text-[200px]"
                    >
                        {level}
                    </span>
                    <div className="relative">
                        <p className="text-sm text-white/70">
                            {tr('Сезонний пропуск')}
                        </p>
                        <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">
                            {season.title}
                        </h1>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-white/75">
                            <Clock className="size-4" />
                            {tr('До кінця сезону: {d} дн. {h} год {m} хв', {
                                d: left.days,
                                h: left.hours,
                                m: left.minutes,
                            })}
                        </p>
                        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <div className="font-display text-4xl font-bold text-white tabular-nums">
                                    {tr('Рівень {n}', { n: level })}
                                    <span className="text-lg text-white/55">
                                        {' '}
                                        / {max_level}
                                    </span>
                                </div>
                                <div className="text-sm text-white/70">
                                    {tr('{n} очок сезону', {
                                        n: shortNumber(points),
                                    })}
                                </div>
                            </div>
                            {ready > 0 && (
                                <span className="rounded-chip bg-white/15 px-3 py-1 text-sm font-semibold text-white">
                                    {tr('Можна забрати: {n}', { n: ready })}
                                </span>
                            )}
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
                            <div
                                className="h-full rounded-full bg-white"
                                style={{
                                    width: `${done ? 100 : need > 0 ? (into / need) * 100 : 0}%`,
                                }}
                            />
                        </div>
                        <p className="mt-1.5 text-xs text-white/65">
                            {done
                                ? tr('Усі рівні сезону пройдено.')
                                : tr('До рівня {n}: {have} / {need}', {
                                      n: level + 1,
                                      have: into,
                                      need,
                                  })}
                        </p>
                    </div>
                </section>

                <section className="glass rounded-xl p-4 sm:p-5">
                    <LevelTrack
                        levels={levels}
                        level={level}
                        plus={plus}
                        onClaim={claim}
                        busy={busy}
                    />
                    {!plus && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 px-4 py-3">
                            <span className="text-sm text-white/80">
                                {tr(
                                    'Нижня доріжка відкривається з GameCon+ — разом з усіма вже пройденими рівнями.',
                                )}
                            </span>
                            <Button asChild size="sm">
                                <Link href="/plus">
                                    <Plus className="size-4" strokeWidth={3} />
                                    GameCon+
                                </Link>
                            </Button>
                        </div>
                    )}
                </section>

                <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
                    <section className="glass rounded-xl p-4 sm:p-5">
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <Target className="size-5 text-primary" />
                            {tr('Як заробляти очки')}
                        </h2>
                        <p className="mt-2 text-sm text-white/65">
                            {tr(
                                'Очки сезону дають щоденні завдання: щодня три нові, кожне — від 10 до 25 очок. Очки рахуються лише в цьому місяці.',
                            )}
                        </p>
                        <Button asChild variant="secondary" className="mt-4">
                            <Link href="/quests">{tr('Завдання дня')}</Link>
                        </Button>
                    </section>

                    <section className="glass rounded-xl p-4 sm:p-5">
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <Shirt className="size-5 text-primary" />
                            {tr('Інвентар')}
                        </h2>
                        {inventory.length === 0 ? (
                            <p className="mt-2 text-sm text-white/55">
                                {tr(
                                    'Тут з’являться нагороди, які ви заберете з доріжки.',
                                )}
                            </p>
                        ) : (
                            <ul className="mt-3 space-y-1.5">
                                {inventory.map((item) => (
                                    <li
                                        key={`${item.type}:${item.value}`}
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl px-2 py-1.5',
                                            item.equipped && 'bg-primary/10',
                                        )}
                                    >
                                        <RewardIcon reward={item} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-white">
                                                {item.name}
                                            </div>
                                            <div className="text-xs text-white/45">
                                                {rewardKind(item.type)}
                                            </div>
                                        </div>
                                        {item.equippable ? (
                                            <Button
                                                size="sm"
                                                variant={
                                                    item.equipped
                                                        ? 'outline'
                                                        : 'secondary'
                                                }
                                                disabled={
                                                    busy ===
                                                    `${item.type}:${item.value}`
                                                }
                                                onClick={() => equip(item)}
                                            >
                                                {item.equipped
                                                    ? tr('Зняти')
                                                    : tr('Вдягнути')}
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-white/45">
                                                {tr('Діє одразу')}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}

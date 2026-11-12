import { Head, Link } from '@inertiajs/react';
import { Check, Lock, Trophy } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { RewardIcon } from '@/components/season/level-track';
import type { Reward } from '@/components/season/level-track';
import { Button } from '@/components/ui/button';
import { shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Props = {
    level: number;
    title: string;
    xp: number;
    level_xp: number;
    next_xp: number;
    sources: { key: string; count: number; per: number; xp: number }[];
    titles: { from: number; name: string; xp: number }[];
    rewards: { level: number; reward: Reward | null; reached: boolean }[];
    earned: number;
    total: number;
};

/** Звідки досвід: назва джерела. */
function sourceLabel(key: string): string {
    switch (key) {
        case 'posts':
            return tr('Записи');
        case 'comments':
            return tr('Коментарі');
        case 'likes':
            return tr('Вподобання ваших записів');
        case 'friends':
            return tr('Друзі');
        case 'days':
            return tr('Дні з GameCon');
        case 'photos':
            return tr('Фото');
        case 'tracks':
            return tr('Завантажені треки');
        case 'stories':
            return tr('Сторіс');
        case 'events':
            return tr('Події сім’ї');
        case 'parties':
            return tr('Спільні перегляди й прослуховування');
        case 'votes':
            return tr('Голоси за сервери');
        case 'quest_xp':
            return tr('Завдання дня');
        case 'pass_xp':
            return tr('Сезонний пропуск');
        case 'referrals':
            return tr('Запрошені друзі');
        default:
            return key;
    }
}

export default function LevelPage({
    level,
    title,
    xp,
    level_xp,
    next_xp,
    sources,
    titles,
    rewards,
    earned,
    total,
}: Props) {
    const reduce = useReducedMotion();
    const span = Math.max(1, next_xp - level_xp);
    const into = Math.max(0, xp - level_xp);
    const pct = Math.min(100, (into / span) * 100);
    const ordered = [...sources].sort((a, b) => b.xp - a.xp);
    const top = Math.max(1, ...ordered.map((s) => s.xp));

    return (
        <>
            <Head title={tr('Рівень профілю')} />
            <div className="mx-auto max-w-4xl space-y-5">
                <section className="gc-solid flex flex-wrap items-center gap-5 rounded-xl p-5 sm:p-6">
                    <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full bg-amber-400/10">
                        <svg
                            viewBox="0 0 100 100"
                            className="absolute inset-0 size-full -rotate-90"
                            aria-hidden
                        >
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                strokeWidth="6"
                                className="stroke-white/10"
                            />
                            <m.circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                strokeWidth="6"
                                strokeLinecap="round"
                                className="stroke-amber-400"
                                strokeDasharray={2 * Math.PI * 45}
                                initial={
                                    reduce
                                        ? false
                                        : { strokeDashoffset: 2 * Math.PI * 45 }
                                }
                                animate={{
                                    strokeDashoffset:
                                        2 * Math.PI * 45 * (1 - pct / 100),
                                }}
                                transition={motionOr(reduce, {
                                    duration: 1,
                                    ease: 'easeOut',
                                })}
                            />
                        </svg>
                        <span className="font-display text-3xl font-black text-white tabular-nums">
                            {level}
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/60">
                            {tr('Рівень профілю')}
                        </p>
                        <h1 className="font-display text-3xl font-bold text-white">
                            {tr(title)}
                        </h1>
                        <p className="mt-1 text-sm text-white/65">
                            {tr('{xp} досвіду · до рівня {n}: ще {left}', {
                                xp: shortNumber(xp),
                                n: level + 1,
                                left: shortNumber(Math.max(0, next_xp - xp)),
                            })}
                        </p>
                        <p className="mt-1 text-sm text-white/50">
                            {tr('Досягнень: {earned} з {total}', {
                                earned,
                                total,
                            })}
                        </p>
                    </div>
                    <Button asChild variant="secondary">
                        <Link href="/quests">{tr('Завдання дня')}</Link>
                    </Button>
                </section>

                <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
                    <section className="gc-solid rounded-xl p-4 sm:p-5">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Звідки досвід')}
                        </h2>
                        <ul className="mt-3 space-y-2.5">
                            {ordered.map((s) => (
                                <li key={s.key}>
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="text-white">
                                            {sourceLabel(s.key)}
                                        </span>
                                        <span className="text-white/60 tabular-nums">
                                            {s.per === 1
                                                ? shortNumber(s.xp)
                                                : tr('{n} × {per} = {xp}', {
                                                      n: shortNumber(s.count),
                                                      per: s.per,
                                                      xp: shortNumber(s.xp),
                                                  })}
                                        </span>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${(s.xp / top) * 100}%`,
                                            }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="space-y-5">
                        <section className="gc-solid rounded-xl p-4 sm:p-5">
                            <h2 className="font-display text-lg font-bold text-white">
                                {tr('Назви рівнів')}
                            </h2>
                            <ol className="mt-3 space-y-1">
                                {titles.map((t, i) => {
                                    const next = titles[i + 1];
                                    const current =
                                        level >= t.from &&
                                        (!next || level < next.from);

                                    return (
                                        <li
                                            key={t.from}
                                            className={cn(
                                                'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                                                current
                                                    ? 'bg-amber-400/15 text-white'
                                                    : level >= t.from
                                                      ? 'text-white/80'
                                                      : 'text-white/45',
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                {current && (
                                                    <Trophy className="size-4 text-amber-400" />
                                                )}
                                                {tr(t.name)}
                                            </span>
                                            <span className="tabular-nums">
                                                {tr('з рівня {n}', {
                                                    n: t.from,
                                                })}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>

                        <section className="gc-solid rounded-xl p-4 sm:p-5">
                            <h2 className="font-display text-lg font-bold text-white">
                                {tr('Нагороди за рівні')}
                            </h2>
                            <ul className="mt-3 space-y-2">
                                {rewards.map(
                                    (r) =>
                                        r.reward && (
                                            <li
                                                key={r.level}
                                                className="flex items-center gap-3"
                                            >
                                                <RewardIcon reward={r.reward} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-semibold text-white">
                                                        {r.reward.name}
                                                    </div>
                                                    <div className="text-xs text-white/50">
                                                        {tr('Рівень {n}', {
                                                            n: r.level,
                                                        })}
                                                    </div>
                                                </div>
                                                {r.reached ? (
                                                    <Check className="size-5 text-emerald-400" />
                                                ) : (
                                                    <Lock className="size-4 text-white/35" />
                                                )}
                                            </li>
                                        ),
                                )}
                            </ul>
                            <p className="mt-3 text-xs text-white/45">
                                {tr(
                                    'Нагороди самі лягають в інвентар — вдягнути можна на сторінці сезонного пропуску.',
                                )}
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}

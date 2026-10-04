import {
    Award,
    BadgeCheck,
    Cake,
    CalendarCheck,
    CalendarDays,
    Camera,
    CirclePlay,
    Clapperboard,
    Crown,
    Heart,
    House,
    Lock,
    Music,
    Newspaper,
    PartyPopper,
    PenLine,
    Rocket,
    Star,
    Swords,
    UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export type Badge = {
    key: string;
    title: string;
    text: string;
    icon: string;
    earned: boolean;
    progress: number;
    target: number;
};

export type AchievementsData = {
    level: number;
    title: string;
    xp: number;
    level_xp: number;
    next_xp: number;
    earned: number;
    total: number;
    badges: Badge[];
};

const ICONS: Record<string, LucideIcon> = {
    'pen-line': PenLine,
    newspaper: Newspaper,
    'users-round': UsersRound,
    'party-popper': PartyPopper,
    heart: Heart,
    star: Star,
    'calendar-check': CalendarCheck,
    cake: Cake,
    house: House,
    crown: Crown,
    'calendar-days': CalendarDays,
    swords: Swords,
    music: Music,
    camera: Camera,
    'circle-play': CirclePlay,
    clapperboard: Clapperboard,
    'badge-check': BadgeCheck,
    rocket: Rocket,
};

/** Рівень (досвід до наступного) і бейджі за активність у профілі. */
export function AchievementsCard({
    data,
    isSelf,
}: {
    data: AchievementsData;
    isSelf: boolean;
}) {
    const [all, setAll] = useState(false);
    const span = Math.max(1, data.next_xp - data.level_xp);
    const percent = Math.min(100, ((data.xp - data.level_xp) / span) * 100);
    const shown = all ? data.badges : data.badges.filter((b) => b.earned);

    return (
        <section className="glass rounded-3xl p-4">
            <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-brand text-white">
                    <span className="text-[9px] leading-none font-semibold uppercase opacity-80">
                        {tr('рів.')}
                    </span>
                    <span className="text-lg leading-tight font-bold">
                        {data.level}
                    </span>
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <Award className="size-4 text-amber-300" /> {data.title}
                    </p>
                    <div
                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                        role="progressbar"
                        aria-valuenow={Math.round(percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="h-full rounded-full bg-gradient-brand transition-[width] duration-500"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <p className="mt-1 text-[11px] text-white/45">
                        {data.xp} / {data.next_xp} {tr('досвіду до рівня')}{' '}
                        {data.level + 1}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80">
                    {tr('Досягнення')}{' '}
                    <span className="text-white/40">
                        {data.earned}/{data.total}
                    </span>
                </h3>
                <button
                    type="button"
                    onClick={() => setAll(!all)}
                    className="text-xs text-[#a5b4fc] hover:text-white"
                >
                    {all ? tr('Лише отримані') : tr('Усі')}
                </button>
            </div>
            {shown.length === 0 ? (
                <p className="mt-2 text-sm text-white/45">
                    {isSelf
                        ? tr('Перші бейджі — за пост, друзів і вступ до сім’ї.')
                        : tr('Бейджів поки немає.')}
                </p>
            ) : (
                <div className="mt-2 grid grid-cols-4 gap-2">
                    {shown.map((b) => {
                        const Icon = ICONS[b.icon] ?? Award;

                        return (
                            <div
                                key={b.key}
                                title={`${b.title} — ${b.text}${b.earned ? '' : ` (${b.progress}/${b.target})`}`}
                                className="flex flex-col items-center gap-1 text-center"
                            >
                                <span
                                    className={cn(
                                        'relative flex size-11 items-center justify-center rounded-2xl',
                                        b.earned
                                            ? 'bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/40'
                                            : 'bg-white/[0.04] text-white/25',
                                    )}
                                >
                                    <Icon className="size-5" />
                                    {!b.earned && (
                                        <Lock className="absolute -right-1 -bottom-1 size-3.5 text-white/40" />
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        'line-clamp-2 text-[10.5px] leading-tight',
                                        b.earned
                                            ? 'text-white/75'
                                            : 'text-white/35',
                                    )}
                                >
                                    {b.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

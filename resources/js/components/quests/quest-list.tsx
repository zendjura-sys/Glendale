import { Link, router } from '@inertiajs/react';
import {
    Check,
    CirclePlay,
    Clapperboard,
    Heart,
    Image,
    MessageCircle,
    PenLine,
    Target,
    UserPlus,
    UserRoundSearch,
    Vote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { PlusBadge } from '@/components/gc/plus';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Quest = {
    key: string;
    title: string;
    icon: string;
    target: number;
    progress: number;
    xp: number;
    done: boolean;
    claimed: boolean;
    /** GameCon+: досвід без очок сезону. */
    bonus?: boolean;
};

const ICONS: Record<string, LucideIcon> = {
    'pen-line': PenLine,
    'message-circle': MessageCircle,
    heart: Heart,
    vote: Vote,
    clapperboard: Clapperboard,
    'user-round-search': UserRoundSearch,
    'user-plus': UserPlus,
    image: Image,
    'circle-play': CirclePlay,
};

/** Назви завдань — так само, як DailyQuests::POOL. */
const TITLES = (): Record<string, string> => ({
    post: tr('Опублікуйте запис'),
    comment: tr('Залиште 3 коментарі'),
    like: tr('Вподобайте 5 записів'),
    vote: tr('Проголосуйте за сервер'),
    moment: tr('Поділіться моментом'),
    party: tr('Створіть паті або приєднайтеся до неї'),
    friend: tr('Додайте друга'),
    photo: tr('Завантажте фото'),
    story: tr('Опублікуйте сторіс'),
});

/** Куди йти, щоб виконати завдання. */
const LINKS: Record<string, string> = {
    post: '/feed',
    comment: '/feed',
    like: '/feed',
    vote: '/servers',
    moment: '/moments',
    party: '/party',
    friend: '/people',
    photo: '/photos',
    story: '/feed',
};

export function QuestList({ quests }: { quests: Quest[] }) {
    const [busy, setBusy] = useState<string | null>(null);

    return (
        <ul className="divide-y divide-white/[0.06]">
            {quests.map((quest) => {
                const Icon = ICONS[quest.icon] ?? Target;
                const percent = Math.round(
                    (quest.progress / quest.target) * 100,
                );

                return (
                    <li
                        key={quest.key}
                        className="flex items-center gap-3 px-1 py-3 transition first:pt-1 last:pb-1"
                    >
                        <span
                            className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                                quest.claimed
                                    ? 'bg-emerald-400/15 text-emerald-200'
                                    : 'bg-primary/12 text-gc-lilac-400',
                            )}
                        >
                            <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <Link
                                href={LINKS[quest.key] ?? '/feed'}
                                className="block text-sm font-medium break-words text-white hover:underline"
                            >
                                {TITLES()[quest.key] ?? quest.title}
                            </Link>
                            {quest.bonus && (
                                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-indigo-200/80">
                                    <PlusBadge className="size-3 rounded-[4px] [&_svg]:size-2.5" />
                                    {tr('Бонус GameCon+ · без очок сезону')}
                                </span>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                                <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <span
                                        className={cn(
                                            'block h-full rounded-full transition-all',
                                            quest.done
                                                ? 'bg-emerald-400'
                                                : 'bg-primary',
                                        )}
                                        style={{ width: `${percent}%` }}
                                    />
                                </span>
                                <span className="shrink-0 text-xs text-white/45 tabular-nums">
                                    {quest.progress}/{quest.target}
                                </span>
                            </div>
                        </div>
                        {quest.claimed ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-200">
                                <Check className="size-4" />+{quest.xp}
                            </span>
                        ) : quest.done ? (
                            <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() =>
                                    router.post(
                                        `/quests/${quest.key}/claim`,
                                        {},
                                        {
                                            preserveScroll: true,
                                            onStart: () => setBusy(quest.key),
                                            onFinish: () => setBusy(null),
                                        },
                                    )
                                }
                                className="btn-glow h-9 shrink-0 rounded-xl px-3 text-xs font-semibold disabled:opacity-50"
                            >
                                {tr('Забрати +{xp}', { xp: quest.xp })}
                            </button>
                        ) : (
                            <span className="shrink-0 text-xs font-medium text-white/50 tabular-nums">
                                +{quest.xp} XP
                            </span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

/** Картка в стрічці: завдання дня. */
export function FeedQuests({ quests }: { quests: Quest[] }) {
    if (quests.every((q) => q.claimed)) return null;

    return (
        <section className="glass rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-2 font-display text-[13px] font-semibold text-white/90">
                    <Target className="size-4 text-gc-lilac-400" />
                    {tr('Завдання дня')}
                </h2>
                <Link
                    href="/quests"
                    className="text-xs font-medium text-white/45 hover:text-white"
                >
                    {tr('Сезон')}
                </Link>
            </div>
            <QuestList quests={quests} />
        </section>
    );
}

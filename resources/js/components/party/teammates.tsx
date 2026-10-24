import { Link, router } from '@inertiajs/react';
import { MessageCircle, Mic, Radar, UserPlus } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

export type MatchReason =
    | { type: 'game'; name: string }
    | { type: 'time'; times: string[] }
    | {
          type:
              | 'language'
              | 'skill_same'
              | 'skill_near'
              | 'platform'
              | 'mic'
              | 'looking';
      };

export type TeammateMatch = {
    user: UserCard;
    score: number;
    reasons: MatchReason[];
    games: string[];
    skill: string | null;
    platform: string | null;
    mic: boolean;
    note: string | null;
    looking: boolean;
    friend: boolean;
};

export const TIME_LABELS: Record<string, string> = {
    morning: tr('Вранці'),
    day: tr('Вдень'),
    evening: tr('Ввечері'),
    night: tr('Вночі'),
    weekend: tr('На вихідних'),
};

export const SKILL_LABELS: Record<string, string> = {
    new: tr('Новачок'),
    casual: tr('Для душі'),
    mid: tr('Впевнено'),
    pro: tr('Профі'),
};

export const LANGUAGE_LABELS: Record<string, string> = {
    uk: 'Українська',
    en: 'English',
    pl: 'Polski',
    de: 'Deutsch',
};

export function reasonLabel(reason: MatchReason): string {
    switch (reason.type) {
        case 'game':
            return tr('Обидва граєте в {game}', { game: reason.name });
        case 'time':
            return tr('Граєте: {when}', {
                when: reason.times
                    .map((time) => TIME_LABELS[time] ?? time)
                    .join(', ')
                    .toLowerCase(),
            });
        case 'language':
            return tr('Спільна мова');
        case 'skill_same':
            return tr('Однаковий рівень');
        case 'skill_near':
            return tr('Схожий рівень');
        case 'platform':
            return tr('Та сама платформа');
        case 'mic':
            return tr('Обидва з мікрофоном');
        case 'looking':
            return tr('Шукає зараз');
    }
}

/** Сумісний гравець: відсоток, «чому підходить», написати й покликати в паті. */
export function MatchRow({
    match,
    parties,
    party,
}: {
    match: TeammateMatch;
    parties: { id: number; title: string }[];
    party?: number;
}) {
    const invite = (id: number) =>
        router.post(
            `/party/${id}/invite`,
            { user_id: match.user.id },
            { preserveScroll: true },
        );

    return (
        <div className="flex gap-3 py-3.5">
            <Link href={`/${match.user.username}`} className="shrink-0">
                <UserAvatar user={match.user} size="lg" />
            </Link>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                        href={`/${match.user.username}`}
                        className="truncate font-semibold text-white hover:underline"
                    >
                        {match.user.name}
                    </Link>
                    {match.looking && (
                        <span className="inline-flex items-center gap-1 rounded-chip bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Radar className="size-3" />
                            {tr('Шукає зараз')}
                        </span>
                    )}
                    {match.friend && (
                        <span className="rounded-chip bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                            {tr('Друг')}
                        </span>
                    )}
                </div>
                <p className="mt-0.5 text-xs break-words text-white/50">
                    {[
                        match.games.slice(0, 3).join(', '),
                        match.skill ? SKILL_LABELS[match.skill] : null,
                        match.mic ? tr('з мікрофоном') : null,
                    ]
                        .filter(Boolean)
                        .join(' · ')}
                    {match.mic && <Mic className="ml-1 inline size-3" />}
                </p>
                {match.note && (
                    <p className="mt-1 line-clamp-2 text-sm text-white/70">
                        {match.note}
                    </p>
                )}
                {match.reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {match.reasons.slice(0, 4).map((reason, i) => (
                            <span
                                key={i}
                                className="rounded-chip bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/70"
                            >
                                {reasonLabel(reason)}
                            </span>
                        ))}
                    </div>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link
                        href={`/messages/with/${match.user.username}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-control bg-white/[0.06] px-3 text-xs font-medium text-white hover:bg-white/10"
                    >
                        <MessageCircle className="size-3.5" />
                        {tr('Написати')}
                    </Link>
                    {party !== undefined ? (
                        <button
                            type="button"
                            onClick={() => invite(party)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary/15 px-3 text-xs font-semibold text-primary hover:bg-primary/25"
                        >
                            <UserPlus className="size-3.5" />
                            {tr('Покликати в паті')}
                        </button>
                    ) : (
                        parties.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary/15 px-3 text-xs font-semibold text-primary hover:bg-primary/25"
                                    >
                                        <UserPlus className="size-3.5" />
                                        {tr('Покликати в паті')}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {parties.map((item) => (
                                        <DropdownMenuItem
                                            key={item.id}
                                            onSelect={() => invite(item.id)}
                                        >
                                            {item.title}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    )}
                </div>
            </div>
            <div
                className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-full font-display text-sm font-bold tabular-nums ring-2',
                    match.score >= 70
                        ? 'text-primary ring-primary/50'
                        : match.score >= 40
                          ? 'text-white ring-white/25'
                          : 'text-white/55 ring-white/10',
                )}
                title={tr('Сумісність')}
            >
                {match.score}%
            </div>
        </div>
    );
}

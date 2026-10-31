import { Link, usePage } from '@inertiajs/react';
import { Flame, History } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';

/** Серія днів поспіль і «Цього дня» — одна тонка картка над стрічкою. */
export function EngagementCard() {
    const engagement = usePage().props.engagement;
    const streak = engagement?.streak;
    const memories = engagement?.memories ?? 0;

    if ((!streak || streak.days < 2) && memories === 0) return null;

    return (
        <div className="glass flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-3 text-sm">
            {streak && streak.days >= 2 && (
                <span className="flex items-center gap-2 text-white/85">
                    <Flame className="size-4 text-orange-400" />
                    {tr('{days} {word} поспіль на GameCon', {
                        days: streak.days,
                        word: plural(streak.days, [
                            tr('день'),
                            tr('дні'),
                            tr('днів'),
                        ]),
                    })}
                    {streak.best > streak.days && (
                        <span className="text-xs text-white/40">
                            {tr('рекорд {best}', { best: streak.best })}
                        </span>
                    )}
                </span>
            )}
            {memories > 0 && (
                <Link
                    href="/memories"
                    className="flex items-center gap-2 text-sky-300 hover:text-sky-200"
                >
                    <History className="size-4" />
                    {tr('Цього дня: {count} {word} з минулих років', {
                        count: memories,
                        word: plural(memories, [
                            tr('запис'),
                            tr('записи'),
                            tr('записів'),
                        ]),
                    })}
                </Link>
            )}
        </div>
    );
}

const SEASON_NAMES: Record<string, () => string> = {
    newyear: () => tr('Новий рік'),
    valentine: () => tr('День закоханих'),
    easter: () => tr('Великдень'),
    independence: () => tr('День Незалежності'),
    halloween: () => tr('Хелловін'),
};

/** Перемикач рамки свята в налаштуваннях вигляду (видно лише під час свята). */
export function EventFrameSwitch() {
    const frame = usePage().props.engagement?.frame;
    const [on, setOn] = useState(frame?.on ?? false);

    if (!frame) return null;
    const season = SEASON_NAMES[frame.season]?.() ?? frame.season;

    const toggle = (next: boolean) => {
        setOn(next);
        api('PUT', '/settings/event-frame', { on: next }).catch((e) => {
            setOn(!next);
            toast.error((e as Error).message);
        });
    };

    return (
        <SettingsSwitch
            label={tr('Рамка свята на аватарі')}
            hint={tr('{season}: святкова рамка, поки триває свято', {
                season,
            })}
            checked={on}
            onChange={toggle}
        />
    );
}

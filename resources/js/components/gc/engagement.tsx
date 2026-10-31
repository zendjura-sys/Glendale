import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronUp,
    Flame,
    History,
    SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsSwitch } from '@/layouts/settings/layout';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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

const WIDGET_LABELS: Record<string, () => string> = {
    streak: () => tr('Серія днів і «Цього дня»'),
    ready: () => tr('Готовий грати'),
    online: () => tr('Зараз онлайн'),
    suggestions: () => tr('Можливо, ви знайомі'),
    birthdays: () => tr('Дні народження'),
};

/** Налаштування віджетів біля стрічки: увімкнути, вимкнути, змінити порядок (зберігається для сайту й застосунку). */
export function HomeWidgetsEditor({ widgets }: { widgets: string[] }) {
    const [open, setOpen] = useState(false);
    const [list, setList] = useState<string[]>(widgets);
    const all = Object.keys(WIDGET_LABELS);
    const ordered = [...list, ...all.filter((k) => !list.includes(k))];

    const save = (next: string[]) => {
        setList(next);
        api('PUT', '/settings/home-widgets', { widgets: next })
            .then(() => router.reload({ only: ['engagement'] }))
            .catch((e) => toast.error((e as Error).message));
    };

    const move = (key: string, dir: -1 | 1) => {
        const i = list.indexOf(key);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        save(next);
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs text-white/40 hover:text-white/70"
            >
                <SlidersHorizontal className="size-3.5" />
                {tr('Налаштувати віджети')}
            </button>
        );
    }

    return (
        <div className="glass space-y-1 rounded-2xl p-3">
            <p className="mb-2 text-sm font-semibold text-white">
                {tr('Віджети біля стрічки')}
            </p>
            {ordered.map((key) => {
                const on = list.includes(key);

                return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                                save(
                                    e.target.checked
                                        ? [...list, key]
                                        : list.filter((k) => k !== key),
                                )
                            }
                            aria-label={WIDGET_LABELS[key]()}
                            className="size-4"
                        />
                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate',
                                on ? 'text-white/85' : 'text-white/40',
                            )}
                        >
                            {WIDGET_LABELS[key]()}
                        </span>
                        {on && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => move(key, -1)}
                                    aria-label={tr('Вище')}
                                    className="rounded p-1 text-white/45 hover:text-white"
                                >
                                    <ChevronUp className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => move(key, 1)}
                                    aria-label={tr('Нижче')}
                                    className="rounded p-1 text-white/45 hover:text-white"
                                >
                                    <ChevronDown className="size-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                );
            })}
            <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2 h-8 w-full rounded-lg bg-white/[0.07] text-xs text-white hover:bg-white/[0.12]"
            >
                {tr('Готово')}
            </button>
        </div>
    );
}

import { Flame, Heart, Trophy } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { MomentCard } from './moment-card';
import type { MomentCardData } from './moment-card';

type Entry = { week: string; likes: number; moment: MomentCardData };

export type ClipOfWeekData = {
    winner: Entry | null;
    leader: { likes: number; moment: MomentCardData } | null;
    history: Entry[];
};

/** «з 20 жовтня» — понеділок, з якого рахувався тиждень. */
function weekLabel(week: string): string {
    const locale = document.documentElement.lang || 'uk';

    return tr('Тиждень з {date}', {
        date: new Date(`${week}T12:00:00`).toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
        }),
    });
}

/**
 * «Кліп тижня» на сторінці «Моменти»: переможець минулого тижня, хто лідирує зараз
 * (вподобання, отримані з понеділка) і архів минулих переможців.
 */
export function ClipOfWeekSection({ data }: { data: ClipOfWeekData }) {
    const { winner, leader, history } = data;

    return (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {winner ? (
                <div className="glass rounded-2xl p-4">
                    <header className="mb-3 flex items-center gap-2 px-1">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                            <Trophy className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block font-display text-base font-semibold text-white">
                                {tr('Кліп тижня')}
                            </span>
                            <span className="block text-xs text-white/50">
                                {weekLabel(winner.week)} ·{' '}
                                {tr('{n} вподобань за тиждень', {
                                    n: winner.likes,
                                })}
                            </span>
                        </span>
                    </header>
                    <MomentCard moment={winner.moment} />
                </div>
            ) : (
                leader && (
                    <div className="glass flex items-center gap-3 rounded-2xl p-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                            <Trophy className="size-5" />
                        </span>
                        <p className="text-sm text-white/65">
                            {tr(
                                'Перший «Кліп тижня» оберемо в понеділок — кліп із найбільшою кількістю вподобань за тиждень.',
                            )}
                        </p>
                    </div>
                )
            )}

            <div className="space-y-4">
                {leader && (
                    <div className="glass rounded-2xl p-4">
                        <header className="mb-3 flex items-center gap-2 px-1">
                            <Flame className="size-4 text-orange-300" />
                            <span className="flex-1 font-display text-[13px] font-semibold text-white/90">
                                {tr('Лідер цього тижня')}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-white/55 tabular-nums">
                                <Heart className="size-3.5 text-rose-300" />
                                {leader.likes}
                            </span>
                        </header>
                        <MomentCard moment={leader.moment} />
                    </div>
                )}

                {history.length > 0 && (
                    <div className="glass rounded-2xl p-4">
                        <h3 className="mb-2 px-1 font-display text-[13px] font-semibold text-white/90">
                            {tr('Минулі переможці')}
                        </h3>
                        <ul className="space-y-1">
                            {history.map((h) => (
                                <li key={h.week}>
                                    <a
                                        href={h.moment.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.05]"
                                    >
                                        <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                                            {h.moment.thumbnail && (
                                                <img
                                                    src={h.moment.thumbnail}
                                                    alt=""
                                                    loading="lazy"
                                                    className="size-full object-cover"
                                                />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-white">
                                                {h.moment.title}
                                            </span>
                                            <span className="block truncate text-xs text-white/45">
                                                {h.moment.user.first_name} ·{' '}
                                                {weekLabel(h.week)}
                                            </span>
                                        </span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
}

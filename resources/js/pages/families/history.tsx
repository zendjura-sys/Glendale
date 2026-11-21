import { Award, Flag, History, Lock, Swords, Trophy } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { FamilyShell } from '@/components/families/family-shell';
import { Panel } from '@/components/families/ui';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FamilyShellProps } from '@/types';

type Props = FamilyShellProps & {
    events: { at: string; kind: string; text: string }[];
    achievements: {
        key: string;
        title: string;
        progress: number;
        target: number;
        done: boolean;
    }[];
    totals: { reports: number; wins: number; contracts: number; days: number };
};

/** Історія сім’ї: досягнення й віхи — від створення до сезонів, союзів і воєн. */
export default function FamilyHistory(props: Props) {
    const { events, achievements, totals } = props;
    const reduce = useReducedMotion();

    return (
        <FamilyShell {...props} title={tr('Історія')}>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Panel
                    title={tr('Досягнення')}
                    icon={Trophy}
                    tone="text-amber-300"
                >
                    <p className="mb-3 text-xs text-white/50">
                        {tr(
                            '{days} днів разом · {reports} схвалених звітів · {wins} перемог у бізварах · {contracts} контрактів',
                            totals,
                        )}
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2" data-achievements>
                        {achievements.map((a) => (
                            <li
                                key={a.key}
                                className={cn(
                                    'gc-solid-2 rounded-xl p-3',
                                    !a.done && 'opacity-70',
                                )}
                            >
                                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                                    {a.done ? (
                                        <Award className="size-4 text-amber-300" />
                                    ) : (
                                        <Lock className="size-4 text-white/40" />
                                    )}
                                    {tr(a.title)}
                                </p>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                                    <motion.div
                                        initial={reduce ? false : { width: 0 }}
                                        animate={{
                                            width: `${Math.min(100, (a.progress / a.target) * 100)}%`,
                                        }}
                                        className={cn(
                                            'h-full rounded-full',
                                            a.done
                                                ? 'bg-amber-400'
                                                : 'bg-primary',
                                        )}
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-white/45 tabular-nums">
                                    {Math.min(a.progress, a.target)} /{' '}
                                    {a.target}
                                </p>
                            </li>
                        ))}
                    </ul>
                </Panel>
                <Panel title={tr('Шкала часу')} icon={History}>
                    <ol
                        className="relative space-y-4 border-l border-white/10 pl-5"
                        data-timeline
                    >
                        {events.map((e, i) => (
                            <li key={i} className="relative">
                                <span className="absolute -left-[27px] flex size-5 items-center justify-center rounded-full bg-[var(--gc-l2)] text-primary">
                                    {e.kind === 'war' ? (
                                        <Swords className="size-3" />
                                    ) : (
                                        <Flag className="size-3" />
                                    )}
                                </span>
                                <p className="text-sm text-white/85">
                                    {tr(e.text)}
                                </p>
                                <time className="text-xs text-white/40">
                                    {formatDate(e.at)}
                                </time>
                            </li>
                        ))}
                    </ol>
                </Panel>
            </div>
        </FamilyShell>
    );
}

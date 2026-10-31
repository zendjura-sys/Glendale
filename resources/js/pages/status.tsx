import { Head } from '@inertiajs/react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import {
    componentLabel,
    healthDot,
    healthLabel,
    incidentStatusLabel,
    overallLabel,
} from '@/components/status/labels';
import type {
    Component,
    HealthStatus,
    Incident,
} from '@/components/status/labels';
import { clockTime, formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    overall: HealthStatus;
    components: Component[];
    active: Incident[];
    history: Incident[];
    checked_at: string;
};

/** Відкрита сторінка статусу: загальний стан, складники, активні інциденти й історія за 30 днів. */
export default function StatusPage({
    overall,
    components,
    active,
    history,
    checked_at,
}: Props) {
    const reduce = useReducedMotion();
    const appear = (i: number) =>
        reduce
            ? {}
            : {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: i * 0.04, duration: 0.3 },
              };

    return (
        <>
            <Head title={tr('Статус')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <m.section
                    {...appear(0)}
                    className="glass flex items-center gap-4 rounded-2xl p-5 sm:p-6"
                >
                    {overall === 'operational' ? (
                        <CircleCheck
                            aria-hidden
                            className="size-9 shrink-0 text-emerald-400"
                        />
                    ) : (
                        <TriangleAlert
                            aria-hidden
                            className={cn(
                                'size-9 shrink-0',
                                overall === 'down'
                                    ? 'text-red-400'
                                    : 'text-amber-300',
                            )}
                        />
                    )}
                    <div className="min-w-0">
                        <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                            {overallLabel(overall)}
                        </h1>
                        <p className="mt-1 text-sm text-white/45">
                            {tr('Перевірено о {time}', {
                                time: clockTime(checked_at),
                            })}
                        </p>
                    </div>
                </m.section>

                {active.map((incident, i) => (
                    <m.div key={incident.id} {...appear(i + 1)}>
                        <IncidentCard incident={incident} />
                    </m.div>
                ))}

                <m.section {...appear(2)} className="glass rounded-2xl p-2">
                    {components.map((c) => (
                        <div
                            key={c.key}
                            className="flex items-center gap-3 rounded-xl px-3 py-3"
                        >
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    healthDot[c.status],
                                )}
                            />
                            <span className="min-w-0 flex-1 text-sm text-white/85">
                                {componentLabel(c.key)}
                            </span>
                            <span className="text-xs text-white/45">
                                {healthLabel(c.status)}
                            </span>
                        </div>
                    ))}
                </m.section>

                <section className="space-y-3">
                    <h2 className="px-1 font-display text-sm font-semibold text-white/70">
                        {tr('Останні 30 днів')}
                    </h2>
                    {history.length === 0 ? (
                        <p className="glass rounded-2xl p-5 text-sm text-white/50">
                            {tr('Жодного збою за цей час.')}
                        </p>
                    ) : (
                        history.map((incident) => (
                            <IncidentCard
                                key={incident.id}
                                incident={incident}
                                compact
                            />
                        ))
                    )}
                </section>
            </div>
        </>
    );
}

function IncidentCard({
    incident,
    compact = false,
}: {
    incident: Incident;
    compact?: boolean;
}) {
    const updates = compact ? incident.updates.slice(0, 1) : incident.updates;

    return (
        <article className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="min-w-0 flex-1 font-semibold text-white">
                    {incident.title}
                </h3>
                <span
                    className={cn(
                        'text-xs font-medium',
                        incident.status === 'resolved'
                            ? 'text-emerald-400'
                            : incident.severity === 'major'
                              ? 'text-red-400'
                              : 'text-amber-300',
                    )}
                >
                    {incidentStatusLabel(incident.status)}
                </span>
            </div>
            <p className="mt-0.5 text-xs text-white/40">
                {formatDate(incident.started_at)}
            </p>
            <ol className="mt-3 space-y-3">
                {updates.map((u, i) => (
                    <li key={i} className="text-sm">
                        <span className="text-white/45">
                            {incidentStatusLabel(u.status)} · {clockTime(u.at)}
                        </span>
                        <p className="mt-0.5 leading-relaxed whitespace-pre-line text-white/80">
                            {u.message}
                        </p>
                    </li>
                ))}
            </ol>
        </article>
    );
}

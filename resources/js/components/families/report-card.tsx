import {
    AlertTriangle,
    Briefcase,
    CheckCircle2,
    Clock3,
    Coins,
    Sparkles,
    Swords,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyReportItem, ReportType } from '@/types';
import { kyivDate } from './ui';
import { tr } from '@/lib/i18n';

export const reportIcons: Record<ReportType, LucideIcon> = {
    bizwar: Swords,
    contract: Briefcase,
    investment: Coins,
    other: Sparkles,
};

const tierLabels = {
    light: tr('Легкий'),
    medium: tr('Середній'),
    heavy: tr('Важкий'),
};

export function reportSummary(r: FamilyReportItem): string {
    const d = r.data ?? {};
    switch (r.type) {
        case 'bizwar':
            return tr('{v} перемог · {v2} поразок{v3}', {
                v: d.wins ?? 0,
                v2: d.losses ?? 0,
                v3: d.hours?.length
                    ? ` · ${d.hours.map((h) => `${h}:00`).join(', ')}`
                    : '',
            });
        case 'contract':
            return `${d.count ?? 0} × ${tierLabels[d.tier ?? 'light']}`;
        case 'investment':
            return tr('Інвестиція {uah}', { uah: uah(d.amount ?? 0) });
        default:
            return r.description ?? tr('Інше');
    }
}

const statusView = {
    pending: {
        icon: Clock3,
        label: tr('На перевірці'),
        tone: 'bg-amber-300/10 text-amber-200',
    },
    approved: {
        icon: CheckCircle2,
        label: tr('Схвалено'),
        tone: 'bg-emerald-400/10 text-emerald-200',
    },
    rejected: {
        icon: XCircle,
        label: tr('Відхилено'),
        tone: 'bg-rose-400/10 text-rose-200',
    },
};

export function ReportStatus({
    status,
}: {
    status: FamilyReportItem['status'];
}) {
    const s = statusView[status];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                s.tone,
            )}
        >
            <s.icon className="size-3" /> {s.label}
        </span>
    );
}

export function ReportRow({
    report,
    meId,
}: {
    report: FamilyReportItem;
    meId: number;
}) {
    const Icon = reportIcons[report.type];

    return (
        <article className="flex gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                <Icon className="size-5 text-amber-200" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                        {report.type_label}
                    </span>
                    <span className="text-xs text-white/35">
                        #{report.id} · {kyivDate(report.event_date)}
                    </span>
                    <ReportStatus status={report.status} />
                    {report.flags?.similar_reports && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-200">
                            <AlertTriangle className="size-3" />{' '}
                            {tr('схожий скрін')}
                        </span>
                    )}
                </div>
                <div className="mt-0.5 truncate text-sm text-white/60">
                    {reportSummary(report)}
                </div>
                <div className="mt-1 text-xs text-white/40">
                    {report.for_friend &&
                        (report.beneficiary.id === meId
                            ? tr('від {display} · ', {
                                  display: report.submitter.display,
                              })
                            : tr('за {display} · ', {
                                  display: report.beneficiary.display,
                              }))}
                    {timeAgo(report.created_at)}
                    {report.reviewer &&
                        tr(' · перевірив {display}', {
                            display: report.reviewer.display,
                        })}
                </div>
                {report.review_comment && (
                    <div className="mt-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60">
                        {report.review_comment}
                    </div>
                )}
            </div>
            <div className="text-right">
                <div
                    className={cn(
                        'font-display font-bold whitespace-nowrap',
                        report.status === 'approved'
                            ? 'text-emerald-300'
                            : report.status === 'rejected'
                              ? 'text-white/30 line-through'
                              : 'text-white/70',
                    )}
                >
                    {report.reward > 0 ? uah(report.reward) : '—'}
                </div>
                {report.points > 0 && (
                    <div className="text-xs text-amber-200/70">
                        +{report.points} {tr('балів')}
                    </div>
                )}
            </div>
        </article>
    );
}

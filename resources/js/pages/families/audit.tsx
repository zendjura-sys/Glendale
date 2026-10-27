import { InfiniteScroll, router } from '@inertiajs/react';
import { ListSkeleton } from '@/components/gc/skeletons';
import { Lock, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import { Empty, Panel, kyivDateTime } from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import type { AuditEntry, FamilyShellProps, Paginated } from '@/types';
import { tr } from '@/lib/i18n';

type Props = FamilyShellProps & {
    logs: Paginated<AuditEntry>;
    actions: Record<string, string>;
    action: string | null;
};

const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? tr('так') : tr('ні');
    if (typeof value === 'object') return JSON.stringify(value);

    return String(value as string | number);
};

export default function FamilyAudit(props: Props) {
    const { family, logs, actions, action } = props;
    const [open, setOpen] = useState<number | null>(null);

    return (
        <FamilyShell {...props} title={tr('Аудит')}>
            <Panel
                title={tr('Журнал аудиту')}
                icon={ScrollText}
                actions={
                    <select
                        value={action ?? ''}
                        onChange={(e) =>
                            router.get(
                                `/f/${family.slug}/audit`,
                                { action: e.target.value || undefined },
                                {
                                    preserveScroll: true,
                                    preserveState: true,
                                    replace: true,
                                    reset: ['logs'],
                                },
                            )
                        }
                        className={selectClass}
                    >
                        <option value="">{tr('Усі дії')}</option>
                        {Object.entries(actions).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                }
            >
                <p className="mb-3 flex items-center gap-1.5 text-xs text-white/40">
                    <Lock className="size-3.5" />{' '}
                    {tr(
                        'Записи незмінні: їх не може відредагувати чи видалити навіть лідер.',
                    )}
                </p>
                {logs.data.length === 0 ? (
                    <Empty icon={ScrollText} text={tr('Записів немає')} />
                ) : (
                    <InfiniteScroll
                        data="logs"
                        loading={
                            <ListSkeleton rows={3} avatar="none" card={false} />
                        }
                        preserveUrl
                    >
                        <ul className="divide-y divide-white/[0.05]">
                            {logs.data.map((l) => (
                                <li key={l.id} className="py-2.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpen(open === l.id ? null : l.id)
                                        }
                                        className="flex w-full items-start gap-3 text-left"
                                    >
                                        <span className="mt-0.5 w-24 shrink-0 text-xs text-white/35 tabular-nums">
                                            {kyivDateTime(l.created_at)}
                                        </span>
                                        <div className="min-w-0 flex-1 text-sm">
                                            <span className="font-semibold text-white">
                                                {l.action_label}
                                            </span>
                                            {l.target && (
                                                <span className="font-mono text-xs text-white/70">
                                                    {' '}
                                                    → {l.target}
                                                </span>
                                            )}
                                            <div className="text-xs text-white/40">
                                                {l.actor ?? tr('Система')}
                                            </div>
                                        </div>
                                        <span className="font-mono text-xs text-white/25">
                                            {l.action}
                                        </span>
                                    </button>
                                    {open === l.id && l.details && (
                                        <dl className="mt-2 ml-27 grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl bg-white/[0.03] p-3 font-mono text-xs sm:grid-cols-[auto_1fr]">
                                            {Object.entries(l.details).map(
                                                ([k, v]) => (
                                                    <div
                                                        key={k}
                                                        className="contents"
                                                    >
                                                        <dt className="text-white/40">
                                                            {k}
                                                        </dt>
                                                        <dd className="break-all text-white/75">
                                                            {formatValue(v)}
                                                        </dd>
                                                    </div>
                                                ),
                                            )}
                                        </dl>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </InfiniteScroll>
                )}
            </Panel>
        </FamilyShell>
    );
}

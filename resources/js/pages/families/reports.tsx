import { InfiniteScroll, router } from '@inertiajs/react';
import { ListSkeleton } from '@/components/gc/skeletons';
import { FilePlus2, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import { ReportRow } from '@/components/families/report-card';
import { ReportForm } from '@/components/families/report-form';
import {
    Empty,
    Modal,
    Panel,
    Segmented,
    btnPrimary,
} from '@/components/families/ui';
import type {
    FamilyReportItem,
    FamilyShellProps,
    Paginated,
    ReportConfig,
    ReportType,
    RosterEntry,
} from '@/types';
import { tr } from '@/lib/i18n';

type Tier = 'light' | 'medium' | 'heavy';

type Props = FamilyShellProps & {
    reports: Paginated<FamilyReportItem>;
    status: 'pending' | 'approved' | 'rejected' | null;
    config: ReportConfig;
    usage: Record<string, Record<Tier, number>>;
    roster: RosterEntry[];
};

export default function FamilyReports(props: Props) {
    const { family, me, reports, status, config, usage, roster } = props;
    const [sheet, setSheet] = useState(false);
    const action = `/f/${family.slug}/reports`;
    const types = Object.keys(config.types) as ReportType[];

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (
            params.get('new') &&
            window.matchMedia('(max-width: 1023px)').matches
        ) {
            setSheet(true);
        }
    }, []);

    const form = (onDone?: () => void) => (
        <ReportForm
            action={action}
            config={config}
            usage={usage}
            roster={roster}
            meId={me.id}
            allowed={types}
            onDone={onDone}
        />
    );

    return (
        <FamilyShell {...props} title={tr('Звіти')}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[440px_1fr]">
                <Panel
                    title={tr('Новий звіт')}
                    icon={FilePlus2}
                    className="hidden h-fit lg:sticky lg:top-20 lg:block"
                >
                    {form()}
                </Panel>

                <button
                    type="button"
                    onClick={() => setSheet(true)}
                    className={`${btnPrimary} h-12 lg:hidden`}
                >
                    <FilePlus2 className="size-5" /> {tr('Подати звіт')}
                </button>

                <Panel
                    title={tr('Мої звіти')}
                    icon={FileText}
                    actions={
                        <Segmented
                            value={status ?? 'all'}
                            onChange={(v) =>
                                router.get(
                                    action,
                                    { status: v === 'all' ? undefined : v },
                                    {
                                        preserveScroll: true,
                                        preserveState: true,
                                        replace: true,
                                        reset: ['reports'],
                                    },
                                )
                            }
                            options={[
                                { value: 'all', label: tr('Усі') },
                                { value: 'pending', label: tr('Очікують') },
                                { value: 'approved', label: tr('Схвалені') },
                                { value: 'rejected', label: tr('Відхилені') },
                            ]}
                        />
                    }
                >
                    {reports.data.length === 0 ? (
                        <Empty
                            icon={FileText}
                            text={tr('Звітів ще немає — подайте перший')}
                        />
                    ) : (
                        <InfiniteScroll
                            data="reports"
                            loading={
                                <ListSkeleton
                                    rows={3}
                                    avatar="none"
                                    card={false}
                                />
                            }
                            preserveUrl
                            className="space-y-2"
                        >
                            {reports.data.map((r) => (
                                <ReportRow key={r.id} report={r} meId={me.id} />
                            ))}
                        </InfiniteScroll>
                    )}
                </Panel>
            </div>

            <Modal
                open={sheet}
                onClose={() => setSheet(false)}
                title={tr('Новий звіт')}
                wide
            >
                {form(() => setSheet(false))}
            </Modal>
        </FamilyShell>
    );
}

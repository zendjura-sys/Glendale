import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    CheckCheck,
    ClipboardCheck,
    ImagePlus,
    Keyboard,
    Wallet,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    ReportStatus,
    reportIcons,
    reportSummary,
} from '@/components/families/report-card';
import {
    Empty,
    Modal,
    Panel,
    RankBadge,
    Segmented,
    btnDanger,
    btnGhost,
    btnPrimary,
    btnSuccess,
    kyivDate,
    kyivDateTime,
    textareaClass,
} from '@/components/families/ui';
import { FieldError, inputClass } from '@/components/servers/server-form';
import { timeAgo } from '@/lib/format';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CashoutItem, FamilyReportItem, FamilyShellProps } from '@/types';
import { tr } from '@/lib/i18n';

type QueueReport = FamilyReportItem & {
    self_review: boolean;
    history: { approved: number; rejected: number };
    contracts_used: number | null;
};

type Props = FamilyShellProps & {
    reports: QueueReport[];
    cashouts: CashoutItem[];
    contract_limit: number;
    tab: 'reports' | 'cashouts';
};

export default function FamilyQueue(props: Props) {
    const { family, can, reports, cashouts, contract_limit } = props;
    const [tab, setTab] = useState<'reports' | 'cashouts'>(
        props.tab === 'cashouts' || !can['reports.review']
            ? 'cashouts'
            : 'reports',
    );
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<number[]>([]);
    const [rejecting, setRejecting] = useState<QueueReport | null>(null);
    const [paying, setPaying] = useState<CashoutItem | null>(null);
    const [busy, setBusy] = useState(false);
    const [customReward, setCustomReward] = useState('');
    const listRef = useRef<HTMLDivElement>(null);
    const base = `/f/${family.slug}`;

    const current = reports[Math.min(index, reports.length - 1)];

    useEffect(() => {
        if (index >= reports.length && reports.length > 0) {
            setIndex(reports.length - 1);
        }
        setSelected((s) => s.filter((id) => reports.some((r) => r.id === id)));
    }, [reports, index]);

    useEffect(() => setCustomReward(''), [current?.id]);

    const review = (
        report: QueueReport,
        decision: 'approve' | 'reject',
        comment?: string,
    ) => {
        if (busy) return;
        setBusy(true);
        router.post(
            `${base}/reports/${report.id}/review`,
            {
                decision,
                comment: comment || null,
                reward:
                    report.type === 'other' && customReward
                        ? customReward
                        : null,
            },
            {
                preserveScroll: true,
                onFinish: () => setBusy(false),
                onSuccess: () => setRejecting(null),
            },
        );
    };

    useEffect(() => {
        if (tab !== 'reports') return;
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (
                rejecting ||
                paying ||
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                e.metaKey ||
                e.ctrlKey ||
                e.altKey
            ) {
                return;
            }
            const key = e.key.toLowerCase();
            if (key === 'j' || key === 'о' || e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(reports.length - 1, i + 1));
            } else if (key === 'k' || key === 'л' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
            } else if (
                (key === 'a' || key === 'ф') &&
                current &&
                !current.self_review
            ) {
                e.preventDefault();
                review(current, 'approve');
            } else if (
                (key === 'r' || key === 'к') &&
                current &&
                !current.self_review
            ) {
                e.preventDefault();
                setRejecting(current);
            } else if (key === 'x' || key === 'ч') {
                if (current) toggle(current.id);
            }
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, reports, current, rejecting, paying, busy, customReward]);

    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${index}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [index]);

    const toggle = (id: number) =>
        setSelected((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
        );

    const bulkable = useMemo(
        () =>
            reports.filter((r) => !r.self_review && !r.flags?.similar_reports),
        [reports],
    );

    const bulk = () =>
        router.post(
            `${base}/reports/bulk`,
            { ids: selected },
            { preserveScroll: true, onSuccess: () => setSelected([]) },
        );

    const tabs = [
        ...(can['reports.review']
            ? [
                  {
                      value: 'reports' as const,
                      label: tr('Звіти'),
                      badge: reports.length,
                  },
              ]
            : []),
        ...(can['treasury.manage']
            ? [
                  {
                      value: 'cashouts' as const,
                      label: tr('Виплати'),
                      badge: cashouts.length,
                  },
              ]
            : []),
    ];

    return (
        <FamilyShell {...props} title={tr('Перевірка')}>
            <div className="flex flex-wrap items-center gap-2">
                <Segmented value={tab} onChange={setTab} options={tabs} />
                {tab === 'reports' && (
                    <div className="ml-auto hidden items-center gap-3 text-xs text-white/40 md:flex">
                        <Keyboard className="size-4" />
                        <Kbd>J</Kbd>/<Kbd>K</Kbd> {tr('навігація')}
                        <Kbd>A</Kbd> {tr('схвалити')}
                        <Kbd>R</Kbd> {tr('відхилити')}
                        <Kbd>X</Kbd> {tr('позначити')}
                    </div>
                )}
            </div>

            {tab === 'reports' &&
                (reports.length === 0 ? (
                    <Panel>
                        <Empty
                            icon={ClipboardCheck}
                            text={tr('Черга порожня — усі звіти перевірено 🎉')}
                        />
                    </Panel>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
                        <Panel padded={false} className="overflow-hidden">
                            <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
                                <input
                                    type="checkbox"
                                    aria-label={tr('Обрати всі')}
                                    checked={
                                        bulkable.length > 0 &&
                                        bulkable.every((r) =>
                                            selected.includes(r.id),
                                        )
                                    }
                                    onChange={(e) =>
                                        setSelected(
                                            e.target.checked
                                                ? bulkable.map((r) => r.id)
                                                : [],
                                        )
                                    }
                                    className="size-4 accent-[#6d5dfc]"
                                />
                                <span className="flex-1 text-xs text-white/50">
                                    {selected.length
                                        ? tr('Обрано {length}', {
                                              length: selected.length,
                                          })
                                        : tr('{length} в черзі', {
                                              length: reports.length,
                                          })}
                                </span>
                                {selected.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={bulk}
                                        className={cn(
                                            btnSuccess,
                                            'h-8 text-xs',
                                        )}
                                    >
                                        <CheckCheck className="size-4" />{' '}
                                        {tr('Схвалити обрані')}
                                    </button>
                                )}
                            </div>
                            <div
                                ref={listRef}
                                className="max-h-[65vh] overflow-y-auto p-2"
                            >
                                {reports.map((r, i) => {
                                    const Icon = reportIcons[r.type];

                                    return (
                                        <div
                                            key={r.id}
                                            data-index={i}
                                            onClick={() => setIndex(i)}
                                            className={cn(
                                                'flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition',
                                                i === index
                                                    ? 'bg-[#6d5dfc]/15 ring-1 ring-[#7c8cff]/40'
                                                    : 'hover:bg-white/[0.04]',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(
                                                    r.id,
                                                )}
                                                disabled={
                                                    r.self_review ||
                                                    !!r.flags?.similar_reports
                                                }
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                onChange={() => toggle(r.id)}
                                                className="size-4 accent-[#6d5dfc] disabled:opacity-20"
                                            />
                                            <Icon className="size-4 shrink-0 text-amber-200" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-mono text-xs text-white">
                                                    {r.beneficiary.display}
                                                </div>
                                                <div className="truncate text-[11px] text-white/45">
                                                    {reportSummary(r)}
                                                </div>
                                            </div>
                                            {r.flags?.similar_reports && (
                                                <AlertTriangle className="size-4 text-rose-300" />
                                            )}
                                            <span className="text-xs font-semibold text-white/70">
                                                {r.reward > 0
                                                    ? uah(r.reward)
                                                    : '—'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>

                        {current && (
                            <Panel>
                                <ReportDetail
                                    report={current}
                                    contractLimit={contract_limit}
                                    customReward={customReward}
                                    setCustomReward={setCustomReward}
                                />
                                <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                                    {current.self_review ? (
                                        <p className="text-sm text-amber-200">
                                            {tr(
                                                'Це ваш звіт — його має перевірити інший офіцер.',
                                            )}
                                        </p>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() =>
                                                    review(current, 'approve')
                                                }
                                                className={cn(
                                                    btnSuccess,
                                                    'h-11 flex-1 sm:flex-none sm:px-6',
                                                )}
                                            >
                                                <Check className="size-4" />{' '}
                                                {tr('Схвалити')} <Kbd>A</Kbd>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() =>
                                                    setRejecting(current)
                                                }
                                                className={cn(
                                                    btnDanger,
                                                    'h-11 flex-1 sm:flex-none sm:px-6',
                                                )}
                                            >
                                                <X className="size-4" />{' '}
                                                {tr('Відхилити')} <Kbd>R</Kbd>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </Panel>
                        )}
                    </div>
                ))}

            {tab === 'cashouts' && (
                <Panel title={tr('Заявки на виплату')} icon={Wallet}>
                    {cashouts.length === 0 ? (
                        <Empty icon={Wallet} text={tr('Нових заявок немає')} />
                    ) : (
                        <div className="space-y-2">
                            {cashouts.map((c) => (
                                <div
                                    key={c.id}
                                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.05]"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-sm text-white">
                                            {c.member.display}
                                        </div>
                                        <div className="text-xs text-white/40">
                                            #{c.id} · {timeAgo(c.created_at)}
                                            {c.note && ` · ${c.note}`}
                                        </div>
                                    </div>
                                    <div className="font-display text-xl font-bold text-white">
                                        {uah(c.amount)}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPaying(c)}
                                        className={btnSuccess}
                                    >
                                        <Check className="size-4" />{' '}
                                        {tr('Видано')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const reason = prompt(
                                                tr(
                                                    'Причина скасування (кошти повернуться на рахунок)',
                                                ),
                                            );
                                            if (reason !== null) {
                                                router.post(
                                                    `${base}/bank/cashouts/${c.id}/cancel`,
                                                    { reason },
                                                    { preserveScroll: true },
                                                );
                                            }
                                        }}
                                        className={btnGhost}
                                    >
                                        {tr('Скасувати')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            )}

            <RejectDialog
                report={rejecting}
                busy={busy}
                onClose={() => setRejecting(null)}
                onSubmit={(comment) =>
                    rejecting && review(rejecting, 'reject', comment)
                }
            />
            <PayDialog
                cashout={paying}
                action={paying ? `${base}/bank/cashouts/${paying.id}/pay` : ''}
                onClose={() => setPaying(null)}
            />
        </FamilyShell>
    );
}

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 font-mono text-[10px] text-white/70">
            {children}
        </kbd>
    );
}

function ReportDetail({
    report,
    contractLimit,
    customReward,
    setCustomReward,
}: {
    report: QueueReport;
    contractLimit: number;
    customReward: string;
    setCustomReward: (v: string) => void;
}) {
    const [zoom, setZoom] = useState<string | null>(null);
    const deadlineLeft = new Date(report.deadline).getTime() - Date.now();

    return (
        <div>
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-white">
                            {report.type_label} #{report.id}
                        </h3>
                        <ReportStatus status={report.status} />
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                        {reportSummary(report)}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[11px] tracking-wide text-white/40 uppercase">
                        {tr('До виплати')}
                    </div>
                    <div className="font-display text-2xl font-bold text-emerald-300">
                        {report.type === 'other'
                            ? customReward
                                ? `${customReward} ₴`
                                : '—'
                            : uah(report.reward)}
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <Info label={tr('Отримувач')}>
                    <span className="font-mono text-white">
                        {report.beneficiary.display}
                    </span>{' '}
                    <RankBadge
                        rank={report.beneficiary.rank}
                        title={report.beneficiary.rank_title}
                    />
                </Info>
                <Info label={tr('Подав')}>
                    <span className="font-mono text-white">
                        {report.submitter.display}
                    </span>
                    {report.for_friend && (
                        <span className="ml-1 text-xs text-amber-200">
                            {tr('(за друга)')}
                        </span>
                    )}
                </Info>
                <Info label={tr('Дата події')}>
                    {kyivDate(report.event_date)} {tr('· подано')}{' '}
                    {kyivDateTime(report.created_at)}
                </Info>
                <Info label={tr('Історія за 30 днів')}>
                    <span className="text-emerald-300">
                        ✓ {report.history.approved}
                    </span>{' '}
                    ·{' '}
                    <span className="text-rose-300">
                        ✕ {report.history.rejected}
                    </span>
                </Info>
                {report.contracts_used !== null && (
                    <Info label={tr('Контрактів за день')}>
                        <span
                            className={cn(
                                report.contracts_used > contractLimit &&
                                    'text-rose-300',
                            )}
                        >
                            {report.contracts_used}/{contractLimit}
                        </span>
                    </Info>
                )}
                <Info label={tr('Дедлайн звіту')}>
                    {deadlineLeft > 0
                        ? tr('ще {ceil} год', {
                              ceil: Math.ceil(deadlineLeft / 3600000),
                          })
                        : tr('минув')}
                </Info>
            </div>

            {report.flags?.similar_reports && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {tr('Скріншот дуже схожий на звіти #')}
                    {report.flags.similar_reports.join(', #')}
                    {tr('. Перевірте, чи це не повторне подання.')}
                </div>
            )}

            {report.description && report.type !== 'other' && (
                <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/70">
                    {report.description}
                </p>
            )}

            {report.type === 'other' && (
                <label className="mt-3 block">
                    <span className="mb-1.5 block text-xs font-medium text-white/60">
                        {tr('Винагорода, ₴ (визначаєте ви)')}
                    </span>
                    <input
                        value={customReward}
                        onChange={(e) => setCustomReward(e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className={cn(inputClass, 'max-w-48')}
                    />
                </label>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {report.proofs.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setZoom(p.url)}
                        className="aspect-video overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10"
                    >
                        <img
                            src={p.url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover transition hover:scale-105"
                        />
                    </button>
                ))}
                {report.proofs.length === 0 && (
                    <p className="col-span-full text-xs text-white/40">
                        {tr('Скріншотів немає')}
                    </p>
                )}
            </div>

            {zoom && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setZoom(null)}
                >
                    <img
                        src={zoom}
                        alt=""
                        className="max-h-full max-w-full rounded-xl"
                    />
                </div>
            )}
        </div>
    );
}

function Info({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
            <div className="text-[11px] text-white/40">{label}</div>
            <div className="mt-0.5 text-white/75">{children}</div>
        </div>
    );
}

function RejectDialog({
    report,
    busy,
    onClose,
    onSubmit,
}: {
    report: QueueReport | null;
    busy: boolean;
    onClose: () => void;
    onSubmit: (comment: string) => void;
}) {
    const [comment, setComment] = useState('');
    const presets = [
        tr('Немає доказів на скріншоті'),
        tr('Скріншот уже подавали'),
        tr('Дані не збігаються зі скріншотом'),
        tr('Минув термін подання'),
    ];

    useEffect(() => setComment(''), [report?.id]);

    return (
        <Modal
            open={report !== null}
            onClose={onClose}
            title={tr('Відхилити звіт #{v}', { v: report?.id ?? '' })}
            description={tr('Причину побачить автор звіту.')}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={btnGhost}
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        disabled={busy || comment.trim().length < 3}
                        onClick={() => onSubmit(comment)}
                        className={btnDanger}
                    >
                        {tr('Відхилити')}
                    </button>
                </>
            }
        >
            <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setComment(p)}
                        className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-white/65 hover:text-white"
                    >
                        {p}
                    </button>
                ))}
            </div>
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        onSubmit(comment);
                    }
                }}
                placeholder={tr('Причина відхилення')}
                className={textareaClass}
            />
        </Modal>
    );
}

function PayDialog({
    cashout,
    action,
    onClose,
}: {
    cashout: CashoutItem | null;
    action: string;
    onClose: () => void;
}) {
    const form = useForm({ comment: '', proof: null as File | null });
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <Modal
            open={cashout !== null}
            onClose={onClose}
            title={tr('Видача {v}', { v: cashout ? uah(cashout.amount) : '' })}
            description={
                cashout
                    ? tr(
                          'Підтвердіть, що передали гроші {display} у грі. Суму буде списано зі скарбниці.',
                          { display: cashout.member.display },
                      )
                    : undefined
            }
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className={btnGhost}
                    >
                        {tr('Скасувати')}
                    </button>
                    <button
                        type="button"
                        disabled={form.processing}
                        onClick={() =>
                            form.post(action, {
                                forceFormData: true,
                                preserveScroll: true,
                                onSuccess: () => {
                                    form.reset();
                                    onClose();
                                },
                            })
                        }
                        className={btnPrimary}
                    >
                        {tr('Підтвердити видачу')}
                    </button>
                </>
            }
        >
            <input
                value={form.data.comment}
                onChange={(e) => form.setData('comment', e.target.value)}
                placeholder={tr('Коментар (необов’язково)')}
                className={inputClass}
            />
            <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn(btnGhost, 'w-full')}
            >
                <ImagePlus className="size-4" />
                {form.data.proof
                    ? form.data.proof.name
                    : tr('Скріншот передачі')}
            </button>
            <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) =>
                    form.setData('proof', e.target.files?.[0] ?? null)
                }
            />
            <FieldError message={form.errors.proof ?? form.errors.comment} />
        </Modal>
    );
}

import { router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDownToLine,
    ArrowUpFromLine,
    Gauge,
    ImagePlus,
    Package,
    Pencil,
    Plus,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Modal,
    Panel,
    Segmented,
    btnGhost,
    btnPrimary,
    kyivDateTime,
} from '@/components/families/ui';
import { Toggle, selectClass } from '@/components/gc/admin';
import {
    Field,
    FieldError,
    inputClass,
} from '@/components/servers/server-form';
import { cn } from '@/lib/utils';
import type { FamilyShellProps } from '@/types';
import { tr } from '@/lib/i18n';

type Item = {
    id: number;
    category: string;
    name: string;
    unit: string | null;
    quantity: number;
    hourly_quota: number | null;
    min_stock: number | null;
    low: boolean;
    is_archived: boolean;
};

type Log = {
    id: number;
    item: string;
    unit: string | null;
    action: 'take' | 'put' | 'adjust';
    action_label: string;
    quantity: number;
    quantity_after: number;
    comment: string | null;
    is_suspicious: boolean;
    member: string | null;
    proof_url: string | null;
    created_at: string;
};

type Props = FamilyShellProps & {
    tab: 'stock' | 'log' | 'alerts';
    items: Item[];
    categories: Record<string, string>;
    logs: Log[];
    top_takers: { display: string | null; total: number; times: number }[];
};

export default function FamilyWarehouse(props: Props) {
    const { family, can, tab, items, categories, logs, top_takers, badges } =
        props;
    const base = `/f/${family.slug}`;
    const [moving, setMoving] = useState<{
        item: Item;
        action: 'take' | 'put';
    } | null>(null);
    const [editing, setEditing] = useState<Item | 'new' | null>(null);

    const grouped = Object.entries(categories)
        .map(([key, label]) => ({
            key,
            label,
            items: items.filter((i) => i.category === key),
        }))
        .filter((g) => g.items.length > 0);

    const switchTab = (value: Props['tab']) =>
        router.get(
            `${base}/warehouse`,
            { tab: value === 'stock' ? undefined : value },
            { preserveScroll: true, preserveState: true, replace: true },
        );

    return (
        <FamilyShell {...props} title={tr('Склад')}>
            <div className="flex flex-wrap items-center gap-2">
                {can['warehouse.logs'] && (
                    <Segmented
                        value={tab}
                        onChange={switchTab}
                        options={[
                            { value: 'stock', label: tr('Залишки') },
                            { value: 'log', label: tr('Журнал') },
                            {
                                value: 'alerts',
                                label: tr('Підозрілі'),
                                badge: badges?.alerts,
                            },
                        ]}
                    />
                )}
                {can['warehouse.manage'] && tab === 'stock' && (
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className={cn(btnGhost, 'ml-auto')}
                    >
                        <Plus className="size-4" /> {tr('Позиція')}
                    </button>
                )}
            </div>

            {tab === 'stock' ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-4">
                        {grouped.length === 0 && (
                            <Panel>
                                <Empty
                                    icon={Package}
                                    text={tr('Склад порожній')}
                                />
                            </Panel>
                        )}
                        {grouped.map((g) => (
                            <Panel key={g.key} title={g.label} icon={Package}>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {g.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                'rounded-2xl p-3 ring-1',
                                                item.is_archived
                                                    ? 'bg-white/[0.02] opacity-50 ring-white/[0.04]'
                                                    : item.low
                                                      ? 'bg-rose-500/[0.07] ring-rose-400/25'
                                                      : 'bg-white/[0.03] ring-white/[0.06]',
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-sm font-semibold text-white">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[11px] text-white/40">
                                                        {item.hourly_quota
                                                            ? tr(
                                                                  'квота {hourly_quota}/год',
                                                                  {
                                                                      hourly_quota:
                                                                          item.hourly_quota,
                                                                  },
                                                              )
                                                            : tr('без квоти')}
                                                        {item.min_stock !==
                                                            null &&
                                                            tr(
                                                                ' · мін. {min_stock}',
                                                                {
                                                                    min_stock:
                                                                        item.min_stock,
                                                                },
                                                            )}
                                                    </div>
                                                </div>
                                                <div
                                                    className={cn(
                                                        'font-display text-xl font-bold tabular-nums',
                                                        item.low
                                                            ? 'text-rose-300'
                                                            : 'text-white',
                                                    )}
                                                >
                                                    {item.quantity}
                                                    {item.unit && (
                                                        <span className="ml-0.5 text-xs font-normal text-white/40">
                                                            {item.unit}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2.5 flex gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={
                                                        item.is_archived ||
                                                        item.quantity === 0
                                                    }
                                                    onClick={() =>
                                                        setMoving({
                                                            item,
                                                            action: 'take',
                                                        })
                                                    }
                                                    className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.06] text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-30"
                                                >
                                                    <ArrowUpFromLine className="size-3.5" />{' '}
                                                    {tr('Взяти')}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={item.is_archived}
                                                    onClick={() =>
                                                        setMoving({
                                                            item,
                                                            action: 'put',
                                                        })
                                                    }
                                                    className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.06] text-xs font-medium text-white/80 hover:bg-white/10 disabled:opacity-30"
                                                >
                                                    <ArrowDownToLine className="size-3.5" />{' '}
                                                    {tr('Покласти')}
                                                </button>
                                                {can['warehouse.manage'] && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEditing(item)
                                                        }
                                                        className="flex size-8 items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white"
                                                        aria-label={tr(
                                                            'Редагувати',
                                                        )}
                                                    >
                                                        <Pencil className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Panel>
                        ))}
                    </div>
                    <Panel
                        title={tr('Мої останні дії')}
                        icon={Gauge}
                        className="h-fit"
                    >
                        <LogList logs={logs} compact />
                    </Panel>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
                    <Panel
                        title={
                            tab === 'alerts'
                                ? tr('Перевищення квот')
                                : tr('Журнал складу')
                        }
                        icon={tab === 'alerts' ? AlertTriangle : Package}
                    >
                        <LogList logs={logs} />
                    </Panel>
                    <Panel
                        title={tr('Найбільше взяли за добу')}
                        icon={Gauge}
                        className="h-fit"
                    >
                        {top_takers.length === 0 ? (
                            <Empty icon={Gauge} text={tr('Немає даних')} />
                        ) : (
                            <ol className="space-y-1.5">
                                {top_takers.map((t, i) => (
                                    <li
                                        key={i}
                                        className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                                    >
                                        <span className="w-5 text-white/40">
                                            {i + 1}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
                                            {t.display}
                                        </span>
                                        <span className="text-xs text-white/50">
                                            {t.total} {tr('шт ·')} {t.times}{' '}
                                            {tr('раз')}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Panel>
                </div>
            )}

            {moving && (
                <MoveDialog
                    key={`${moving.item.id}-${moving.action}`}
                    action={`${base}/warehouse/move`}
                    item={moving.item}
                    direction={moving.action}
                    onClose={() => setMoving(null)}
                />
            )}
            {editing && (
                <ItemDialog
                    key={editing === 'new' ? 'new' : editing.id}
                    base={base}
                    item={editing === 'new' ? null : editing}
                    categories={categories}
                    onClose={() => setEditing(null)}
                />
            )}
        </FamilyShell>
    );
}

function LogList({ logs, compact }: { logs: Log[]; compact?: boolean }) {
    if (logs.length === 0) {
        return <Empty icon={Package} text={tr('Записів немає')} />;
    }

    return (
        <ul className="divide-y divide-white/[0.05]">
            {logs.map((l) => (
                <li
                    key={l.id}
                    className={cn(
                        'flex items-center gap-3 py-2',
                        l.is_suspicious && 'rounded-lg bg-rose-500/[0.07] px-2',
                    )}
                >
                    <span
                        className={cn(
                            'flex size-8 shrink-0 items-center justify-center rounded-lg',
                            l.action === 'take'
                                ? 'bg-rose-400/10 text-rose-200'
                                : l.action === 'put'
                                  ? 'bg-emerald-400/10 text-emerald-200'
                                  : 'bg-white/[0.06] text-white/60',
                        )}
                    >
                        {l.action === 'take' ? (
                            <ArrowUpFromLine className="size-4" />
                        ) : l.action === 'put' ? (
                            <ArrowDownToLine className="size-4" />
                        ) : (
                            <Pencil className="size-3.5" />
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-white">
                            {!compact && l.member && (
                                <span className="font-mono text-xs text-white/70">
                                    {l.member} ·{' '}
                                </span>
                            )}
                            {l.action_label} {l.item}
                        </div>
                        <div className="truncate text-xs text-white/40">
                            {kyivDateTime(l.created_at)}
                            {l.comment && ` · ${l.comment}`}
                            {l.is_suspicious && (
                                <span className="text-rose-300">
                                    {' '}
                                    {tr('· понад квоту')}
                                </span>
                            )}
                        </div>
                    </div>
                    {l.proof_url && (
                        <a
                            href={l.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#a5b4fc] hover:underline"
                        >
                            {tr('скрін')}
                        </a>
                    )}
                    <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-white">
                            {l.action === 'take'
                                ? '−'
                                : l.action === 'put'
                                  ? '+'
                                  : '='}
                            {l.action === 'adjust'
                                ? l.quantity_after
                                : l.quantity}
                        </div>
                        <div className="text-[10px] text-white/35">
                            {tr('залишок')} {l.quantity_after}
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}

function MoveDialog({
    action,
    item,
    direction,
    onClose,
}: {
    action: string;
    item: Item;
    direction: 'take' | 'put';
    onClose: () => void;
}) {
    const form = useForm({
        item_id: item.id,
        action: direction,
        quantity: 1,
        comment: '',
        proof: null as File | null,
    });
    const fileRef = useRef<HTMLInputElement>(null);

    return (
        <Modal
            open
            onClose={onClose}
            title={`${direction === 'take' ? tr('Взяти') : tr('Покласти')}: ${item.name}`}
            description={tr('На складі {quantity}{v}{v2}', {
                quantity: item.quantity,
                v: item.unit ? ` ${item.unit}` : '',
                v2:
                    item.hourly_quota && direction === 'take'
                        ? tr(' · квота {hourly_quota} на годину', {
                              hourly_quota: item.hourly_quota,
                          })
                        : '',
            })}
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
                                onSuccess: onClose,
                            })
                        }
                        className={btnPrimary}
                    >
                        {tr('Підтвердити')}
                    </button>
                </>
            }
        >
            <div className="flex flex-wrap gap-1.5">
                {[1, 5, 10, 25, 50].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => form.setData('quantity', n)}
                        className={cn(
                            'h-9 min-w-12 rounded-lg px-3 text-sm font-medium',
                            form.data.quantity === n
                                ? 'bg-gradient-brand text-white'
                                : 'bg-white/[0.05] text-white/60',
                        )}
                    >
                        {n}
                    </button>
                ))}
            </div>
            <input
                type="number"
                min={1}
                value={form.data.quantity}
                onChange={(e) =>
                    form.setData('quantity', Number(e.target.value))
                }
                className={inputClass}
            />
            <FieldError message={form.errors.quantity} />
            <input
                value={form.data.comment}
                onChange={(e) => form.setData('comment', e.target.value)}
                placeholder={tr('Для чого (необов’язково)')}
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
                    : tr('Скріншот (необов’язково)')}
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
        </Modal>
    );
}

function ItemDialog({
    base,
    item,
    categories,
    onClose,
}: {
    base: string;
    item: Item | null;
    categories: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm({
        category: item?.category ?? Object.keys(categories)[0],
        name: item?.name ?? '',
        unit: item?.unit ?? '',
        quantity: item?.quantity ?? 0,
        hourly_quota: item?.hourly_quota ?? ('' as number | ''),
        min_stock: item?.min_stock ?? ('' as number | ''),
        is_archived: item?.is_archived ?? false,
        comment: '',
    });

    const submit = () => {
        const options = { preserveScroll: true, onSuccess: onClose };
        if (item) {
            form.patch(`${base}/warehouse/items/${item.id}`, options);
        } else {
            form.post(`${base}/warehouse/items`, options);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={
                item
                    ? tr('Позиція «{name}»', { name: item.name })
                    : tr('Нова позиція')
            }
            description={tr(
                'Зміни квот і кількості записуються в журнал аудиту.',
            )}
            wide
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
                        onClick={submit}
                        className={btnPrimary}
                    >
                        {tr('Зберегти')}
                    </button>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={tr('Назва')} error={form.errors.name}>
                    <input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className={inputClass}
                    />
                </Field>
                <Field label={tr('Категорія')} error={form.errors.category}>
                    <select
                        value={form.data.category}
                        onChange={(e) =>
                            form.setData('category', e.target.value)
                        }
                        className={cn(selectClass, 'h-11 w-full')}
                    >
                        {Object.entries(categories).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field
                    label={tr('Одиниця')}
                    hint={tr('шт, кг, пач…')}
                    error={form.errors.unit}
                >
                    <input
                        value={form.data.unit}
                        onChange={(e) => form.setData('unit', e.target.value)}
                        className={inputClass}
                    />
                </Field>
                <Field
                    label={
                        item
                            ? tr('Фактична кількість')
                            : tr('Початкова кількість')
                    }
                    error={form.errors.quantity}
                >
                    <input
                        type="number"
                        min={0}
                        value={form.data.quantity}
                        onChange={(e) =>
                            form.setData('quantity', Number(e.target.value))
                        }
                        className={inputClass}
                    />
                </Field>
                <Field
                    label={tr('Квота на годину')}
                    hint={tr('Скільки один учасник може взяти за годину')}
                    error={form.errors.hourly_quota}
                >
                    <input
                        type="number"
                        min={1}
                        value={form.data.hourly_quota}
                        onChange={(e) =>
                            form.setData(
                                'hourly_quota',
                                e.target.value ? Number(e.target.value) : '',
                            )
                        }
                        className={inputClass}
                    />
                </Field>
                <Field
                    label={tr('Мінімальний залишок')}
                    hint={tr('Нижче — позиція підсвічується')}
                    error={form.errors.min_stock}
                >
                    <input
                        type="number"
                        min={0}
                        value={form.data.min_stock}
                        onChange={(e) =>
                            form.setData(
                                'min_stock',
                                e.target.value ? Number(e.target.value) : '',
                            )
                        }
                        className={inputClass}
                    />
                </Field>
                {item && (
                    <>
                        <Field
                            label={tr('Коментар до інвентаризації')}
                            className="sm:col-span-2"
                        >
                            <input
                                value={form.data.comment}
                                onChange={(e) =>
                                    form.setData('comment', e.target.value)
                                }
                                className={inputClass}
                            />
                        </Field>
                        <label className="flex items-center justify-between text-sm text-white/70 sm:col-span-2">
                            {tr('В архіві (приховано для учасників)')}
                            <Toggle
                                checked={form.data.is_archived}
                                onChange={(v) => form.setData('is_archived', v)}
                                label={tr('Архів')}
                            />
                        </label>
                    </>
                )}
            </div>
        </Modal>
    );
}

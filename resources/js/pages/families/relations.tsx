import { router, useForm } from '@inertiajs/react';
import { Check, Handshake, Swords, X } from 'lucide-react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Panel,
    btnDanger,
    btnGhost,
    btnPrimary,
} from '@/components/families/ui';
import { selectClass } from '@/components/gc/admin';
import { inputClass } from '@/components/servers/server-form';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FamilyShellProps } from '@/types';

type Relation = {
    id: number;
    type: 'alliance' | 'war';
    status: 'pending' | 'active' | 'ended';
    note: string | null;
    incoming: boolean;
    family: { id: number; slug: string; name: string; tag: string } | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string | null;
};

type Props = FamilyShellProps & {
    relations: Relation[];
    can_manage: boolean;
    candidates: { id: number; name: string; tag: string }[];
};

/** Союзи й війни з іншими сім’ями того самого сервера. */
export default function FamilyRelations(props: Props) {
    const { family, relations, can_manage: canManage, candidates } = props;
    const base = `/f/${family.slug}/relations`;
    const form = useForm({ type: 'alliance', other_family_id: '', note: '' });
    const active = relations.filter((r) => r.status !== 'ended');
    const ended = relations.filter((r) => r.status === 'ended');

    return (
        <FamilyShell {...props} title={tr('Союзи й війни')}>
            {canManage && candidates.length > 0 && (
                <Panel title={tr('Новий союз чи війна')} icon={Handshake}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(base, {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                        className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]"
                        data-relation-form
                    >
                        <select
                            value={form.data.type}
                            onChange={(e) =>
                                form.setData('type', e.target.value)
                            }
                            className={selectClass}
                            aria-label={tr('Тип')}
                        >
                            <option value="alliance">{tr('Союз')}</option>
                            <option value="war">{tr('Війна')}</option>
                        </select>
                        <select
                            value={form.data.other_family_id}
                            onChange={(e) =>
                                form.setData('other_family_id', e.target.value)
                            }
                            className={selectClass}
                            aria-label={tr('Сім’я')}
                            required
                        >
                            <option value="">
                                {tr('Сім’я вашого сервера…')}
                            </option>
                            {candidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                    [{c.tag}] {c.name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="submit"
                            disabled={
                                form.processing || !form.data.other_family_id
                            }
                            className={
                                form.data.type === 'war'
                                    ? btnDanger
                                    : btnPrimary
                            }
                        >
                            {form.data.type === 'war'
                                ? tr('Оголосити війну')
                                : tr('Запропонувати союз')}
                        </button>
                        <input
                            value={form.data.note}
                            onChange={(e) =>
                                form.setData('note', e.target.value)
                            }
                            placeholder={tr('Умови чи причина (необов’язково)')}
                            maxLength={300}
                            className={cn(inputClass, 'sm:col-span-3')}
                        />
                        {form.errors.other_family_id && (
                            <p className="text-sm text-red-400 sm:col-span-3">
                                {form.errors.other_family_id}
                            </p>
                        )}
                        <p className="text-xs text-white/45 sm:col-span-3">
                            {tr(
                                'Лише сім’ї вашого сервера. Союз діє, коли друга сім’я прийме пропозицію; війна починається одразу.',
                            )}
                        </p>
                    </form>
                </Panel>
            )}
            <Panel title={tr('Зараз')} icon={Swords}>
                {active.length === 0 ? (
                    <Empty
                        icon={Handshake}
                        text={tr('Ні союзів, ні воєн — поки що мир.')}
                    />
                ) : (
                    <ul className="space-y-2" data-relations>
                        {active.map((r) => (
                            <RelationRow
                                key={r.id}
                                relation={r}
                                base={base}
                                canManage={canManage}
                            />
                        ))}
                    </ul>
                )}
            </Panel>
            {ended.length > 0 && (
                <Panel title={tr('Минулі')} icon={Handshake}>
                    <ul className="space-y-2">
                        {ended.map((r) => (
                            <RelationRow
                                key={r.id}
                                relation={r}
                                base={base}
                                canManage={false}
                            />
                        ))}
                    </ul>
                </Panel>
            )}
        </FamilyShell>
    );
}

function RelationRow({
    relation: r,
    base,
    canManage,
}: {
    relation: Relation;
    base: string;
    canManage: boolean;
}) {
    const war = r.type === 'war';
    const Icon = war ? Swords : Handshake;

    return (
        <li className="gc-solid-2 flex flex-wrap items-center gap-3 rounded-xl p-3">
            <span
                className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    war
                        ? 'bg-red-500/15 text-red-300'
                        : 'bg-emerald-500/15 text-emerald-300',
                )}
            >
                <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                    {war ? tr('Війна') : tr('Союз')} ·{' '}
                    {r.family ? `[${r.family.tag}] ${r.family.name}` : '—'}
                </p>
                <p className="text-xs text-white/50">
                    {r.status === 'pending'
                        ? r.incoming
                            ? tr('Пропонують вам союз')
                            : tr('Чекаємо на відповідь')
                        : r.status === 'ended'
                          ? tr('{from} — {to}', {
                                from: r.started_at
                                    ? formatDate(r.started_at)
                                    : '…',
                                to: r.ended_at ? formatDate(r.ended_at) : '…',
                            })
                          : tr('З {date}', {
                                date: r.started_at
                                    ? formatDate(r.started_at)
                                    : '…',
                            })}
                    {r.note ? ` · ${r.note}` : ''}
                </p>
            </div>
            {canManage && r.incoming && (
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                `${base}/${r.id}/respond`,
                                { accept: true },
                                { preserveScroll: true },
                            )
                        }
                        className={btnPrimary}
                    >
                        <Check className="size-4" />
                        {tr('Прийняти')}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                `${base}/${r.id}/respond`,
                                { accept: false },
                                { preserveScroll: true },
                            )
                        }
                        className={btnGhost}
                    >
                        <X className="size-4" />
                        {tr('Відхилити')}
                    </button>
                </div>
            )}
            {canManage && r.status === 'active' && (
                <button
                    type="button"
                    onClick={() =>
                        confirm(
                            war
                                ? tr('Завершити війну?')
                                : tr('Розірвати союз?'),
                        ) &&
                        router.post(
                            `${base}/${r.id}/end`,
                            {},
                            { preserveScroll: true },
                        )
                    }
                    className={btnGhost}
                >
                    {war ? tr('Завершити війну') : tr('Розірвати союз')}
                </button>
            )}
        </li>
    );
}

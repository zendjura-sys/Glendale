import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Pencil,
    Plus,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Trash2,
    UserMinus,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { RoleChip, ROLE_ICONS, titleColor } from '@/components/gc/user-title';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Role = {
    id: number;
    name: string;
    kind: string;
    color: string;
    icon: string | null;
    description: string | null;
    priority: number;
    rule: string;
    rule_value: string | null;
    active_from: string | null;
    active_until: string | null;
    active: boolean;
    members: number;
};

type Member = UserCard & { auto: boolean };

/** Підказки для видів ролей. */
const KIND_HINTS: Record<string, string> = {
    regular:
        'Звичайні титули на кшталт «old» — видаються вручну або за стажем.',
    holiday: 'Діють лише між датами: «Новорічний 2027», «День незалежності».',
    award: 'Нагороди за досягнення, рівень профілю чи підтримку GameCon.',
    premium:
        'Для передплатників GameCon+ — з’являються й зникають разом із підпискою.',
};

/** Правило, яке пропонується першим для кожного виду. */
const KIND_RULE: Record<string, string> = {
    regular: 'manual',
    holiday: 'manual',
    award: 'achievement',
    premium: 'plus',
};

/**
 * Адмінка → Ролі: усі види ролей в одному місці. Ролі команди й власні ролі GameCon+ мають свої розділи,
 * тут — звичайні, святкові, нагородні й преміум-плашки біля ніка.
 */
export default function AdminRoles({
    roles,
    members,
    selected,
    kinds,
    rules,
    icons,
    colors,
    achievements,
}: {
    roles: Role[];
    members: Member[];
    selected: number | null;
    kinds: Record<string, string>;
    rules: Record<string, string>;
    icons: string[];
    colors: string[];
    achievements: { key: string; title: string }[];
}) {
    const [editing, setEditing] = useState<Role | { kind: string } | null>(
        null,
    );
    const current = roles.find((r) => r.id === selected) ?? null;
    const props = { kinds, rules, icons, colors, achievements };

    return (
        <>
            <Head title={tr('Ролі — Адмін-панель')} />
            <PageHeader
                title={tr('Ролі')}
                description={tr(
                    'Плашки з титулами біля ніка, як ролі сервера Discord, але для всього GameCon. Автоматичні ролі видаються й забираються самі.',
                )}
                actions={
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                '/admin/roles/sync',
                                {},
                                { preserveScroll: true },
                            )
                        }
                        className="gc-solid-2 flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-white/80 hover:text-white"
                    >
                        <RefreshCw className="size-4" />
                        {tr('Оновити автоматичні')}
                    </button>
                }
            />

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <Link
                    href="/admin/team"
                    className="gc-solid flex items-start gap-3 rounded-2xl p-4 hover:bg-white/[0.04]"
                >
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-300" />
                    <span>
                        <span className="block font-semibold text-white">
                            {tr('Ролі команди')}
                        </span>
                        <span className="block text-xs text-white/50">
                            {tr(
                                'Адміністратор, модератор і ваші ролі з доступом до розділів адмінки — у розділі «Команда».',
                            )}
                        </span>
                    </span>
                </Link>
                <div className="gc-solid flex items-start gap-3 rounded-2xl p-4">
                    <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-200" />
                    <span>
                        <span className="block font-semibold text-white">
                            {tr('Власні ролі')}
                        </span>
                        <span className="block text-xs text-white/50">
                            {tr(
                                'Передплатник GameCon+ сам задає собі назву й колір раз на тиждень. Зарезервовані слова й образи не пропускаються.',
                            )}
                        </span>
                    </span>
                </div>
            </div>

            {Object.entries(kinds).map(([kind, label]) => {
                const list = roles.filter((r) => r.kind === kind);
                const formHere =
                    editing !== null &&
                    ('id' in editing
                        ? editing.kind === kind
                        : editing.kind === kind);

                return (
                    <section
                        key={kind}
                        className="gc-solid mb-4 rounded-2xl p-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                                <h2 className="font-display text-base font-bold text-white">
                                    {tr(label)}
                                </h2>
                                <p className="text-xs text-white/45">
                                    {tr(KIND_HINTS[kind] ?? '')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditing({ kind })}
                                className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white"
                            >
                                <Plus className="size-4" /> {tr('Роль')}
                            </button>
                        </div>
                        {list.length > 0 && (
                            <ul className="mt-3 space-y-2">
                                {list.map((r) => (
                                    <RoleRow
                                        key={r.id}
                                        role={r}
                                        rules={rules}
                                        achievements={achievements}
                                        open={r.id === selected}
                                        onEdit={() => setEditing(r)}
                                    />
                                ))}
                            </ul>
                        )}
                        {formHere && editing && (
                            <RoleForm
                                key={'id' in editing ? editing.id : 'new'}
                                role={'id' in editing ? editing : null}
                                kind={kind}
                                {...props}
                                onDone={() => setEditing(null)}
                            />
                        )}
                        {current && current.kind === kind && (
                            <MembersPanel role={current} members={members} />
                        )}
                    </section>
                );
            })}
        </>
    );
}

/** Підпис правила: «Досягнення: Перший пост», «Стаж акаунта (років): 3». */
function ruleLabel(
    role: Role,
    rules: Record<string, string>,
    achievements: { key: string; title: string }[],
): string {
    const base = tr(rules[role.rule] ?? role.rule);
    if (!role.rule_value) return base;
    const value =
        role.rule === 'achievement'
            ? (achievements.find((a) => a.key === role.rule_value)?.title ??
              role.rule_value)
            : role.rule_value;

    return `${base}: ${value}`;
}

function RoleRow({
    role,
    rules,
    achievements,
    open,
    onEdit,
}: {
    role: Role;
    rules: Record<string, string>;
    achievements: { key: string; title: string }[];
    open: boolean;
    onEdit: () => void;
}) {
    return (
        <li
            className={cn(
                'gc-solid-2 flex flex-wrap items-center gap-2 rounded-xl p-3',
                !role.active && 'opacity-60',
            )}
        >
            <RoleChip role={role} className="px-2 py-1 text-xs" />
            <span className="min-w-0 flex-1 truncate text-xs text-white/45">
                {ruleLabel(role, rules, achievements)}
                {role.kind === 'holiday' &&
                    (role.active_from || role.active_until) &&
                    ` · ${role.active_from ?? '…'} — ${role.active_until ?? '…'}`}
                {!role.active && ` · ${tr('зараз не діє')}`}
            </span>
            <Link
                href={open ? '/admin/roles' : `/admin/roles?role=${role.id}`}
                preserveScroll
                className={cn(
                    'flex h-8 items-center gap-1 rounded-lg px-2 text-xs',
                    open ? 'text-white' : 'text-white/60 hover:text-white',
                )}
            >
                <Users className="size-4" />
                {role.rule === 'plus' || role.rule === 'account_years'
                    ? tr('авто')
                    : role.members}
            </Link>
            <button
                type="button"
                onClick={onEdit}
                aria-label={tr('Змінити роль')}
                className="grid size-8 place-items-center rounded-lg text-white/60 hover:text-white"
            >
                <Pencil className="size-4" />
            </button>
            <button
                type="button"
                onClick={() => {
                    if (
                        confirm(
                            tr(
                                'Видалити роль «{name}»? Вона зникне в усіх, кому видана.',
                                { name: role.name },
                            ),
                        )
                    ) {
                        router.delete(`/admin/roles/${role.id}`, {
                            preserveScroll: true,
                        });
                    }
                }}
                aria-label={tr('Видалити роль')}
                className="grid size-8 place-items-center rounded-lg text-white/60 hover:text-rose-400"
            >
                <Trash2 className="size-4" />
            </button>
        </li>
    );
}

function RoleForm({
    role,
    kind,
    rules,
    icons,
    colors,
    achievements,
    onDone,
}: {
    role: Role | null;
    kind: string;
    kinds: Record<string, string>;
    rules: Record<string, string>;
    icons: string[];
    colors: string[];
    achievements: { key: string; title: string }[];
    onDone: () => void;
}) {
    const form = useForm({
        name: role?.name ?? '',
        kind,
        color: role?.color ?? colors[0] ?? 'sky',
        icon: role?.icon ?? '',
        priority: role?.priority ?? 100,
        rule: role?.rule ?? KIND_RULE[kind] ?? 'manual',
        rule_value: role?.rule_value ?? '',
        description: role?.description ?? '',
        active_from: role?.active_from ?? '',
        active_until: role?.active_until ?? '',
    });
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.transform((d) => ({
            ...d,
            icon: d.icon || null,
            rule_value: d.rule_value || null,
            description: d.description || null,
            active_from: d.active_from || null,
            active_until: d.active_until || null,
        }));
        const options = { preserveScroll: true, onSuccess: onDone };
        if (role) {
            form.put(`/admin/roles/${role.id}`, options);
        } else {
            form.post('/admin/roles', options);
        }
    };
    const needsNumber = ['account_years', 'level', 'spent'].includes(
        form.data.rule,
    );
    const error = Object.values(form.errors)[0];

    return (
        <form
            onSubmit={submit}
            className="mt-3 space-y-3 rounded-xl bg-white/[0.03] p-3"
        >
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    maxLength={30}
                    placeholder={tr('Назва, наприклад «Big Sponsor»')}
                    aria-label={tr('Назва ролі')}
                    className="h-10 min-w-[200px] flex-1"
                />
                <RoleChip
                    role={{
                        name: form.data.name || tr('Роль'),
                        color: form.data.color,
                        icon: form.data.icon || null,
                        description: null,
                    }}
                    className="px-2 py-1 text-xs"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => form.setData('color', c)}
                        aria-label={c}
                        aria-pressed={form.data.color === c}
                        className={cn(
                            'h-7 rounded-lg px-2.5 text-[11px] font-semibold',
                            titleColor(c),
                            form.data.color === c && 'ring-2 ring-white/60',
                        )}
                    >
                        Aa
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
                <button
                    type="button"
                    onClick={() => form.setData('icon', '')}
                    aria-pressed={form.data.icon === ''}
                    className={cn(
                        'h-8 rounded-lg px-2.5 text-xs',
                        form.data.icon === ''
                            ? 'bg-sky-500/25 text-white'
                            : 'gc-solid-2 text-white/55',
                    )}
                >
                    {tr('Без іконки')}
                </button>
                {icons.map((name) => {
                    const Icon = ROLE_ICONS[name];
                    if (!Icon) return null;

                    return (
                        <button
                            key={name}
                            type="button"
                            onClick={() => form.setData('icon', name)}
                            aria-label={name}
                            aria-pressed={form.data.icon === name}
                            className={cn(
                                'grid size-8 place-items-center rounded-lg',
                                form.data.icon === name
                                    ? 'bg-sky-500/25 text-white'
                                    : 'gc-solid-2 text-white/55 hover:text-white',
                            )}
                        >
                            <Icon className="size-4" />
                        </button>
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-2">
                <select
                    value={form.data.rule}
                    onChange={(e) => {
                        form.setData((d) => ({
                            ...d,
                            rule: e.target.value,
                            rule_value: '',
                        }));
                    }}
                    className={selectClass}
                    aria-label={tr('Як видається')}
                >
                    {Object.entries(rules).map(([key, label]) => (
                        <option key={key} value={key}>
                            {tr(label)}
                        </option>
                    ))}
                </select>
                {needsNumber && (
                    <Input
                        type="number"
                        min={1}
                        value={form.data.rule_value}
                        onChange={(e) =>
                            form.setData('rule_value', e.target.value)
                        }
                        placeholder={tr('Поріг')}
                        aria-label={tr('Поріг')}
                        className="h-10 w-28"
                    />
                )}
                {form.data.rule === 'achievement' && (
                    <select
                        value={form.data.rule_value}
                        onChange={(e) =>
                            form.setData('rule_value', e.target.value)
                        }
                        className={selectClass}
                        aria-label={tr('Досягнення')}
                    >
                        <option value="">{tr('Оберіть досягнення')}</option>
                        {achievements.map((a) => (
                            <option key={a.key} value={a.key}>
                                {a.title}
                            </option>
                        ))}
                    </select>
                )}
                <Input
                    type="number"
                    min={0}
                    max={999}
                    value={form.data.priority}
                    onChange={(e) =>
                        form.setData('priority', Number(e.target.value))
                    }
                    title={tr('Порядок: менше — показується першою')}
                    aria-label={tr('Порядок')}
                    className="h-10 w-24"
                />
            </div>
            {kind === 'holiday' && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
                    {tr('Діє з')}
                    <Input
                        type="date"
                        value={form.data.active_from}
                        onChange={(e) =>
                            form.setData('active_from', e.target.value)
                        }
                        className="h-10 w-40"
                    />
                    {tr('до')}
                    <Input
                        type="date"
                        value={form.data.active_until}
                        onChange={(e) =>
                            form.setData('active_until', e.target.value)
                        }
                        className="h-10 w-40"
                    />
                </div>
            )}
            <Input
                value={form.data.description}
                onChange={(e) => form.setData('description', e.target.value)}
                maxLength={160}
                placeholder={tr('Підказка при наведенні (необов’язково)')}
                aria-label={tr('Опис ролі')}
                className="h-10"
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={
                        form.processing || form.data.name.trim().length < 2
                    }
                    className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                    {role ? tr('Зберегти роль') : tr('Створити роль')}
                </button>
                <button
                    type="button"
                    onClick={onDone}
                    className="h-10 rounded-xl px-3 text-sm text-white/60 hover:text-white"
                >
                    {tr('Скасувати')}
                </button>
            </div>
        </form>
    );
}

/** Хто має роль: видати за ніком, забрати. Ролі «GameCon+» і «стаж» рахуються самі. */
function MembersPanel({ role, members }: { role: Role; members: Member[] }) {
    const form = useForm({ username: '' });
    const grant = (e: FormEvent) => {
        e.preventDefault();
        form.post(`/admin/roles/${role.id}/grant`, {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };
    const live = role.rule === 'plus' || role.rule === 'account_years';

    return (
        <div className="mt-3 rounded-xl bg-white/[0.03] p-3">
            {live && (
                <p className="mb-3 text-xs text-white/50">
                    {tr(
                        'Цю роль бачать усі, хто підходить під правило, — список нижче лише для виданих вручну.',
                    )}
                </p>
            )}
            <form onSubmit={grant} className="flex flex-wrap gap-2">
                <Input
                    value={form.data.username}
                    onChange={(e) => form.setData('username', e.target.value)}
                    placeholder={tr('@нік людини')}
                    className="h-10 min-w-[180px] flex-1"
                />
                <button
                    type="submit"
                    disabled={form.processing || !form.data.username.trim()}
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus className="size-4" /> {tr('Видати')}
                </button>
            </form>
            {form.errors.username && (
                <p className="mt-2 text-sm text-rose-400">
                    {form.errors.username}
                </p>
            )}
            {members.length === 0 ? (
                <p className="mt-3 text-sm text-white/45">
                    {tr('Роль ще нікому не видана.')}
                </p>
            ) : (
                <ul className="mt-3 space-y-1.5">
                    {members.map((m) => (
                        <li
                            key={m.id}
                            className="flex items-center gap-3 rounded-lg px-1 py-1"
                        >
                            <UserAvatar user={m} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-sm text-white">
                                {m.name}{' '}
                                <span className="text-white/45">
                                    @{m.username}
                                </span>
                            </span>
                            <span className="text-[11px] text-white/40">
                                {m.auto ? tr('автоматично') : tr('вручну')}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    router.delete(
                                        `/admin/roles/${role.id}/users/${m.id}`,
                                        { preserveScroll: true },
                                    )
                                }
                                aria-label={tr('Забрати роль')}
                                className="grid size-8 place-items-center rounded-lg text-white/60 hover:text-rose-400"
                            >
                                <UserMinus className="size-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

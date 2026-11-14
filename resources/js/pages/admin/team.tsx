import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { titleColor } from '@/components/gc/user-title';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Member = UserCard & {
    role: string;
    staff_role_id: number | null;
    own_sections: string[];
    sections: string[];
};

type StaffRole = {
    id: number;
    name: string;
    color: string;
    sections: string[];
    members: number;
};

/** Команда: ролі команди (назва, колір, розділи), люди в команді й розділи, доручені модераторам. */
export default function AdminTeam({
    staff,
    sections,
    roles,
    colors,
}: {
    staff: Member[];
    sections: Record<string, string>;
    roles: StaffRole[];
    colors: string[];
}) {
    const form = useForm({ username: '' });
    const add = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/team', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title={tr('Команда — Адмін-панель')} />
            <PageHeader
                title={tr('Команда')}
                description={tr(
                    'Адміністратори бачать усю адмінку. Модераторам відкривайте лише потрібні розділи — гроші, ключі, налаштування й користувачі лишаються за адміністраторами.',
                )}
            />

            <RolesCard roles={roles} sections={sections} colors={colors} />

            <form
                onSubmit={add}
                className="gc-solid mb-5 flex flex-wrap gap-2 rounded-2xl p-3"
            >
                <Input
                    value={form.data.username}
                    onChange={(e) => form.setData('username', e.target.value)}
                    placeholder={tr('@нік людини')}
                    className="h-10 min-w-[200px] flex-1"
                />
                <button
                    type="submit"
                    disabled={form.processing || !form.data.username.trim()}
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus className="size-4" /> {tr('Додати модератора')}
                </button>
            </form>
            <div className="space-y-3">
                {staff.map((member) => (
                    <TeamRow
                        key={member.id}
                        member={member}
                        sections={sections}
                        roles={roles}
                    />
                ))}
            </div>
        </>
    );
}

/** Вибір розділів адмінки кнопками. */
function SectionPicker({
    sections,
    picked,
    onChange,
}: {
    sections: Record<string, string>;
    picked: string[];
    onChange: (next: string[]) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {Object.entries(sections).map(([key, label]) => {
                const on = picked.includes(key);

                return (
                    <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                            onChange(
                                on
                                    ? picked.filter((s) => s !== key)
                                    : [...picked, key],
                            )
                        }
                        className={cn(
                            'h-8 rounded-lg px-2.5 text-xs transition',
                            on
                                ? 'bg-sky-500/25 text-white'
                                : 'gc-solid-2 text-white/55 hover:text-white',
                        )}
                    >
                        {tr(label)}
                    </button>
                );
            })}
        </div>
    );
}

/** Ролі команди: створити, змінити назву, колір і розділи, видалити. */
function RolesCard({
    roles,
    sections,
    colors,
}: {
    roles: StaffRole[];
    sections: Record<string, string>;
    colors: string[];
}) {
    const [editing, setEditing] = useState<StaffRole | 'new' | null>(null);

    return (
        <section className="gc-solid mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <h2 className="flex-1 font-display text-base font-bold text-white">
                    {tr('Ролі команди')}
                </h2>
                <button
                    type="button"
                    onClick={() => setEditing('new')}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white"
                >
                    <Plus className="size-4" /> {tr('Нова роль')}
                </button>
            </div>
            <p className="mt-1 text-xs text-white/45">
                {tr(
                    'Назва ролі показується біля ніка людини, а розділи ролі відкриваються модераторам разом з особистими.',
                )}
            </p>
            {roles.length === 0 && editing === null && (
                <p className="mt-3 text-sm text-white/45">
                    {tr('Ролей ще немає — наприклад, «Модератор чатів».')}
                </p>
            )}
            <ul className="mt-3 space-y-2">
                {roles.map((r) => (
                    <li
                        key={r.id}
                        className="gc-solid-2 flex flex-wrap items-center gap-2 rounded-xl p-3"
                    >
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
                                titleColor(r.color),
                            )}
                        >
                            <ShieldCheck className="size-3.5" /> {r.name}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-white/45">
                            {r.sections.length > 0
                                ? r.sections
                                      .map((s) => tr(sections[s] ?? s))
                                      .join(', ')
                                : tr('Без розділів адмінки')}
                            {' · '}
                            {tr('людей: {n}', { n: r.members })}
                        </span>
                        <button
                            type="button"
                            onClick={() => setEditing(r)}
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
                                            'Видалити роль «{name}»? Люди лишаться в команді без цієї назви.',
                                            { name: r.name },
                                        ),
                                    )
                                ) {
                                    router.delete(`/admin/team/roles/${r.id}`, {
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
                ))}
            </ul>
            {editing !== null && (
                <RoleForm
                    key={editing === 'new' ? 'new' : editing.id}
                    role={editing === 'new' ? null : editing}
                    sections={sections}
                    colors={colors}
                    onDone={() => setEditing(null)}
                />
            )}
        </section>
    );
}

function RoleForm({
    role,
    sections,
    colors,
    onDone,
}: {
    role: StaffRole | null;
    sections: Record<string, string>;
    colors: string[];
    onDone: () => void;
}) {
    const form = useForm({
        name: role?.name ?? '',
        color: role?.color ?? colors[0] ?? 'sky',
        sections: role?.sections ?? [],
    });
    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onDone };
        if (role) {
            form.put(`/admin/team/roles/${role.id}`, options);
        } else {
            form.post('/admin/team/roles', options);
        }
    };

    return (
        <form
            onSubmit={submit}
            className="mt-3 space-y-3 rounded-xl bg-white/[0.03] p-3"
        >
            <Input
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
                maxLength={40}
                placeholder={tr('Назва ролі, наприклад «Модератор чатів»')}
                aria-label={tr('Назва ролі')}
                className="h-10"
            />
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
            <SectionPicker
                sections={sections}
                picked={form.data.sections}
                onChange={(next) => form.setData('sections', next)}
            />
            {form.errors.name && (
                <p className="text-sm text-rose-400">{form.errors.name}</p>
            )}
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

function TeamRow({
    member,
    sections,
    roles,
}: {
    member: Member;
    sections: Record<string, string>;
    roles: StaffRole[];
}) {
    const [role, setRole] = useState(member.role);
    const [staffRole, setStaffRole] = useState<number | null>(
        member.staff_role_id,
    );
    const [picked, setPicked] = useState<string[]>(member.own_sections);
    const dirty =
        role !== member.role ||
        staffRole !== member.staff_role_id ||
        picked.slice().sort().join() !==
            member.own_sections.slice().sort().join();

    const save = () =>
        router.put(
            `/admin/team/${member.username}`,
            { role, sections: picked, staff_role_id: staffRole },
            { preserveScroll: true },
        );

    return (
        <article className="gc-solid rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3">
                <UserAvatar user={member} size="md" />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                        {member.name}
                    </p>
                    <p className="text-xs text-white/45">@{member.username}</p>
                </div>
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={selectClass}
                    aria-label={tr('Рівень доступу')}
                >
                    <option value="admin">{tr('Адміністратор')}</option>
                    <option value="moderator">{tr('Модератор')}</option>
                    <option value="user">{tr('Не в команді')}</option>
                </select>
                {role !== 'user' && (
                    <select
                        value={staffRole ?? ''}
                        onChange={(e) =>
                            setStaffRole(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        className={selectClass}
                        aria-label={tr('Роль команди')}
                    >
                        <option value="">{tr('Без назви ролі')}</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                )}
                <button
                    type="button"
                    onClick={save}
                    disabled={!dirty}
                    className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                    {tr('Зберегти')}
                </button>
            </div>
            {role === 'moderator' && (
                <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-white/45">
                        {tr('Особисті розділи (додаються до розділів ролі)')}
                    </p>
                    <SectionPicker
                        sections={sections}
                        picked={picked}
                        onChange={setPicked}
                    />
                </div>
            )}
        </article>
    );
}

import { Head, router, useForm } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, selectClass } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Member = UserCard & { role: string; sections: string[] };

/** Команда: ролі й розділи адмінки, доручені модераторам. */
export default function AdminTeam({
    staff,
    sections,
}: {
    staff: Member[];
    sections: Record<string, string>;
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
            <form
                onSubmit={add}
                className="glass mb-5 flex flex-wrap gap-2 rounded-2xl p-3"
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
                    />
                ))}
            </div>
        </>
    );
}

function TeamRow({
    member,
    sections,
}: {
    member: Member;
    sections: Record<string, string>;
}) {
    const [role, setRole] = useState(member.role);
    const [picked, setPicked] = useState<string[]>(member.sections);
    const dirty =
        role !== member.role ||
        picked.slice().sort().join() !== member.sections.slice().sort().join();

    const save = () =>
        router.put(
            `/admin/team/${member.username}`,
            { role, sections: picked },
            { preserveScroll: true },
        );

    return (
        <article className="glass rounded-2xl p-4">
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
                    aria-label={tr('Роль')}
                >
                    <option value="admin">{tr('Адміністратор')}</option>
                    <option value="moderator">{tr('Модератор')}</option>
                    <option value="user">{tr('Не в команді')}</option>
                </select>
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
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(sections).map(([key, label]) => {
                        const on = picked.includes(key);

                        return (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    setPicked(
                                        on
                                            ? picked.filter((s) => s !== key)
                                            : [...picked, key],
                                    )
                                }
                                className={cn(
                                    'h-8 rounded-lg px-2.5 text-xs transition',
                                    on
                                        ? 'bg-sky-500/25 text-white'
                                        : 'bg-white/[0.05] text-white/55 hover:text-white',
                                )}
                            >
                                {tr(label)}
                            </button>
                        );
                    })}
                </div>
            )}
        </article>
    );
}

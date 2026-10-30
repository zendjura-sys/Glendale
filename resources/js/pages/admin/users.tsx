import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BadgeCheck,
    Ban,
    Check,
    KeyRound,
    MoreHorizontal,
    Search,
    ShieldCheck,
    Trash2,
    Undo2,
    UserCog,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    PageHeader,
    Pagination,
    Pill,
    selectClass,
} from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatDate, timeAgo } from '@/lib/format';
import type { Paginated, UserCard } from '@/types';
import { tr } from '@/lib/i18n';
import { SpellcheckHints, useSpellcheck } from '@/components/gc/spellcheck';

type AdminUser = UserCard & {
    email: string;
    role: string;
    city: string | null;
    posts_count: number;
    banned_at: string | null;
    ban_reason: string | null;
    last_seen_at: string | null;
    created_at: string;
    email_verified: boolean;
    two_factor: boolean;
};

type Props = {
    users: Paginated<AdminUser>;
    filters: { q: string; role: string; status: string; sort: string };
    roles: string[];
};

const ROLE_LABELS: Record<string, string> = {
    admin: tr('Адміністратор'),
    moderator: tr('Модератор'),
    user: tr('Учасник'),
};

function RolePill({ role }: { role: string }) {
    if (role === 'admin') {
        return (
            <Pill tone="gold">
                <ShieldCheck className="size-3" /> {tr('Адмін')}
            </Pill>
        );
    }

    if (role === 'moderator') {
        return <Pill tone="violet">{tr('Модератор')}</Pill>;
    }

    return <Pill>{tr('Учасник')}</Pill>;
}

export default function AdminUsers({ users, filters, roles }: Props) {
    const { auth } = usePage().props;
    const [q, setQ] = useState(filters.q);
    const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
    const [banReason, setBanReason] = useState('');
    const banSpell = useSpellcheck(banReason);
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

    const apply = (patch: Partial<Props['filters']>) => {
        router.get(
            '/admin/users',
            { ...filters, q, ...patch },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submitSearch = (e: FormEvent) => {
        e.preventDefault();
        apply({ q });
    };

    const update = (
        user: AdminUser,
        data: Record<string, string | boolean | null>,
    ) => {
        router.patch(`/admin/users/${user.username}`, data, {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={tr('Користувачі — Адмін-панель')} />
            <PageHeader
                title={tr('Користувачі')}
                description={tr('Усього {total}', { total: users.total })}
            />

            <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <form
                    onSubmit={submitSearch}
                    className="relative min-w-[220px] flex-1"
                >
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr("Ім'я, логін, email або ID")}
                        className="h-10 pl-10"
                    />
                </form>
                <select
                    value={filters.role}
                    onChange={(e) => apply({ role: e.target.value })}
                    className={selectClass}
                >
                    <option value="">{tr('Усі ролі')}</option>
                    {roles.map((r) => (
                        <option key={r} value={r}>
                            {ROLE_LABELS[r] ?? r}
                        </option>
                    ))}
                </select>
                <select
                    value={filters.status}
                    onChange={(e) => apply({ status: e.target.value })}
                    className={selectClass}
                >
                    <option value="">{tr('Будь-який статус')}</option>
                    <option value="active">{tr('Активні')}</option>
                    <option value="online">{tr('Онлайн')}</option>
                    <option value="verified">{tr('Верифіковані')}</option>
                    <option value="banned">{tr('Заблоковані')}</option>
                </select>
                <select
                    value={filters.sort}
                    onChange={(e) => apply({ sort: e.target.value })}
                    className={selectClass}
                >
                    <option value="newest">{tr('Спочатку нові')}</option>
                    <option value="oldest">{tr('Спочатку старі')}</option>
                    <option value="last_seen">{tr('За активністю')}</option>
                    <option value="name">{tr("За ім'ям")}</option>
                </select>
            </div>

            <div className="glass overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.06] text-left text-xs text-white/35">
                                <th className="px-5 py-3 font-medium">
                                    {tr('Користувач')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Роль')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Статус')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Записи')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Активність')}
                                </th>
                                <th className="px-3 py-3 font-medium">
                                    {tr('Реєстрація')}
                                </th>
                                <th className="w-12 px-3 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {users.data.map((u) => {
                                const self = u.id === auth.user.id;

                                return (
                                    <tr
                                        key={u.id}
                                        className="transition hover:bg-white/[0.02]"
                                    >
                                        <td className="px-5 py-3">
                                            <Link
                                                href={`/${u.username}`}
                                                className="flex items-center gap-3"
                                            >
                                                <UserAvatar
                                                    user={u}
                                                    size="sm"
                                                />
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-1 font-medium text-white">
                                                        {u.name}
                                                        {u.is_verified && (
                                                            <VerifiedBadge
                                                                kind={
                                                                    u.verified_kind
                                                                }
                                                                className="size-3.5"
                                                            />
                                                        )}
                                                    </span>
                                                    <span className="block truncate text-xs text-white/40">
                                                        @{u.username} ·{' '}
                                                        {u.email}
                                                    </span>
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3">
                                            <RolePill role={u.role} />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {u.banned_at ? (
                                                    <Pill tone="red">
                                                        <Ban className="size-3" />{' '}
                                                        {tr('Бан')}
                                                    </Pill>
                                                ) : u.is_online ? (
                                                    <Pill tone="green">
                                                        {tr('Онлайн')}
                                                    </Pill>
                                                ) : (
                                                    <Pill>
                                                        {tr('Активний')}
                                                    </Pill>
                                                )}
                                                {u.two_factor && (
                                                    <Pill tone="blue">
                                                        <KeyRound className="size-3" />{' '}
                                                        2FA
                                                    </Pill>
                                                )}
                                            </div>
                                            {u.ban_reason && (
                                                <div className="mt-1 max-w-[180px] truncate text-xs text-rose-200/60">
                                                    {u.ban_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-white/70">
                                            {u.posts_count}
                                        </td>
                                        <td className="px-3 py-3 text-xs whitespace-nowrap text-white/50">
                                            {u.is_online
                                                ? tr('зараз')
                                                : u.last_seen_at
                                                  ? timeAgo(u.last_seen_at)
                                                  : '—'}
                                        </td>
                                        <td className="px-3 py-3 text-xs whitespace-nowrap text-white/50">
                                            {formatDate(u.created_at)}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-lg text-white/50 outline-none hover:bg-white/[0.06] hover:text-white">
                                                    <MoreHorizontal className="size-4" />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="glass-strong w-56 rounded-2xl border-white/10 p-1.5 text-white"
                                                >
                                                    <DropdownMenuLabel className="text-xs text-white/40">
                                                        <UserCog className="mr-1 inline size-3.5" />{' '}
                                                        {tr('Роль')}
                                                    </DropdownMenuLabel>
                                                    {roles.map((r) => (
                                                        <DropdownMenuItem
                                                            key={r}
                                                            disabled={
                                                                self ||
                                                                u.role === r
                                                            }
                                                            onSelect={() =>
                                                                update(u, {
                                                                    role: r,
                                                                })
                                                            }
                                                            className="rounded-lg focus:bg-white/[0.06]"
                                                        >
                                                            {ROLE_LABELS[r] ??
                                                                r}
                                                            {u.role === r && (
                                                                <Check className="ml-auto size-4 text-gc-lilac-400" />
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                    <DropdownMenuSeparator className="bg-white/5" />
                                                    <DropdownMenuItem
                                                        onSelect={() =>
                                                            update(u, {
                                                                is_verified:
                                                                    !u.is_verified,
                                                            })
                                                        }
                                                        className="rounded-lg focus:bg-white/[0.06]"
                                                    >
                                                        <BadgeCheck />{' '}
                                                        {u.is_verified
                                                            ? tr(
                                                                  'Зняти верифікацію',
                                                              )
                                                            : tr(
                                                                  'Верифікувати',
                                                              )}
                                                    </DropdownMenuItem>
                                                    {u.banned_at ? (
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                update(u, {
                                                                    banned: false,
                                                                })
                                                            }
                                                            className="rounded-lg focus:bg-white/[0.06]"
                                                        >
                                                            <Undo2 />{' '}
                                                            {tr('Розблокувати')}
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem
                                                            disabled={self}
                                                            onSelect={() => {
                                                                setBanReason(
                                                                    '',
                                                                );
                                                                setBanTarget(u);
                                                            }}
                                                            className="rounded-lg text-amber-200 focus:bg-amber-300/10"
                                                        >
                                                            <Ban className="text-amber-200" />{' '}
                                                            {tr('Заблокувати')}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator className="bg-white/5" />
                                                    <DropdownMenuItem
                                                        disabled={self}
                                                        onSelect={() =>
                                                            setDeleteTarget(u)
                                                        }
                                                        className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                                    >
                                                        <Trash2 className="text-rose-300" />{' '}
                                                        {tr('Видалити')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {users.data.length === 0 && (
                    <div className="px-6 py-14 text-center text-sm text-white/40">
                        {tr('Нікого не знайдено')}
                    </div>
                )}
            </div>

            <Pagination data={users} />

            <Dialog
                open={!!banTarget}
                onOpenChange={(open) => !open && setBanTarget(null)}
            >
                <DialogContent className="glass-strong rounded-dialog border-white/10 text-white">
                    <DialogTitle>
                        {tr('Заблокувати')} {banTarget?.name}?
                    </DialogTitle>
                    <DialogDescription className="text-white/50">
                        {tr(
                            'Користувача буде розлогінено, він не зможе увійти до розблокування.',
                        )}
                    </DialogDescription>
                    <Input
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder={tr("Причина (необов'язково)")}
                        maxLength={255}
                    />
                    <SpellcheckHints
                        spell={banSpell}
                        onApply={setBanReason}
                        className="mt-0"
                    />
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="secondary">
                                {tr('Скасувати')}
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (banTarget) {
                                    update(banTarget, {
                                        banned: true,
                                        ban_reason: banReason || null,
                                    });
                                }

                                setBanTarget(null);
                            }}
                        >
                            {tr('Заблокувати')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent className="glass-strong rounded-dialog border-white/10 text-white">
                    <DialogTitle>
                        {tr('Видалити')} {deleteTarget?.name}?
                    </DialogTitle>
                    <DialogDescription className="text-white/50">
                        {tr(
                            'Акаунт, записи, коментарі та дружби буде видалено назавжди.',
                        )}
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="secondary">
                                {tr('Скасувати')}
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (deleteTarget) {
                                    router.delete(
                                        `/admin/users/${deleteTarget.username}`,
                                        { preserveScroll: true },
                                    );
                                }

                                setDeleteTarget(null);
                            }}
                        >
                            {tr('Видалити назавжди')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

import { Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    Ellipsis,
    MapPin,
    MessageCircle,
    Tag,
    UserMinus,
    UserRound,
    X,
} from 'lucide-react';
import { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { friendListAllowed } from '@/lib/modes';
import { cn } from '@/lib/utils';
import type { FriendList, PersonCard as Person } from '@/types';
import { FriendButton } from './friend-button';
import { nameDisplayProps, PlusBadge } from './plus';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';

const listLabel: Record<FriendList, string> = {
    raid: tr('Рейд'),
    cinema: tr('Кіно'),
    work: tr('Робота'),
};

/** Компактна строка друга — список за замовчуванням на телефоні. */
export function FriendListRow({ person }: { person: Person }) {
    const { modules } = usePage().props;
    const [busy, setBusy] = useState(false);
    const opts = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    const subtitle = person.mutual
        ? `${person.mutual} ${plural(person.mutual, [
              'спільний друг',
              'спільні друзі',
              'спільних друзів',
          ])}`
        : person.city
          ? person.city
          : `@${person.username}`;

    return (
        <div className="gc-list-row">
            <Link
                href={`/${person.username}`}
                prefetch="hover"
                cacheFor="1m"
                className="shrink-0"
            >
                <UserAvatar
                    user={person}
                    size="md"
                    className="!size-12"
                    showOnline
                />
            </Link>

            <div className="min-w-0 flex-1">
                <Link
                    href={`/${person.username}`}
                    prefetch="hover"
                    cacheFor="1m"
                    className="flex min-w-0 items-center gap-1"
                >
                    <span
                        {...nameDisplayProps(person.plus)}
                        className={cn(
                            'truncate text-[13px] font-semibold text-white',
                            nameDisplayProps(person.plus).className,
                        )}
                    >
                        {person.alias || person.name}
                    </span>
                    {person.is_verified && (
                        <VerifiedBadge
                            kind={person.verified_kind}
                            className="size-3.5 shrink-0"
                        />
                    )}
                    {person.plus && <PlusBadge className="size-3.5 shrink-0" />}
                    {person.list && friendListAllowed(person.list, modules) && (
                        <span className="ml-0.5 shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/60">
                            {listLabel[person.list]}
                        </span>
                    )}
                </Link>
                <p className="mt-0.5 truncate text-[11px] text-white/45">
                    {person.city ? (
                        <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3 opacity-70" />
                            {subtitle}
                        </span>
                    ) : (
                        subtitle
                    )}
                </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                {person.relation === 'incoming' ? (
                    <>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                router.post(
                                    `/friends/${person.username}/accept`,
                                    {},
                                    opts,
                                )
                            }
                            className="flex h-8 items-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                            <Check className="size-3.5" />
                            {tr('Прийняти')}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            aria-label={tr('Відхилити')}
                            onClick={() =>
                                router.delete(
                                    `/friends/${person.username}`,
                                    opts,
                                )
                            }
                            className="flex size-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-white/70 transition hover:bg-white/[0.12] disabled:opacity-50"
                        >
                            <X className="size-3.5" />
                        </button>
                    </>
                ) : (
                    <>
                        <Link
                            href={`/messages/with/${person.username}`}
                            aria-label={tr('Написати')}
                            className="flex size-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-white/80 transition hover:bg-white/[0.12]"
                        >
                            <MessageCircle className="size-3.5" />
                        </Link>
                        {person.relation === 'friends' ? (
                            <FriendRowMenu person={person} />
                        ) : person.relation ? (
                            <FriendButton
                                username={person.username}
                                relation={person.relation}
                                size="sm"
                            />
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

function FriendRowMenu({ person }: { person: Person }) {
    const [markOpen, setMarkOpen] = useState(false);
    const [nickname, setNickname] = useState(person.alias ?? '');
    const [note, setNote] = useState(person.note ?? '');
    const [list, setList] = useState<FriendList | ''>(person.list ?? '');
    const { modules } = usePage().props;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-2.5 text-[11px] font-medium text-white/75 transition outline-none hover:bg-white/[0.1]">
                {tr('У друзях')}
                <Ellipsis className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="glass-strong w-56 rounded-xl p-1 text-white"
            >
                {person.markable && (
                    <DropdownMenuItem
                        className="rounded-lg"
                        onSelect={(e) => {
                            e.preventDefault();
                            setMarkOpen(true);
                        }}
                    >
                        <Tag className="size-4" />
                        {tr('Змінити позначку')}
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    className="rounded-lg"
                    onSelect={() => router.visit(`/${person.username}`)}
                >
                    <UserRound className="size-4" />
                    {tr('Перейти в профіль')}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                    className="rounded-lg text-red-400 focus:bg-red-500/10 focus:text-red-400"
                    onSelect={() =>
                        router.delete(`/friends/${person.username}`, {
                            preserveScroll: true,
                        })
                    }
                >
                    <UserMinus className="size-4 text-red-400" />
                    {tr('Видалити з друзів')}
                </DropdownMenuItem>
            </DropdownMenuContent>
            {markOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
                    <form
                        className="gc-solid w-full max-w-sm space-y-2 rounded-2xl p-3.5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            router.put(
                                `/friends/${person.username}/mark`,
                                {
                                    nickname,
                                    note,
                                    list: list || null,
                                },
                                {
                                    preserveScroll: true,
                                    onSuccess: () => setMarkOpen(false),
                                },
                            );
                        }}
                    >
                        <p className="text-sm font-semibold text-white">
                            {tr('Змінити позначку')}
                        </p>
                        <input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            maxLength={40}
                            placeholder={tr('Своє ім’я')}
                            className="input-glass h-9 w-full rounded-xl px-3 text-xs text-white placeholder:text-white/30 focus:outline-none"
                        />
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={280}
                            placeholder={tr('Нотатка лише для вас')}
                            className="input-glass h-9 w-full rounded-xl px-3 text-xs text-white placeholder:text-white/30 focus:outline-none"
                        />
                        <select
                            value={list}
                            onChange={(e) =>
                                setList(e.target.value as FriendList | '')
                            }
                            className="input-glass h-9 w-full rounded-xl px-3 text-xs text-white focus:outline-none"
                        >
                            <option value="">{tr('Без списку')}</option>
                            {friendListAllowed('raid', modules) && (
                                <option value="raid">{tr('Рейд')}</option>
                            )}
                            {friendListAllowed('cinema', modules) && (
                                <option value="cinema">{tr('Кіно')}</option>
                            )}
                            <option value="work">{tr('Робота')}</option>
                        </select>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setMarkOpen(false)}
                                className="h-9 flex-1 rounded-xl bg-white/[0.06] text-xs font-medium text-white/70"
                            >
                                {tr('Скасувати')}
                            </button>
                            <button
                                type="submit"
                                className="h-9 flex-1 rounded-xl bg-white text-xs font-semibold text-black"
                            >
                                {tr('Зберегти')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </DropdownMenu>
    );
}

import { Link, router } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { plural } from '@/lib/format';
import type { FriendList, PersonCard as Person } from '@/types';
import { FriendButton } from './friend-button';
import { PlayingBadge } from './playing';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';
import { PlusBadge, plusNameStyle } from './plus';
import { tr } from '@/lib/i18n';

const listLabel: Record<FriendList, string> = {
    raid: tr('Рейд'),
    cinema: tr('Кіно'),
    work: tr('Робота'),
};

export function PersonCard({ person }: { person: Person }) {
    return (
        <div className="glass group relative flex flex-col items-center overflow-hidden rounded-2xl p-5 text-center transition hover:-translate-y-0.5 hover:border-white/15">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-gc-indigo/20 to-transparent opacity-0 transition group-hover:opacity-100" />
            <Link href={`/${person.username}`} className="relative">
                <UserAvatar user={person} size="xl" />
            </Link>
            <Link
                href={`/${person.username}`}
                className="relative mt-3 flex max-w-full flex-wrap items-center justify-center gap-1 text-[15px] font-semibold break-words text-white hover:underline"
            >
                <span
                    className="break-words"
                    style={plusNameStyle(person.plus)}
                >
                    {person.alias || person.name}
                </span>
                {person.is_verified && <VerifiedBadge />}
                {person.plus && <PlusBadge />}
            </Link>
            {person.alias && (
                <p className="relative mt-0.5 text-xs break-words text-white/40">
                    {person.name}
                </p>
            )}
            {person.list && (
                <span className="relative mt-1 rounded-chip bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                    {listLabel[person.list]}
                </span>
            )}
            {person.note && (
                <p className="relative mt-1 line-clamp-2 text-xs text-white/55">
                    {person.note}
                </p>
            )}
            {person.playing && (
                <PlayingBadge
                    playing={person.playing}
                    className="relative mt-1.5"
                />
            )}
            <div className="relative mt-1 min-h-5 text-xs text-white/45">
                {person.mutual ? (
                    <span>
                        {person.mutual}{' '}
                        {plural(person.mutual, [
                            'спільний друг',
                            'спільні друзі',
                            'спільних друзів',
                        ])}
                    </span>
                ) : person.city ? (
                    <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {person.city}
                    </span>
                ) : (
                    <span>@{person.username}</span>
                )}
            </div>
            {person.relation && (
                <div className="relative mt-4 w-full space-y-2">
                    <FriendButton
                        username={person.username}
                        relation={person.relation}
                        size="sm"
                        className="w-full"
                    />
                    {person.markable && <FriendMarkForm person={person} />}
                </div>
            )}
        </div>
    );
}

function FriendMarkForm({ person }: { person: Person }) {
    const [open, setOpen] = useState(false);
    const [nickname, setNickname] = useState(person.alias ?? '');
    const [note, setNote] = useState(person.note ?? '');
    const [list, setList] = useState<FriendList | ''>(person.list ?? '');

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-xs text-white/45 hover:text-white"
            >
                {tr('Позначка')}
            </button>
        );
    }

    return (
        <form
            className="space-y-1.5 text-left"
            onSubmit={(event) => {
                event.preventDefault();
                router.put(
                    `/friends/${person.username}/mark`,
                    { nickname, note, list: list || null },
                    { preserveScroll: true, onSuccess: () => setOpen(false) },
                );
            }}
        >
            <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={40}
                placeholder={tr('Своє ім’я')}
                className="input-glass h-8 w-full rounded-lg px-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
            <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={280}
                placeholder={tr('Нотатка лише для вас')}
                className="input-glass h-8 w-full rounded-lg px-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
            <select
                value={list}
                onChange={(event) =>
                    setList(event.target.value as FriendList | '')
                }
                className="input-glass h-8 w-full rounded-lg px-2 text-xs text-white focus:outline-none"
            >
                <option value="">{tr('Без списку')}</option>
                <option value="raid">{tr('Рейд')}</option>
                <option value="cinema">{tr('Кіно')}</option>
                <option value="work">{tr('Робота')}</option>
            </select>
            <button
                type="submit"
                className="h-8 w-full rounded-lg bg-white text-xs font-medium text-black"
            >
                {tr('Зберегти')}
            </button>
        </form>
    );
}

export function PersonRow({
    person,
    action,
}: {
    person: Person;
    action?: React.ReactNode;
}) {
    return (
        // Кнопка дії переноситься під ім'я, коли колонка вузька, — ім'я й підпис лишаються в один рядок.
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-2 py-2 transition hover:bg-white/[0.035]">
            <Link href={`/${person.username}`} className="shrink-0">
                <UserAvatar user={person} size="md" />
            </Link>
            <div className="min-w-[9rem] flex-1">
                <Link
                    href={`/${person.username}`}
                    className="flex flex-wrap items-center gap-1 text-sm font-semibold break-words text-white hover:underline"
                >
                    <span
                        className="break-words"
                        style={plusNameStyle(person.plus)}
                    >
                        {person.name}
                    </span>
                    {person.is_verified && (
                        <VerifiedBadge className="size-3.5" />
                    )}
                    {person.plus && <PlusBadge className="size-3.5" />}
                </Link>
                {person.playing ? (
                    <PlayingBadge
                        playing={person.playing}
                        className="mt-0.5 py-0.5"
                    />
                ) : (
                    <div className="text-xs break-words text-white/45">
                        {person.mutual
                            ? `${person.mutual} ${plural(person.mutual, ['спільний друг', 'спільні друзі', 'спільних друзів'])}`
                            : person.status ||
                              person.city ||
                              `@${person.username}`}
                    </div>
                )}
            </div>
            {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
    );
}

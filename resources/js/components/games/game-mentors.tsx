import { Link, usePage } from '@inertiajs/react';
import { GraduationCap, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RowSkeleton } from '@/components/gc/skeletons';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Mentor = UserCard & { about: string; helped: number };

/** «Наставники»: досвідчені гравці, яким можна написати по допомогу. */
export function GameMentors({
    slug,
    gameName,
}: {
    slug: string;
    gameName: string;
}) {
    const me = usePage().props.auth.user;
    const [data, setData] = useState<{
        mentors: Mentor[];
        me: string | null;
    } | null>(null);
    const [editing, setEditing] = useState(false);
    const [about, setAbout] = useState('');
    const [busy, setBusy] = useState(false);
    const url = `/games/${slug}/mentors`;

    useEffect(() => {
        void api<{ mentors: Mentor[]; me: string | null }>('GET', url)
            .then(setData)
            .catch(() => setData({ mentors: [], me: null }));
    }, [url]);

    const send = (method: 'POST' | 'DELETE') => {
        setBusy(true);
        void api<{ mentors: Mentor[]; me: string | null }>(
            method,
            url,
            method === 'POST' ? { about } : undefined,
        )
            .then((d) => {
                setData(d);
                setEditing(false);
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof ApiError ? e.message : tr('Не вдалося.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    if (data === null) return <RowSkeleton />;

    return (
        <div className="space-y-3">
            {data.mentors.length === 0 && !editing && (
                <p className="text-sm text-white/50">
                    {tr(
                        'Наставників ще немає. Граєте добре — допоможіть новачкам.',
                    )}
                </p>
            )}
            <ul className="space-y-2">
                {data.mentors.map((m) => (
                    <li
                        key={m.id}
                        className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3"
                    >
                        <UserAvatar user={m} size="sm" />
                        <div className="min-w-0 flex-1">
                            <Link
                                href={`/${m.username}`}
                                className="text-sm font-semibold text-white hover:underline"
                            >
                                {m.name}
                            </Link>
                            <p className="text-sm text-white/70">{m.about}</p>
                            {m.helped > 0 && (
                                <p className="mt-0.5 text-xs text-white/40">
                                    {tr('Відповідей на питання: {count}', {
                                        count: m.helped,
                                    })}
                                </p>
                            )}
                        </div>
                        {me && me.id !== m.id && (
                            <Link
                                href={`/messages/with/${m.username}?text=${encodeURIComponent(tr('Привіт! Можна питання про {game}?', { game: gameName }))}`}
                                aria-label={tr('Написати')}
                                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-white transition hover:bg-white/[0.11]"
                            >
                                <MessageCircle className="size-4" />
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
            {me &&
                (editing ? (
                    <div className="space-y-2 rounded-xl bg-white/[0.04] p-3">
                        <textarea
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            placeholder={tr(
                                'З чим допоможете: ранг, роль, години в грі, мова',
                            )}
                            rows={3}
                            maxLength={300}
                            autoFocus
                            className="input-glass w-full resize-y rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEditing(false)}
                                className="h-9 rounded-xl px-3 text-sm text-white/60 hover:text-white"
                            >
                                {tr('Скасувати')}
                            </button>
                            <button
                                type="button"
                                disabled={busy || about.trim().length < 10}
                                onClick={() => send('POST')}
                                className="btn-glow h-9 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Зберегти')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setAbout(data.me ?? '');
                                setEditing(true);
                            }}
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 text-sm font-medium text-white transition hover:bg-white/[0.11]"
                        >
                            <GraduationCap className="size-4" />
                            {data.me
                                ? tr('Змінити опис')
                                : tr('Стати наставником')}
                        </button>
                        {data.me && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => send('DELETE')}
                                className="text-sm text-white/45 hover:text-rose-300"
                            >
                                {tr('Більше не наставник')}
                            </button>
                        )}
                    </div>
                ))}
        </div>
    );
}

import { Head, Link, router } from '@inertiajs/react';
import { Radio, Users, Video } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type LiveCastCard = {
    id: number;
    title: string;
    category: string | null;
    status: string;
    started_at: string | null;
    viewers: number;
    peak_viewers: number;
    host: UserCard | null;
};

type Props = {
    live: LiveCastCard[];
    pulse: { live: number; viewers: number };
};

/** LiveCast — каталог нативних стрімів (окремо від GameCast і Twitch). */
export default function LiveCastIndex({ live, pulse }: Props) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [busy, setBusy] = useState(false);

    const goLive = async (e: FormEvent) => {
        e.preventDefault();
        if (title.trim().length < 3) {
            toast.error(tr('Назва має бути щонайменше 3 символи.'));

            return;
        }
        setBusy(true);
        try {
            const res = await api<{ broadcast: LiveCastCard }>(
                'POST',
                '/livecast',
                {
                    title: title.trim(),
                    category: category.trim() || null,
                },
            );
            router.visit(`/livecast/${res.broadcast.id}`);
        } catch (err) {
            toast.error(
                err instanceof ApiError ? err.message : tr('Не вдалося'),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Head title="LiveCast" />
            <div className="mx-auto w-full max-w-4xl space-y-4 px-1 py-2 pb-28">
                <header className="flex flex-wrap items-end gap-3">
                    <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-white">
                        <Video className="size-7 text-rose-400" />
                        LiveCast
                    </h1>
                    <span className="pb-1 text-sm text-white/55">
                        {tr('{n} в ефірі · {v} дивляться', {
                            n: pulse.live,
                            v: pulse.viewers,
                        })}
                    </span>
                </header>

                <form
                    onSubmit={goLive}
                    className="gc-solid flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-end"
                >
                    <div className="min-w-0 flex-1 space-y-2">
                        <label className="block text-xs font-semibold text-white/55">
                            {tr('Назва стріму')}
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={80}
                                className="mt-1"
                                placeholder={tr('Наприклад: проходимо боса')}
                            />
                        </label>
                        <label className="block text-xs font-semibold text-white/55">
                            {tr('Категорія (необов’язково)')}
                            <Input
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                maxLength={60}
                                className="mt-1"
                                placeholder={tr('Гра або тема')}
                            />
                        </label>
                    </div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 text-sm font-bold text-white hover:bg-rose-500/90 disabled:opacity-60"
                    >
                        <Radio className="size-4" />
                        {tr('Почати стрім')}
                    </button>
                </form>

                <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-white/70">
                        {tr('Зараз в ефірі')}
                    </h2>
                    {live.length === 0 ? (
                        <div className="gc-solid rounded-2xl p-8 text-center text-white/60">
                            {tr(
                                'Ніхто ще не стрімить у LiveCast. Будьте першим — камера або екран прямо з браузера.',
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {live.map((b) => (
                                <Link
                                    key={b.id}
                                    href={`/livecast/${b.id}`}
                                    className="gc-solid flex gap-3 rounded-2xl p-3 transition hover:bg-white/[0.04]"
                                >
                                    {b.host ? (
                                        <UserAvatar user={b.host} size="md" />
                                    ) : (
                                        <div className="size-11 shrink-0 rounded-full bg-white/10" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                                LIVE
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs text-white/50">
                                                <Users className="size-3.5" />
                                                {b.viewers}
                                            </span>
                                        </div>
                                        <p className="mt-1 truncate font-semibold text-white">
                                            {b.title}
                                        </p>
                                        <p className="truncate text-xs text-white/45">
                                            {b.host?.name}
                                            {b.category
                                                ? ` · ${b.category}`
                                                : ''}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}

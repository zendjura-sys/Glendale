import { Head, Link } from '@inertiajs/react';
import { Smartphone, Users, Video } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type LiveCastDonation = {
    provider: string;
    name: string;
    url: string;
};

export type LiveCastCard = {
    id: number;
    title: string;
    category: string | null;
    donations: LiveCastDonation[];
    status: string;
    started_at: string | null;
    viewers: number;
    peak_viewers: number;
    host: UserCard | null;
};

type Props = {
    live: LiveCastCard[];
    pulse: { live: number; viewers: number };
    go_live_on_app?: boolean;
};

/** LiveCast на сайті — каталог для перегляду. Вихід в ефір лише в застосунку. */
export default function LiveCastIndex({ live, pulse }: Props) {
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

                <div className="gc-solid flex gap-3 rounded-2xl p-4 text-sm text-white/70">
                    <Smartphone className="mt-0.5 size-5 shrink-0 text-rose-300" />
                    <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-white">
                            {tr('Дивіться тут · стрімте в застосунку')}
                        </p>
                        <p>
                            {tr(
                                'На сайті — перегляд, чат, подарунки й донат-лінки. Вихід в ефір (камера чи екран) — у застосунку GameCon.',
                            )}
                        </p>
                    </div>
                </div>

                <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-white/70">
                        {tr('Зараз в ефірі')}
                    </h2>
                    {live.length === 0 ? (
                        <div className="gc-solid rounded-2xl p-8 text-center text-white/60">
                            {tr(
                                'Ніхто ще не стрімить у LiveCast. Відкрийте застосунок GameCon, щоб почати ефір.',
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

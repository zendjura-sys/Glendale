import { router } from '@inertiajs/react';
import { Check, ImageOff, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type ImageFlagItem = {
    id: number;
    kind: 'photo' | 'post_image';
    url: string;
    score: number;
    user: UserCard | null;
    href: string | null;
    created_at: string;
};

/** Фото, які автоперевірка вважає відвертими: залишити (з розмиттям) чи видалити. */
export function ImageFlags({ flags }: { flags: ImageFlagItem[] }) {
    if (flags.length === 0) return null;
    const act = (id: number, action: 'keep' | 'remove') =>
        router.post(
            `/admin/moderation/images/${id}`,
            { action },
            { preserveScroll: true },
        );

    return (
        <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-white">
                <ImageOff className="size-5 text-rose-300" />
                {tr('Фото на перевірці')}
            </h2>
            <p className="mb-4 text-sm text-white/50">
                {tr(
                    'Автоперевірка вважає ці фото відвертими. Поки рішення немає, вони розмиті для всіх.',
                )}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {flags.map((flag) => (
                    <div
                        key={flag.id}
                        className="overflow-hidden rounded-2xl bg-white/[0.04]"
                    >
                        <a
                            href={flag.href ?? flag.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block aspect-square"
                        >
                            <img
                                src={flag.url}
                                alt=""
                                loading="lazy"
                                className="group-hover:blur-0 size-full object-cover blur-xl transition"
                            />
                            <span className="absolute top-2 left-2 rounded-full bg-rose-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                                {Math.round(flag.score * 100)}%
                            </span>
                        </a>
                        <div className="space-y-2 p-2.5">
                            {flag.user && (
                                <div className="flex min-w-0 items-center gap-2">
                                    <UserAvatar
                                        user={flag.user}
                                        size="xs"
                                        showOnline={false}
                                    />
                                    <span className="min-w-0 truncate text-xs text-white/70">
                                        {flag.user.name}
                                    </span>
                                </div>
                            )}
                            <div className="text-[11px] text-white/40">
                                {flag.kind === 'photo'
                                    ? tr('Фотоальбом')
                                    : tr('Запис')}{' '}
                                · {timeAgo(flag.created_at)}
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => act(flag.id, 'keep')}
                                    className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-white/[0.07] text-xs font-medium text-white hover:bg-white/[0.12]"
                                >
                                    <Check className="size-3.5" />
                                    {tr('Залишити')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => act(flag.id, 'remove')}
                                    aria-label={tr('Видалити')}
                                    className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-500/15 px-2.5 text-rose-200 hover:bg-rose-500/25"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

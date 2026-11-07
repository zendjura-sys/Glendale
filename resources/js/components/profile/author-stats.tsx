import { Link } from '@inertiajs/react';
import { BarChart3, Eye, Heart, MessageCircle, PenLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ListSkeleton } from '@/components/gc/skeletons';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

type Stats = {
    totals: { posts: number; views: number; likes: number; comments: number };
    days: { day: string; likes: number; comments: number }[];
    top: {
        id: number;
        excerpt: string;
        views: number;
        likes: number;
        comments: number;
        created_at: string;
    }[];
};

/** «Статистика автора»: 30 днів — підсумки, реакції по днях і найкращі записи. */
export function AuthorStatsButton({ className }: { className?: string }) {
    const on = usePlugin('author_stats');
    const [open, setOpen] = useState(false);
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        if (open && !stats) {
            void api<Stats>('GET', '/me/author-stats').then(setStats);
        }
    }, [open, stats]);

    if (!on) return null;

    const peak = Math.max(
        1,
        ...(stats?.days.map((d) => d.likes + d.comments) ?? []),
    );
    const totals: [LucideIcon, string, number][] = stats
        ? [
              [PenLine, tr('Записів'), stats.totals.posts],
              [Eye, tr('Переглядів'), stats.totals.views],
              [Heart, tr('Вподобань'), stats.totals.likes],
              [MessageCircle, tr('Коментарів'), stats.totals.comments],
          ]
        : [];

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.11]',
                    className,
                )}
            >
                <BarChart3 className="size-4" />
                {tr('Статистика')}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
                    <div>
                        <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                            <BarChart3 className="size-5 text-gc-lilac-300" />
                            {tr('Статистика автора')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr('Останні 30 днів. Бачите лише ви.')}
                        </DialogDescription>
                    </div>
                    {!stats ? (
                        <ListSkeleton rows={4} card={false} />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {totals.map(([Icon, label, value]) => (
                                    <div
                                        key={label}
                                        className="rounded-xl bg-white/[0.04] p-3"
                                    >
                                        <Icon className="size-4 text-white/40" />
                                        <p className="mt-1.5 font-display text-xl font-semibold text-white tabular-nums">
                                            {value.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-white/45">
                                            {label}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <p className="mb-2 text-xs text-white/45">
                                    {tr('Реакції по днях')}
                                </p>
                                <div className="flex h-24 items-end gap-[3px]">
                                    {stats.days.map((d) => (
                                        <div
                                            key={d.day}
                                            title={`${formatDate(d.day)}: ${d.likes} ♥ · ${d.comments} 💬`}
                                            className="flex-1 rounded-t bg-gc-indigo/70"
                                            style={{
                                                height: `${Math.max(3, ((d.likes + d.comments) / peak) * 100)}%`,
                                                opacity:
                                                    d.likes + d.comments > 0
                                                        ? 1
                                                        : 0.25,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            {stats.top.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-white/45">
                                        {tr('Найкращі записи')}
                                    </p>
                                    {stats.top.map((post) => (
                                        <Link
                                            key={post.id}
                                            href={`/posts/${post.id}`}
                                            className="block rounded-xl bg-white/[0.04] p-3 transition hover:bg-white/[0.07]"
                                        >
                                            <p className="truncate text-sm text-white">
                                                {post.excerpt}
                                            </p>
                                            <p className="mt-1 flex gap-3 text-xs text-white/45 tabular-nums">
                                                <span>👁 {post.views}</span>
                                                <span>♥ {post.likes}</span>
                                                <span>💬 {post.comments}</span>
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

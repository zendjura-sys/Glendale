import { Head, router, useForm } from '@inertiajs/react';
import { Clapperboard, Flame, Plus, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { ClipOfWeekSection } from '@/components/moments/clip-of-week';
import type { ClipOfWeekData } from '@/components/moments/clip-of-week';
import { MomentCard } from '@/components/moments/moment-card';
import type { MomentCardData } from '@/components/moments/moment-card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Option = { slug: string; name: string };

type Props = {
    clip_of_week?: ClipOfWeekData | null;
    moments: MomentCardData[];
    more: boolean;
    filters: {
        tab: 'new' | 'week' | 'friends';
        game: string | null;
        page: number;
    };
    game: Option | null;
    games: Option[];
    options: { games: Option[]; servers: Option[] };
};

const TABS = () =>
    [
        { value: 'new', label: tr('Нові'), icon: Sparkles },
        { value: 'week', label: tr('Найкраще за тиждень'), icon: Flame },
        { value: 'friends', label: tr('Друзі'), icon: UsersRound },
    ] as const;

const fieldClass =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

export default function Moments({
    clip_of_week = null,
    moments,
    more,
    filters,
    game,
    games,
    options,
}: Props) {
    const [adding, setAdding] = useState(false);
    const form = useForm({
        url: '',
        title: '',
        game: filters.game ?? '',
        server: '',
    });

    const visit = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, page: 1, ...patch };
        router.get(
            '/moments',
            {
                tab: next.tab === 'new' ? undefined : next.tab,
                game: next.game || undefined,
                page: next.page > 1 ? next.page : undefined,
            },
            {
                preserveState: true,
                preserveScroll: patch.page !== undefined,
                replace: true,
            },
        );
    };

    return (
        <>
            <Head
                title={
                    game
                        ? tr('Моменти · {game}', { game: game.name })
                        : tr('Моменти')
                }
            />
            <div className="space-y-5">
                <section className="glass rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                                <Clapperboard className="size-6 text-gc-lilac-300" />
                                {tr('Моменти')}
                            </h1>
                            <p className="mt-1 text-sm text-white/50">
                                {tr(
                                    'Найкращі кліпи гравців: вставте посилання YouTube, Twitch чи Medal — обкладинка й назва підтягнуться самі.',
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="btn-glow inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto"
                        >
                            <Plus className="size-4" />
                            {tr('Додати момент')}
                        </button>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="-mx-1 scrollbar-none flex min-w-0 snap-x gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
                            {TABS().map((tab) => (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => visit({ tab: tab.value })}
                                    aria-pressed={filters.tab === tab.value}
                                    className={cn(
                                        'inline-flex h-9 shrink-0 snap-start items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition',
                                        filters.tab === tab.value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    <tab.icon className="size-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {games.length > 0 && (
                            <select
                                value={filters.game ?? ''}
                                onChange={(e) =>
                                    visit({ game: e.target.value || null })
                                }
                                className={cn(
                                    selectClass,
                                    'h-11 w-full min-w-0 lg:ml-auto lg:w-64',
                                )}
                                aria-label={tr('Гра')}
                            >
                                <option value="">{tr('Усі ігри')}</option>
                                {games.map((g) => (
                                    <option key={g.slug} value={g.slug}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </section>

                {clip_of_week && <ClipOfWeekSection data={clip_of_week} />}

                {moments.length === 0 ? (
                    <EmptyState
                        icon={Clapperboard}
                        title={
                            filters.tab === 'friends'
                                ? tr('Друзі ще не ділилися моментами')
                                : tr('Моментів поки немає')
                        }
                        text={tr(
                            'Додайте свій найкращий кліп — його побачать гравці й друзі.',
                        )}
                        action={
                            <button
                                type="button"
                                onClick={() => setAdding(true)}
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                            >
                                {tr('Додати момент')}
                            </button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {moments.map((moment) => (
                            <MomentCard key={moment.id} moment={moment} />
                        ))}
                    </div>
                )}

                {(more || filters.page > 1) && (
                    <div className="flex justify-center gap-2">
                        {filters.page > 1 && (
                            <button
                                type="button"
                                onClick={() =>
                                    visit({ page: filters.page - 1 })
                                }
                                className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white hover:bg-white/10"
                            >
                                {tr('Назад')}
                            </button>
                        )}
                        {more && (
                            <button
                                type="button"
                                onClick={() =>
                                    visit({ page: filters.page + 1 })
                                }
                                className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white hover:bg-white/10"
                            >
                                {tr('Ще моменти')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <Dialog open={adding} onOpenChange={setAdding}>
                <DialogContent className="glass-strong max-h-[92dvh] overflow-y-auto rounded-dialog border-white/10 p-6 text-white sm:max-w-lg">
                    <DialogTitle className="font-display text-xl">
                        {tr('Додати момент')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/50">
                        {tr(
                            'Посилання на кліп YouTube (і Shorts), Twitch або Medal.',
                        )}
                    </DialogDescription>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.transform((data) => ({
                                ...data,
                                game: data.game || null,
                                server: data.server || null,
                            }));
                            form.post('/moments', {
                                onSuccess: () => {
                                    setAdding(false);
                                    form.reset();
                                },
                            });
                        }}
                        className="space-y-3"
                    >
                        <input
                            value={form.data.url}
                            onChange={(e) =>
                                form.setData('url', e.target.value)
                            }
                            inputMode="url"
                            required
                            placeholder="https://youtu.be/…"
                            className={fieldClass}
                        />
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            maxLength={140}
                            placeholder={tr(
                                'Назва (необов’язково — візьмемо з кліпу)',
                            )}
                            className={fieldClass}
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                            <select
                                value={form.data.game}
                                onChange={(e) =>
                                    form.setData('game', e.target.value)
                                }
                                className={cn(
                                    selectClass,
                                    'h-11 w-full min-w-0',
                                )}
                                aria-label={tr('Гра')}
                            >
                                <option value="">
                                    {tr('Гра (необов’язково)')}
                                </option>
                                {options.games.map((g) => (
                                    <option key={g.slug} value={g.slug}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={form.data.server}
                                onChange={(e) =>
                                    form.setData('server', e.target.value)
                                }
                                className={cn(
                                    selectClass,
                                    'h-11 w-full min-w-0',
                                )}
                                aria-label={tr('Сервер')}
                            >
                                <option value="">
                                    {tr('Сервер (необов’язково)')}
                                </option>
                                {options.servers.map((s) => (
                                    <option key={s.slug} value={s.slug}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {(form.errors.url || form.errors.title) && (
                            <p className="text-xs text-rose-300">
                                {form.errors.url ?? form.errors.title}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setAdding(false)}
                                className="h-11 rounded-xl px-4 text-sm font-medium text-white/60 hover:text-white"
                            >
                                {tr('Скасувати')}
                            </button>
                            <button
                                type="submit"
                                disabled={
                                    form.processing || !form.data.url.trim()
                                }
                                className="btn-glow h-11 rounded-xl px-6 text-sm font-semibold disabled:opacity-50"
                            >
                                {form.processing
                                    ? tr('Додаємо…')
                                    : tr('Додати')}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

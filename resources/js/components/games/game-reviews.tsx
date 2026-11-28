import { Link } from '@inertiajs/react';
import { ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import {
    CriteriaBars,
    CriteriaChips,
    CriteriaInput,
} from '@/components/gc/review-criteria';
import type { Criteria } from '@/components/gc/review-criteria';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { formatDate, plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Review = {
    id: number;
    body: string;
    score: number;
    criteria?: Criteria | null;
    recommended: boolean;
    hours: number | null;
    helpful_count: number;
    helpful: boolean;
    mine: boolean;
    user: UserCard | null;
    created_at: string;
};

type Data = {
    reviews: { data: Review[]; next_page_url: string | null };
    summary: {
        count: number;
        recommended: number;
        average: number;
        criteria?: Record<string, number | null>;
    };
    mine: Review | null;
};

/** Огляди гравців на сторінці гри: підсумок, свій огляд (форма) і стрічка оглядів. */
export function GameReviews({
    slug,
    signedIn,
}: {
    slug: string;
    signedIn: boolean;
}) {
    const [data, setData] = useState<Data | null>(null);
    const [sort, setSort] = useState<'helpful' | 'new'>('helpful');
    const [writing, setWriting] = useState(false);
    const [body, setBody] = useState('');
    const [score, setScore] = useState(8);
    const [recommended, setRecommended] = useState(true);
    const [hours, setHours] = useState('');
    const [criteria, setCriteria] = useState<Criteria>({});
    const [busy, setBusy] = useState(false);

    const load = () =>
        api<Data>('GET', `/games/${slug}/reviews?sort=${sort}`)
            .then((d) => {
                setData(d);
                if (d.mine) {
                    setBody(d.mine.body);
                    setScore(d.mine.score);
                    setRecommended(d.mine.recommended);
                    setHours(d.mine.hours ? String(d.mine.hours) : '');
                    setCriteria(d.mine.criteria ?? {});
                }
            })
            .catch(() => undefined);

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, sort]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        api('POST', `/games/${slug}/reviews`, {
            body,
            score,
            recommended,
            hours: hours ? Number(hours) : null,
            criteria,
        })
            .then(() => {
                toast.success(tr('Огляд опубліковано.'));
                setWriting(false);
                void load();
            })
            .catch((err) => toast.error((err as Error).message))
            .finally(() => setBusy(false));
    };

    const helpful = (review: Review) =>
        api<{ helpful: boolean; helpful_count: number }>(
            'POST',
            `/games/reviews/${review.id}/helpful`,
        )
            .then((r) =>
                setData((d) =>
                    d
                        ? {
                              ...d,
                              reviews: {
                                  ...d.reviews,
                                  data: d.reviews.data.map((x) =>
                                      x.id === review.id
                                          ? {
                                                ...x,
                                                helpful: r.helpful,
                                                helpful_count: r.helpful_count,
                                            }
                                          : x,
                                  ),
                              },
                          }
                        : d,
                ),
            )
            .catch((err) => toast.error((err as Error).message));

    const remove = () => {
        if (!confirm(tr('Видалити свій огляд?'))) return;
        api('DELETE', `/games/${slug}/reviews`)
            .then(() => {
                setBody('');
                void load();
            })
            .catch((err) => toast.error((err as Error).message));
    };

    if (!data) return null;
    const { summary } = data;
    const share = summary.count
        ? Math.round((summary.recommended / summary.count) * 100)
        : 0;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                {summary.count > 0 ? (
                    <p className="text-sm text-white/70">
                        <b className="text-white">{share}%</b> {tr('радять')} ·{' '}
                        {tr('середня {avg}/10', { avg: summary.average })} ·{' '}
                        {summary.count}{' '}
                        {plural(summary.count, [
                            tr('огляд'),
                            tr('огляди'),
                            tr('оглядів'),
                        ])}
                    </p>
                ) : (
                    <p className="text-sm text-white/50">
                        {tr('Оглядів ще немає — будьте першими.')}
                    </p>
                )}
                <div className="ml-auto flex gap-1.5">
                    {(['helpful', 'new'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setSort(s)}
                            className={cn(
                                'h-8 rounded-lg px-2.5 text-xs',
                                sort === s
                                    ? 'bg-primary text-white'
                                    : 'gc-solid-2 text-white/65 hover:text-white',
                            )}
                        >
                            {s === 'helpful' ? tr('Корисні') : tr('Нові')}
                        </button>
                    ))}
                </div>
            </div>

            <CriteriaBars kind="game" averages={summary.criteria} />

            {signedIn &&
                (writing ? (
                    <form
                        onSubmit={submit}
                        className="gc-solid-2 space-y-3 rounded-2xl p-3"
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            {[true, false].map((r) => (
                                <button
                                    key={String(r)}
                                    type="button"
                                    onClick={() => setRecommended(r)}
                                    className={cn(
                                        'flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm',
                                        recommended === r
                                            ? r
                                                ? 'bg-emerald-500/25 text-white'
                                                : 'bg-red-500/25 text-white'
                                            : 'gc-solid-2 text-white/65',
                                    )}
                                >
                                    {r ? (
                                        <ThumbsUp className="size-4" />
                                    ) : (
                                        <ThumbsDown className="size-4" />
                                    )}
                                    {r ? tr('Раджу') : tr('Не раджу')}
                                </button>
                            ))}
                            <label className="flex items-center gap-2 text-sm text-white/70">
                                {tr('Оцінка')}
                                <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    value={score}
                                    onChange={(e) =>
                                        setScore(Number(e.target.value))
                                    }
                                    className="w-28"
                                />
                                <b className="w-6 text-white tabular-nums">
                                    {score}
                                </b>
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                placeholder={tr('Годин у грі')}
                                className="input-glass h-9 w-32 rounded-xl px-3 text-sm text-white"
                            />
                        </div>
                        <CriteriaInput
                            kind="game"
                            value={criteria}
                            onChange={setCriteria}
                        />
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            maxLength={5000}
                            placeholder={tr(
                                'Що сподобалось, що ні, кому порадите?',
                            )}
                            className="input-glass min-h-28 w-full rounded-xl px-3 py-2 text-sm text-white"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setWriting(false)}
                                className="h-10 rounded-xl px-4 text-sm text-white/65"
                            >
                                {tr('Скасувати')}
                            </button>
                            <button
                                type="submit"
                                disabled={busy || body.trim().length < 20}
                                className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {data.mine
                                    ? tr('Оновити огляд')
                                    : tr('Опублікувати')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setWriting(true)}
                        className="h-10 rounded-xl bg-white/[0.07] px-4 text-sm font-medium text-white hover:bg-white/[0.12]"
                    >
                        {data.mine
                            ? tr('Редагувати мій огляд')
                            : tr('Написати огляд')}
                    </button>
                ))}

            {data.reviews.data.map((r) => (
                <article key={r.id} className="gc-solid-2 rounded-2xl p-3">
                    <div className="flex items-center gap-2.5">
                        {r.user && (
                            <Link href={`/${r.user.username}`}>
                                <UserAvatar user={r.user} size="sm" />
                            </Link>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                                {r.user?.name}
                            </p>
                            <p className="text-xs text-white/45">
                                {formatDate(r.created_at)}
                                {r.hours
                                    ? ` · ${tr('{h} год у грі', { h: r.hours })}`
                                    : ''}
                            </p>
                        </div>
                        <span
                            className={cn(
                                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                                r.recommended
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-red-500/15 text-red-400',
                            )}
                        >
                            {r.recommended ? (
                                <ThumbsUp className="size-3.5" />
                            ) : (
                                <ThumbsDown className="size-3.5" />
                            )}
                            {r.score}/10
                        </span>
                    </div>
                    <CriteriaChips kind="game" criteria={r.criteria} />
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-white/85">
                        {r.body}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
                        {!r.mine && signedIn && (
                            <button
                                type="button"
                                onClick={() => helpful(r)}
                                className={cn(
                                    'hover:text-white',
                                    r.helpful && 'text-sky-400',
                                )}
                            >
                                {tr('Корисно')} · {r.helpful_count}
                            </button>
                        )}
                        {r.mine && (
                            <button
                                type="button"
                                onClick={remove}
                                className="flex items-center gap-1 hover:text-red-400"
                            >
                                <Trash2 className="size-3.5" />
                                {tr('Видалити')}
                            </button>
                        )}
                    </div>
                </article>
            ))}
        </div>
    );
}

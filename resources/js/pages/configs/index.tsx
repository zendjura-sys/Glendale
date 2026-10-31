import { Head, InfiniteScroll, Link, router, useForm } from '@inertiajs/react';
import { Check, Copy, Crosshair, Heart, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { GameSearch } from '@/components/gc/game-search';
import { ListSkeleton } from '@/components/gc/skeletons';
import { EmptyState } from '@/components/gc/widget';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { GameCard, ScrollData, UserCard } from '@/types';

type Kind = 'crosshair' | 'config' | 'binds' | 'graphics' | 'sensitivity';

type ConfigItem = {
    id: number;
    kind: Kind;
    title: string;
    code: string;
    description: string | null;
    likes: number;
    copies: number;
    liked: boolean;
    mine: boolean;
    author: UserCard | null;
    game: GameCard | null;
    created_at: string;
};

const KIND: Record<Kind, () => string> = {
    crosshair: () => tr('Приціл'),
    config: () => tr('Конфіг'),
    binds: () => tr('Бінди'),
    graphics: () => tr('Графіка'),
    sensitivity: () => tr('Чутливість'),
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Конфіги й приціли гравців: поділитися, скопіювати одним дотиком, позначити «корисно». */
export default function ConfigsIndex({
    configs,
    game,
    kind,
    tab,
    kinds,
}: {
    configs: ScrollData<ConfigItem>;
    game: GameCard | null;
    kind: Kind | null;
    tab: 'top' | 'new' | 'mine';
    kinds: Kind[];
}) {
    const [adding, setAdding] = useState(false);
    const [pick, setPick] = useState<GameCard | null>(game);
    const form = useForm({
        game_id: game?.id ?? 0,
        kind: kind ?? 'crosshair',
        title: '',
        code: '',
        description: '',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/configs', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('title', 'code', 'description');
                setAdding(false);
            },
        });
    };
    const filter = (next: {
        tab?: string;
        kind?: string | null;
        game?: string | null;
    }) =>
        router.get(
            '/configs',
            {
                tab: next.tab ?? tab,
                kind: next.kind === undefined ? kind : next.kind,
                game: next.game === undefined ? game?.slug : next.game,
            },
            { preserveScroll: true, preserveState: true },
        );
    const chip = (active: boolean) =>
        cn(
            'h-8 rounded-chip px-3 text-[13px] font-medium transition',
            active
                ? 'bg-white/12 text-white'
                : 'text-white/50 hover:text-white',
        );

    return (
        <>
            <Head title={tr('Конфіги й приціли')} />
            <div className="mx-auto w-full max-w-3xl px-4 py-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white">
                            <Crosshair className="size-6 text-sky-300" />
                            {tr('Конфіги й приціли')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Коди прицілів, конфіги, бінди й налаштування від гравців — копіюйте одним дотиком.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAdding(!adding)}
                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    >
                        <Plus className="size-4" />
                        {tr('Поділитися')}
                    </button>
                </div>

                {adding && (
                    <form
                        onSubmit={submit}
                        className="glass mt-4 space-y-3 rounded-2xl p-4"
                    >
                        <GameSearch
                            value={pick}
                            onChange={(value) => {
                                setPick(value);
                                form.setData('game_id', value?.id ?? 0);
                            }}
                        />
                        <div className="flex flex-wrap gap-2">
                            {kinds.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => form.setData('kind', value)}
                                    className={chip(form.data.kind === value)}
                                >
                                    {KIND[value]()}
                                </button>
                            ))}
                        </div>
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Назва, напр. «Маленький зелений»')}
                            maxLength={80}
                            className={cn(field, 'h-11')}
                        />
                        <textarea
                            value={form.data.code}
                            onChange={(e) =>
                                form.setData('code', e.target.value)
                            }
                            placeholder={tr('Код прицілу чи текст конфігу')}
                            rows={4}
                            maxLength={20000}
                            className={cn(field, 'resize-y py-2.5 font-mono')}
                        />
                        <textarea
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder={tr(
                                'Для чого й як застосувати (необовʼязково)',
                            )}
                            rows={2}
                            maxLength={1000}
                            className={cn(field, 'resize-y py-2.5')}
                        />
                        {Object.values(form.errors)[0] && (
                            <p className="text-xs text-rose-300">
                                {Object.values(form.errors)[0]}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    !form.data.game_id ||
                                    form.data.title.trim().length < 3 ||
                                    !form.data.code.trim()
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Опублікувати')}
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-5 max-w-sm">
                    <GameSearch
                        value={game}
                        onChange={(value) =>
                            filter({ game: value?.slug ?? null })
                        }
                        placeholder={tr('Усі ігри — знайти гру')}
                    />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {(['top', 'new', 'mine'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => filter({ tab: value })}
                            className={chip(tab === value)}
                        >
                            {value === 'top'
                                ? tr('Популярні')
                                : value === 'new'
                                  ? tr('Нові')
                                  : tr('Мої')}
                        </button>
                    ))}
                    <span className="mx-1 w-px bg-white/10" />
                    {[null, ...kinds].map((value) => (
                        <button
                            key={value ?? 'all'}
                            type="button"
                            onClick={() => filter({ kind: value })}
                            className={chip(kind === value)}
                        >
                            {value === null ? tr('Усі') : KIND[value]()}
                        </button>
                    ))}
                </div>

                {configs.data.length === 0 ? (
                    <div className="mt-6">
                        <EmptyState
                            icon={Crosshair}
                            title={tr('Тут поки порожньо')}
                            text={tr(
                                'Поділіться своїм прицілом чи конфігом першим.',
                            )}
                        />
                    </div>
                ) : (
                    <InfiniteScroll
                        data="configs"
                        loading={<ListSkeleton rows={3} />}
                        preserveUrl
                    >
                        <ul className="mt-4 space-y-2">
                            {configs.data.map((config) => (
                                <ConfigRow key={config.id} config={config} />
                            ))}
                        </ul>
                    </InfiniteScroll>
                )}
            </div>
        </>
    );
}

function ConfigRow({ config }: { config: ConfigItem }) {
    const [liked, setLiked] = useState(config.liked);
    const [likes, setLikes] = useState(config.likes);
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(config.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
            void api('POST', `/configs/${config.id}/copied`).catch(() => {});
        } catch {
            // Буфер обміну недоступний — код лишається виділеним текстом нижче.
        }
    };
    const like = () =>
        api<{ liked: boolean; likes: number }>(
            'POST',
            `/configs/${config.id}/like`,
        )
            .then((r) => {
                setLiked(r.liked);
                setLikes(r.likes);
            })
            .catch(() => {});

    return (
        <li className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-chip bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                    {KIND[config.kind]()}
                </span>
                <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
                    {config.title}
                </h2>
                {config.game && (
                    <Link
                        href={`/configs?game=${config.game.slug}`}
                        className="text-xs text-white/45 hover:text-white"
                    >
                        {config.game.name}
                    </Link>
                )}
            </div>
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-black/25 px-3 py-2.5 font-mono text-[13px] whitespace-pre-wrap text-white/85 select-all">
                {config.code}
            </pre>
            {config.description && (
                <p className="mt-2 text-sm whitespace-pre-line text-white/65">
                    {config.description}
                </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white"
                >
                    {copied ? (
                        <Check className="size-4" />
                    ) : (
                        <Copy className="size-4" />
                    )}
                    {copied ? tr('Скопійовано') : tr('Копіювати')}
                </button>
                <button
                    type="button"
                    onClick={like}
                    aria-pressed={liked}
                    className={cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium tabular-nums transition',
                        liked
                            ? 'bg-sky-500/20 text-sky-100'
                            : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]',
                    )}
                >
                    <Heart className={cn('size-4', liked && 'fill-current')} />
                    {tr('Корисно')} · {likes}
                </button>
                <span className="ml-auto text-xs text-white/40">
                    {config.author && (
                        <Link
                            href={`/${config.author.username}`}
                            className="hover:text-white"
                        >
                            {config.author.name}
                        </Link>
                    )}
                    {' · '}
                    {formatDate(config.created_at)}
                </span>
                {config.mine && (
                    <button
                        type="button"
                        onClick={() =>
                            confirm(tr('Видалити конфіг?')) &&
                            router.delete(`/configs/${config.id}`, {
                                preserveScroll: true,
                            })
                        }
                        aria-label={tr('Видалити')}
                        className="rounded-lg p-1.5 text-white/40 hover:text-rose-300"
                    >
                        <Trash2 className="size-4" />
                    </button>
                )}
            </div>
        </li>
    );
}

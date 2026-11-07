import { Head, Link, useForm } from '@inertiajs/react';
import {
    Bold,
    Eye,
    Heading2,
    Heading3,
    ImagePlus,
    Italic,
    Link2,
    List,
    Loader2,
    PenLine,
    Quote,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ArticleCard } from '@/components/articles/article-card';
import { api } from '@/lib/api';
import { useDraft, writeDraft } from '@/lib/drafts';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { GameCard } from '@/types';

type Props = { article: (ArticleCard & { body: string }) | null };

/** Дуже простий попередній перегляд Markdown (остаточний HTML робить сервер). */
function preview(md: string): string {
    const esc = (t: string) =>
        t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (t: string) =>
        esc(t)
            .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
            .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

    return md
        .split(/\n{2,}/)
        .map((block) => {
            const b = block.trim();
            if (b.startsWith('### ')) return `<h3>${inline(b.slice(4))}</h3>`;
            if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
            if (b.startsWith('> '))
                return `<blockquote>${inline(b.replace(/^> ?/gm, ''))}</blockquote>`;
            if (/^[-*] /.test(b))
                return `<ul>${b
                    .split('\n')
                    .map((l) => `<li>${inline(l.replace(/^[-*] /, ''))}</li>`)
                    .join('')}</ul>`;

            return b ? `<p>${inline(b).replace(/\n/g, '<br>')}</p>` : '';
        })
        .join('');
}

/** Редактор статті: Markdown із панеллю, картинки, обкладинка, гра, чернетка або публікація. */
export default function ArticleEdit({ article }: Props) {
    const form = useForm({
        title: article?.title ?? '',
        excerpt: article?.excerpt ?? '',
        body: article?.body ?? '',
        game_id: article?.game?.id ?? (null as number | null),
        cover: null as File | null,
        publish: article?.is_published ?? false,
    });
    const draftsOn = usePlugin('local_drafts');
    // Чернетка тексту нової статті на цьому пристрої: закрили вкладку — текст не губиться.
    const draftKey = draftsOn && !article ? 'article:new' : null;
    const setBody = useCallback(
        (text: string) => form.setData('body', text),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const restored = useDraft(draftKey, form.data.body, setBody);
    const area = useRef<HTMLTextAreaElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState<'write' | 'preview'>('write');
    const [uploading, setUploading] = useState(false);
    const [gameQuery, setGameQuery] = useState('');
    const [games, setGames] = useState<GameCard[]>([]);
    const [game, setGame] = useState<GameCard | null>(article?.game ?? null);

    useEffect(() => {
        if (gameQuery.trim().length < 2) {
            setGames([]);

            return;
        }
        const t = setTimeout(() => {
            void api<{ games: GameCard[] }>(
                'GET',
                `/games/search?q=${encodeURIComponent(gameQuery.trim())}`,
            )
                .then((r) => setGames(r.games.slice(0, 5)))
                .catch(() => setGames([]));
        }, 250);

        return () => clearTimeout(t);
    }, [gameQuery]);

    /** Обгорнути виділене або вставити шаблон у поточну позицію. */
    const wrap = (before: string, after = '', placeholder = '') => {
        const el = area.current;
        if (!el) return;
        const { selectionStart: s, selectionEnd: e, value } = el;
        const selected = value.slice(s, e) || placeholder;
        const next =
            value.slice(0, s) + before + selected + after + value.slice(e);
        form.setData('body', next);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(
                s + before.length,
                s + before.length + selected.length,
            );
        });
    };
    const line = (prefix: string, placeholder: string) => {
        const el = area.current;
        const start = el
            ? el.value.lastIndexOf('\n', el.selectionStart - 1) + 1
            : 0;
        const needsBreak = el && start > 0 && el.value[start - 2] !== '\n';
        if (el) el.setSelectionRange(start, el.selectionEnd);
        wrap((needsBreak ? '\n' : '') + prefix, '', placeholder);
    };

    const upload = async (file: File) => {
        setUploading(true);
        try {
            const data = new FormData();
            data.append('image', file);
            const { url } = await api<{ url: string }>(
                'POST',
                '/articles/images',
                data,
            );
            wrap(`\n\n![${tr('опис')}](${url})\n\n`);
        } catch (e) {
            toast.error(
                e instanceof Error
                    ? e.message
                    : tr('Не вдалося завантажити картинку.'),
            );
        } finally {
            setUploading(false);
        }
    };

    const submit = (publish: boolean) => {
        form.transform((data) => ({ ...data, publish }));
        form.post(article ? `/articles/${article.slug}` : '/articles', {
            forceFormData: true,
            onSuccess: () => {
                if (draftKey) writeDraft(draftKey, '');
            },
        });
    };

    const tools: [typeof Bold, string, () => void][] = [
        [Heading2, tr('Заголовок'), () => line('## ', tr('Заголовок'))],
        [Heading3, tr('Підзаголовок'), () => line('### ', tr('Підзаголовок'))],
        [Bold, tr('Жирний'), () => wrap('**', '**', tr('текст'))],
        [Italic, tr('Курсив'), () => wrap('*', '*', tr('текст'))],
        [List, tr('Список'), () => line('- ', tr('пункт'))],
        [Quote, tr('Цитата'), () => line('> ', tr('цитата'))],
        [Link2, tr('Посилання'), () => wrap('[', '](https://)', tr('текст'))],
    ];
    const input =
        'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';
    const error = Object.values(form.errors)[0];

    return (
        <>
            <Head
                title={article ? tr('Редагування статті') : tr('Нова стаття')}
            />
            <div className="mb-4 flex items-center gap-3">
                <h1 className="min-w-0 flex-1 font-display text-2xl font-semibold text-white">
                    {article ? tr('Редагування статті') : tr('Нова стаття')}
                </h1>
                <Link
                    href={article ? `/articles/${article.slug}` : '/articles'}
                    className="text-sm text-white/55 hover:text-white"
                >
                    {tr('Скасувати')}
                </Link>
            </div>
            <div className="glass space-y-3 rounded-2xl p-4 sm:p-5">
                <input
                    value={form.data.title}
                    maxLength={140}
                    onChange={(e) => form.setData('title', e.target.value)}
                    placeholder={tr('Заголовок статті')}
                    className={cn(
                        input,
                        'h-12 font-display text-lg font-semibold',
                    )}
                />
                <textarea
                    value={form.data.excerpt}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => form.setData('excerpt', e.target.value)}
                    placeholder={tr('Короткий опис для картки (необов’язково)')}
                    className={cn(input, 'py-2.5')}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-white/55">
                        {tr('Обкладинка')}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) =>
                                form.setData(
                                    'cover',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                            className="mt-1 block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
                        />
                    </label>
                    <div className="relative text-xs text-white/55">
                        {tr('Гра (необов’язково)')}
                        {game ? (
                            <div className="mt-1 flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-sm text-white">
                                <span className="min-w-0 flex-1 break-words">
                                    {game.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setGame(null);
                                        form.setData('game_id', null);
                                    }}
                                    className="text-white/50 hover:text-white"
                                >
                                    {tr('Прибрати')}
                                </button>
                            </div>
                        ) : (
                            <input
                                value={gameQuery}
                                onChange={(e) => setGameQuery(e.target.value)}
                                placeholder={tr('Назва гри')}
                                className={cn(input, 'mt-1 h-10')}
                            />
                        )}
                        {games.length > 0 && !game && (
                            <div className="glass-strong absolute inset-x-0 top-full z-20 mt-1 rounded-xl p-1">
                                {games.map((g) => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => {
                                            setGame(g);
                                            form.setData('game_id', g.id);
                                            setGameQuery('');
                                            setGames([]);
                                        }}
                                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white/[0.03] p-1">
                    {(['write', 'preview'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTab(t)}
                            className={cn(
                                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition',
                                tab === t
                                    ? 'bg-white/[0.12] text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {t === 'write' ? (
                                <PenLine className="size-4" />
                            ) : (
                                <Eye className="size-4" />
                            )}
                            {t === 'write' ? tr('Текст') : tr('Перегляд')}
                        </button>
                    ))}
                    {tab === 'write' && (
                        <span className="ml-auto flex flex-wrap gap-0.5">
                            {tools.map(([Icon, label, run]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={run}
                                    title={label}
                                    aria-label={label}
                                    className="grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                    <Icon className="size-4" />
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => imageInput.current?.click()}
                                disabled={uploading}
                                title={tr('Картинка')}
                                aria-label={tr('Картинка')}
                                className="grid size-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50"
                            >
                                {uploading ? (
                                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                                ) : (
                                    <ImagePlus className="size-4" />
                                )}
                            </button>
                            <input
                                ref={imageInput}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void upload(file);
                                    e.target.value = '';
                                }}
                            />
                        </span>
                    )}
                </div>
                {restored && (
                    <p className="px-1 pb-1 text-xs text-white/45">
                        {tr('Відновили незбережену чернетку з цього пристрою.')}
                    </p>
                )}
                {tab === 'write' ? (
                    <textarea
                        ref={area}
                        value={form.data.body}
                        onChange={(e) => form.setData('body', e.target.value)}
                        rows={18}
                        placeholder={tr(
                            'Пишіть тут. ## — заголовок розділу, **жирний**, *курсив*, - список, > цитата.',
                        )}
                        className={cn(
                            input,
                            'min-h-[420px] py-3 font-mono text-[13.5px] leading-relaxed',
                        )}
                    />
                ) : (
                    <div
                        className="gc-article min-h-[420px] rounded-xl bg-white/[0.02] p-4"
                        dangerouslySetInnerHTML={{
                            __html: preview(form.data.body),
                        }}
                    />
                )}
                {error && <p className="text-sm text-rose-300">{error}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        disabled={form.processing}
                        onClick={() => submit(false)}
                        className="h-10 rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                    >
                        {tr('Зберегти чернетку')}
                    </button>
                    <button
                        type="button"
                        disabled={form.processing}
                        onClick={() => submit(true)}
                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                    >
                        {article?.is_published
                            ? tr('Оновити')
                            : tr('Опублікувати')}
                    </button>
                </div>
            </div>
        </>
    );
}

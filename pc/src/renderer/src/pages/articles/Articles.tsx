import { Bold, BookOpen, Clock, Eye, Heading2, ImagePlus, Italic, Link2, List, PenLine, Quote, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Discussions } from '@/components/Discussions';
import { Button, Card, Cover, Field, Input, Loading, PageHeader, Tabs, TextArea, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type ArticleCard = {
    id: number;
    slug: string;
    title: string;
    excerpt: string | null;
    cover: string | null;
    reading_minutes: number;
    views_count: number;
    is_published: boolean;
    published_at: string | null;
    user: User;
    game: { id: number; slug: string; name: string } | null;
};
type ListPage = { articles: { data: ArticleCard[]; current_page: number; last_page: number; total: number }; drafts: ArticleCard[]; game: { name: string } | null };

function ArticleTile({ a, big, onOpen }: { a: ArticleCard; big?: boolean; onOpen: () => void }) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className={`group flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-white/20 ${big ? 'col-span-2 row-span-2' : ''}`}
        >
            <Cover src={a.cover} className={`w-full ${big ? 'aspect-[16/8]' : 'aspect-[16/9]'}`} fallback={<BookOpen size={big ? 40 : 26} />} />
            <div className="flex flex-1 flex-col p-3.5">
                {a.game && <span className="mb-1 text-[11px] font-semibold text-neon-cyan">{a.game.name}</span>}
                <p className={`font-bold leading-snug ${big ? 'text-2xl' : 'line-clamp-2'}`}>{a.title}</p>
                {a.excerpt && <p className={`mt-1 text-sm text-white/55 ${big ? 'line-clamp-3' : 'line-clamp-2'}`}>{a.excerpt}</p>}
                <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-white/45">
                    <Avatar user={a.user} size={20} />
                    <span className="truncate">{a.user.name}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                        <span className="flex items-center gap-0.5">
                            <Clock size={11} /> {a.reading_minutes} хв
                        </span>
                        <span className="flex items-center gap-0.5">
                            <Eye size={11} /> {a.views_count}
                        </span>
                    </span>
                </div>
            </div>
        </button>
    );
}

/** «Статті»: гайди й огляди спільноти — свіжі, мої чернетки, написати свою. */
export function ArticlesList() {
    const [tab, setTab] = useState<'all' | 'drafts'>('all');
    const [page, setPage] = useState(1);
    const data = useSite<ListPage>(`/articles?page=${page}`);
    const nav = useNav();
    const d = data.data;
    const list = tab === 'all' ? (d?.articles.data ?? []) : (d?.drafts ?? []);
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Статті"
                subtitle={d ? `${d.articles.total} статей від гравців` : 'Гайди, огляди й історії гравців'}
                actions={
                    <Button tone="primary" onClick={() => nav.go('/articles/new')}>
                        <PenLine size={15} /> Написати статтю
                    </Button>
                }
            />
            <Tabs
                tabs={[
                    { id: 'all', label: 'Свіжі' },
                    { id: 'drafts', label: 'Мої чернетки', badge: d?.drafts.length || null },
                ]}
                value={tab}
                onChange={setTab}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {!d && <Loading error={data.error} />}
                {d && list.length === 0 && (
                    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                        <BookOpen size={36} className="mb-3 text-white/25" />
                        <p className="font-semibold">{tab === 'all' ? 'Статей ще немає' : 'Чернеток немає'}</p>
                        <p className="mt-1 max-w-sm text-sm text-white/45">Поділіться гайдом, оглядом гри чи історією вашої сім’ї — статтю побачать усі, хто грає в ту ж гру.</p>
                        <div className="mt-4">
                            <Button tone="primary" onClick={() => nav.go('/articles/new')}>
                                <PenLine size={15} /> Написати першою
                            </Button>
                        </div>
                    </div>
                )}
                {list.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                        {list.map((a, i) => (
                            <ArticleTile
                                key={a.id}
                                a={a}
                                big={tab === 'all' && page === 1 && i === 0 && list.length > 3}
                                onOpen={() => nav.go(tab === 'drafts' ? `/articles/${a.slug}/edit` : `/articles/${a.slug}`)}
                            />
                        ))}
                    </div>
                )}
                {tab === 'all' && d && d.articles.last_page > 1 && (
                    <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                        <Button small disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            ←
                        </Button>
                        {page} / {d.articles.last_page}
                        <Button small disabled={page >= d.articles.last_page} onClick={() => setPage(page + 1)}>
                            →
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

type ShowPage = { article: ArticleCard & { html: string; toc: { id: string; text: string; level: number }[] }; can_edit: boolean; can_delete: boolean; more: ArticleCard[] };

const PROSE =
    'text-[15px] leading-relaxed text-white/80 [&_a]:text-neon-cyan [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-neon-violet/60 [&_blockquote]:pl-4 [&_blockquote]:text-white/65 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_img]:my-4 [&_img]:rounded-xl [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/40 [&_pre]:p-3 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-6';

/** Стаття: обкладинка, зміст, текст, інші статті автора й обговорення. */
export function ArticleView({ slug }: { slug: string }) {
    const page = useSite<ShowPage>(`/articles/${slug}`);
    const { run } = useAction();
    const nav = useNav();
    const body = useRef<HTMLDivElement>(null);
    if (!page.data) return <Loading error={page.error} />;
    const { article: a, more } = page.data;
    return (
        <div className="h-full overflow-y-auto">
            <div className="relative">
                <Cover src={a.cover} className="h-72 w-full" fallback={<BookOpen size={48} />} />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#0c0f17]/40 to-[#0c0f17]" />
                <div className="absolute inset-x-0 top-0 px-5 pt-4">
                    <PageHeader
                        title=""
                        actions={
                            <div className="flex gap-2">
                                {page.data.can_edit && (
                                    <Button onClick={() => nav.go(`/articles/${a.slug}/edit`)}>
                                        <PenLine size={14} /> Редагувати
                                    </Button>
                                )}
                                {page.data.can_delete && (
                                    <Button onClick={() => confirm('Видалити статтю?') && void run('DELETE', `/articles/${a.slug}`, undefined, 'Статтю видалено.', () => nav.back())}>
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        }
                    />
                </div>
                <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1180px] px-5 pb-5">
                    {a.game && <span className="text-sm font-semibold text-neon-cyan">{a.game.name}</span>}
                    <h1 className="mt-1 text-4xl leading-tight font-black">{a.title}</h1>
                </div>
            </div>
            <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_280px] gap-8 px-5 pb-8 max-[1100px]:grid-cols-1">
                <article className="min-w-0">
                    <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
                        <button type="button" onClick={() => a.user.username && nav.go(`/u/${a.user.username}`)}>
                            <Avatar user={a.user} size={40} />
                        </button>
                        <div className="flex-1">
                            <p className="font-semibold">{a.user.name}</p>
                            <p className="text-xs text-white/45">
                                {when(a.published_at, false)} · {a.reading_minutes} хв читання · {a.views_count} переглядів
                            </p>
                        </div>
                    </div>
                    {a.excerpt && <p className="mb-4 text-lg text-white/70">{a.excerpt}</p>}
                    <div ref={body} className={PROSE} dangerouslySetInnerHTML={{ __html: a.html }} />
                    <div className="mt-8">
                        <h2 className="mb-3 text-lg font-bold">Обговорення</h2>
                        <Discussions subject={{ type: 'article', id: a.id }} />
                    </div>
                </article>
                <aside className="space-y-4 pt-1">
                    {a.toc.length > 1 && (
                        <Card title="Зміст">
                            <div className="space-y-1">
                                {a.toc.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => body.current?.querySelector(`#${CSS.escape(t.id)}`)?.scrollIntoView({ behavior: 'smooth' })}
                                        className={`block w-full truncate rounded-md px-2 py-1 text-left text-sm text-white/60 hover:bg-white/5 hover:text-white ${t.level > 2 ? 'pl-5 text-xs' : ''}`}
                                    >
                                        {t.text}
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                    {more.length > 0 && (
                        <Card title={`Ще від ${a.user.name}`}>
                            <div className="space-y-3">
                                {more.map((m) => (
                                    <button key={m.id} type="button" onClick={() => nav.go(`/articles/${m.slug}`)} className="flex w-full gap-3 text-left">
                                        <Cover src={m.cover} className="h-14 w-20 shrink-0 rounded-lg" fallback={<BookOpen size={16} />} />
                                        <span className="line-clamp-3 text-sm font-medium">{m.title}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
        </div>
    );
}

/** Редактор статті: Markdown з панеллю форматування, обкладинка, картинки в тексті, чернетка або публікація. */
export function ArticleEditor({ slug }: { slug: string | null }) {
    const page = useSite<{ article: (ArticleCard & { body: string }) | null }>(slug ? `/articles/${slug}/edit` : null);
    if (slug && !page.data) return <Loading error={page.error} />;
    return <EditorForm key={slug ?? 'new'} initial={page.data?.article ?? null} />;
}

function EditorForm({ initial }: { initial: (ArticleCard & { body: string }) | null }) {
    const nav = useNav();
    const toast = useToast();
    const [f, setF] = useState({ title: initial?.title ?? '', excerpt: initial?.excerpt ?? '', body: initial?.body ?? '' });
    const [cover, setCover] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const area = useRef<HTMLTextAreaElement>(null);
    const coverPreview = cover ? URL.createObjectURL(cover) : (initial?.cover ?? null);
    const wrap = (before: string, after = '', placeholder = 'текст'): void => {
        const el = area.current;
        if (!el) return;
        const { selectionStart: s, selectionEnd: e } = el;
        const sel = f.body.slice(s, e) || placeholder;
        const body = f.body.slice(0, s) + before + sel + after + f.body.slice(e);
        setF({ ...f, body });
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(s + before.length, s + before.length + sel.length);
        });
    };
    const insertImage = async (file: File): Promise<void> => {
        try {
            const r = await api<{ url: string }>('POST', '/api/v1/site/articles/images', {
                __form: true,
                fields: {},
                files: [{ field: 'image', name: file.name, type: file.type, data: await file.arrayBuffer() }],
            });
            wrap(`\n![${file.name.replace(/\.[^.]+$/, '')}](${r.url})\n`, '', '');
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const save = async (publish: boolean): Promise<void> => {
        setBusy(true);
        try {
            const fields = { title: f.title, excerpt: f.excerpt, body: f.body, publish: publish ? 1 : 0, game_id: initial?.game?.id ?? '' };
            const files = cover ? [{ field: 'cover', name: cover.name, type: cover.type, data: await cover.arrayBuffer() }] : [];
            const r = await api<{ redirect?: string | null; message?: string }>('POST', initial ? `/api/v1/site/articles/${initial.slug}` : '/api/v1/site/articles', { __form: true, fields, files });
            toast(publish ? 'Статтю опубліковано.' : 'Чернетку збережено.');
            const to = r.redirect?.replace(/\/edit$/, '');
            if (publish && to?.startsWith('/articles/')) nav.go(to);
        } catch (e) {
            toast((e as Error).message, 'error');
        } finally {
            setBusy(false);
        }
    };
    const tool = 'grid size-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white';
    const words = f.body.trim() ? f.body.trim().split(/\s+/).length : 0;
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={initial ? 'Редагування статті' : 'Нова стаття'}
                subtitle={`${words} слів · ~${Math.max(1, Math.round(words / 200))} хв читання`}
                actions={
                    <div className="flex gap-2">
                        <Button disabled={busy || f.title.trim().length < 3} onClick={() => void save(false)}>
                            Зберегти чернетку
                        </Button>
                        <Button tone="primary" disabled={busy || f.title.trim().length < 3 || f.body.trim().length < 50} onClick={() => void save(true)}>
                            Опублікувати
                        </Button>
                    </div>
                }
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-3">
                    <input
                        value={f.title}
                        maxLength={140}
                        placeholder="Заголовок"
                        onChange={(e) => setF({ ...f, title: e.target.value })}
                        className="bg-transparent text-3xl font-black outline-none placeholder:text-white/25"
                    />
                    <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
                        <button type="button" title="Підзаголовок" className={tool} onClick={() => wrap('\n## ', '\n', 'Підзаголовок')}>
                            <Heading2 size={16} />
                        </button>
                        <button type="button" title="Жирний" className={tool} onClick={() => wrap('**', '**')}>
                            <Bold size={16} />
                        </button>
                        <button type="button" title="Курсив" className={tool} onClick={() => wrap('_', '_')}>
                            <Italic size={16} />
                        </button>
                        <button type="button" title="Цитата" className={tool} onClick={() => wrap('\n> ', '\n', 'цитата')}>
                            <Quote size={16} />
                        </button>
                        <button type="button" title="Список" className={tool} onClick={() => wrap('\n- ', '\n', 'пункт')}>
                            <List size={16} />
                        </button>
                        <button type="button" title="Посилання" className={tool} onClick={() => wrap('[', '](https://)', 'посилання')}>
                            <Link2 size={16} />
                        </button>
                        <label title="Картинка в текст" className={`${tool} cursor-pointer`}>
                            <ImagePlus size={16} />
                            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void insertImage(e.target.files[0])} />
                        </label>
                        <span className="ml-auto pr-2 text-xs text-white/35">Markdown</span>
                    </div>
                    <textarea
                        ref={area}
                        value={f.body}
                        onChange={(e) => setF({ ...f, body: e.target.value })}
                        placeholder="Почніть писати… Підзаголовки (##) потраплять у зміст статті."
                        className="min-h-[420px] flex-1 resize-none rounded-2xl bg-white/[0.03] p-4 font-mono text-[14px] leading-relaxed ring-1 ring-white/10 outline-none focus:ring-neon-cyan/40"
                    />
                </div>
                <aside className="space-y-4">
                    <Card title="Обкладинка">
                        <label className="block cursor-pointer overflow-hidden rounded-xl ring-1 ring-white/10 hover:ring-neon-cyan/40">
                            <Cover
                                src={coverPreview}
                                className="aspect-[16/9] w-full"
                                fallback={
                                    <span className="flex items-center gap-2 text-sm">
                                        <ImagePlus size={16} /> Обрати картинку
                                    </span>
                                }
                            />
                            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
                        </label>
                    </Card>
                    <Card title="Опис">
                        <Field label="Кілька речень для картки статті" hint={`${f.excerpt.length}/300`}>
                            <TextArea rows={4} maxLength={300} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} />
                        </Field>
                    </Card>
                    {initial?.game && (
                        <Card title="Гра">
                            <Input readOnly value={initial.game.name} />
                        </Card>
                    )}
                    <Card title="Порада">
                        <p className="text-sm text-white/55">Додайте 2–3 підзаголовки — у статті зʼявиться зміст, а читачам буде легше знайти потрібне.</p>
                    </Card>
                </aside>
            </div>
        </div>
    );
}

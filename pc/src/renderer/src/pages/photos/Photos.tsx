import { ChevronLeft, ChevronRight, Globe, Heart, ImagePlus, Images, Lock, MessageCircle, Pencil, Plus, Star, Trash2, Upload, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Cover, Field, Input, Loading, Masonry, Modal, PageHeader, Select, SmartImage, StatTile, TextArea, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useNav } from '@/lib/nav';

type Thumb = { id: number; url: string; width: number | null; height: number | null; likes_count: number; comments_count: number; alt: string | null; is_sensitive: boolean };
type Album = {
    id: number;
    title: string;
    description: string | null;
    privacy: 'public' | 'friends' | 'private';
    comments_enabled: boolean;
    photos_count: number;
    cover_url: string | null;
    game: { name: string } | null;
    updated_at: string;
};
type Owner = { type: string; name: string; avatar_url: string | null; user?: User };
type Paged<T> = { data: T[]; current_page: number; last_page: number; total?: number };

const PRIVACY: Record<string, { label: string; icon: typeof Globe }> = {
    public: { label: 'Усім', icon: Globe },
    friends: { label: 'Друзям', icon: Users },
    private: { label: 'Лише мені', icon: Lock },
};

function Grid({ photos, onOpen }: { photos: Thumb[]; onOpen: (id: number) => void }) {
    return (
        <Masonry min={220}>
            {photos.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl ring-1 ring-white/10">
                    <div className="w-full bg-white/[0.04]" style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '4 / 3' }}>
                        <SmartImage src={p.url} className={`h-full w-full object-cover ${p.is_sensitive ? 'blur-xl' : ''}`} />
                    </div>
                    <span className="absolute inset-x-0 bottom-0 flex gap-3 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs opacity-0 transition group-hover:opacity-100">
                        <span className="flex items-center gap-1">
                            <Heart size={12} /> {p.likes_count}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageCircle size={12} /> {p.comments_count}
                        </span>
                    </span>
                </button>
            ))}
        </Masonry>
    );
}

/** «Фотографії»: альбоми людини чи спільноти та всі її фото. */
export function PhotosPage({ username }: { username: string | null }) {
    const { me } = useMe();
    const who = username ?? me?.username ?? null;
    const page = useSite<{ owner: Owner; albums: Album[]; photos: Paged<Thumb>; total: number; can: { create: boolean }; privacyOptions: string[] }>(who ? `/photos/u/${who}` : null);
    const nav = useNav();
    const [create, setCreate] = useState(false);
    const [open, setOpen] = useState<number | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={username ? `Фото · ${d.owner.name}` : 'Мої фотографії'}
                subtitle={`${d.total} фото · ${d.albums.length} альбомів`}
                image={d.owner.user ? <Avatar user={d.owner.user} size={44} /> : undefined}
                actions={
                    d.can.create && (
                        <Button tone="primary" onClick={() => setCreate(true)}>
                            <Plus size={15} /> Новий альбом
                        </Button>
                    )
                }
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <h2 className="mb-3 text-lg font-bold">Альбоми</h2>
                {d.albums.length === 0 ? (
                    <p className="mb-6 text-sm text-white/45">Альбомів ще немає.</p>
                ) : (
                    <div className="mb-7 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                        {d.albums.map((a) => {
                            const P = PRIVACY[a.privacy];
                            return (
                                <button key={a.id} type="button" onClick={() => nav.go(`/albums/${a.id}`)} className="group text-left">
                                    <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 transition group-hover:-translate-y-0.5 group-hover:ring-white/25">
                                        <Cover src={a.cover_url} className="aspect-[4/3] w-full" fallback={<Images size={30} />} />
                                        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] backdrop-blur">
                                            <P.icon size={10} /> {P.label}
                                        </span>
                                        <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">{a.photos_count} фото</span>
                                    </div>
                                    <p className="mt-2 truncate font-semibold">{a.title}</p>
                                    <p className="truncate text-xs text-white/45">{a.description ?? `оновлено ${when(a.updated_at, false)}`}</p>
                                </button>
                            );
                        })}
                    </div>
                )}
                <h2 className="mb-3 text-lg font-bold">Усі фото</h2>
                {d.photos.data.length === 0 ? (
                    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-14 text-center">
                        <ImagePlus size={34} className="mb-3 text-white/25" />
                        <p className="font-semibold">Фото ще немає</p>
                        <p className="mt-1 max-w-sm text-sm text-white/45">Створіть альбом — «Мій сетап», «Скріни з гри» чи «Зустріч сім’ї» — і завантажте до 30 фото за раз.</p>
                    </div>
                ) : (
                    <Grid photos={d.photos.data} onOpen={setOpen} />
                )}
            </div>
            {create && <AlbumForm onClose={() => setCreate(false)} onDone={page.reload} />}
            {open && <Lightbox id={open} onClose={() => setOpen(null)} onChanged={page.reload} />}
        </div>
    );
}

function AlbumForm({ album, onClose, onDone }: { album?: Album; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const nav = useNav();
    const [f, setF] = useState({ title: album?.title ?? '', description: album?.description ?? '', privacy: album?.privacy ?? 'public', comments_enabled: album?.comments_enabled ?? true });
    const submit = (): void =>
        void run(
            album ? 'PATCH' : 'POST',
            album ? `/albums/${album.id}` : '/albums',
            { ...f, description: f.description || null },
            album ? 'Альбом оновлено.' : 'Альбом створено. Додайте фотографії.',
            async () => {
                onClose();
                await onDone();
                if (!album) nav.go('/photos');
            },
        );
    return (
        <Modal title={album ? 'Налаштування альбому' : 'Новий альбом'} onClose={onClose}>
            <div className="space-y-3">
                <Field label="Назва">
                    <Input value={f.title} maxLength={80} onChange={(e) => setF({ ...f, title: e.target.value })} />
                </Field>
                <Field label="Опис">
                    <TextArea value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} />
                </Field>
                <Field label="Хто бачить">
                    <Select value={f.privacy} onChange={(e) => setF({ ...f, privacy: e.target.value as Album['privacy'] })}>
                        {Object.entries(PRIVACY).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v.label}
                            </option>
                        ))}
                    </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-white/70">
                    <input type="checkbox" checked={f.comments_enabled} onChange={(e) => setF({ ...f, comments_enabled: e.target.checked })} /> Дозволити коментарі
                </label>
                <div className="flex justify-end">
                    <Button tone="primary" disabled={busy || !f.title.trim()} onClick={submit}>
                        {album ? 'Зберегти' : 'Створити'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

/** Альбом: фото сіткою, завантаження кількох файлів, налаштування й видалення. */
export function AlbumPage({ id }: { id: number }) {
    const [pg, setPg] = useState(1);
    const page = useSite<{ album: Album & { owner: Owner }; photos: Paged<Thumb>; contributors: User[]; can: { manage: boolean; upload: boolean }; limits: { upload: number } }>(
        `/albums/${id}?page=${pg}`,
    );
    const { run } = useAction();
    const toast = useToast();
    const nav = useNav();
    const [edit, setEdit] = useState(false);
    const [open, setOpen] = useState<number | null>(null);
    const [uploading, setUploading] = useState(0);
    if (!page.data) return <Loading error={page.error} />;
    const { album: a, photos, can, limits } = page.data;
    const P = PRIVACY[a.privacy];
    const upload = async (files: File[]): Promise<void> => {
        const list = files.slice(0, limits.upload);
        setUploading(list.length);
        try {
            const data = await Promise.all(list.map(async (f) => ({ field: 'photos[]', name: f.name, type: f.type, data: await f.arrayBuffer() })));
            await api('POST', `/api/v1/site/albums/${a.id}/photos`, { __form: true, fields: {}, files: data });
            toast(`Завантажено ${list.length} фото.`);
            await page.reload();
        } catch (e) {
            toast((e as Error).message, 'error');
        } finally {
            setUploading(0);
        }
    };
    return (
        <div
            className="flex h-full flex-col"
            onDragOver={(e) => can.upload && e.preventDefault()}
            onDrop={(e) => {
                if (!can.upload) return;
                e.preventDefault();
                void upload([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
            }}
        >
            <PageHeader
                title={a.title}
                subtitle={
                    <span className="flex items-center gap-1.5">
                        <P.icon size={12} /> {P.label} · {a.photos_count} фото · {a.owner.name}
                    </span>
                }
                actions={
                    <div className="flex gap-2">
                        {can.upload && (
                            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 text-sm font-semibold text-black">
                                <Upload size={15} /> {uploading ? `Завантажуємо ${uploading}…` : 'Додати фото'}
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    hidden
                                    disabled={!!uploading}
                                    onChange={(e) => e.target.files && void upload([...e.target.files])}
                                />
                            </label>
                        )}
                        {can.manage && (
                            <>
                                <Button onClick={() => setEdit(true)}>
                                    <Pencil size={14} />
                                </Button>
                                <Button onClick={() => confirm('Видалити альбом разом з фото?') && void run('DELETE', `/albums/${a.id}`, undefined, 'Альбом видалено.', () => nav.back())}>
                                    <Trash2 size={14} />
                                </Button>
                            </>
                        )}
                    </div>
                }
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0">
                    {photos.data.length === 0 ? (
                        <div className="grid place-items-center rounded-2xl border border-dashed border-white/15 py-20 text-center">
                            <ImagePlus size={36} className="mb-3 text-white/25" />
                            <p className="font-semibold">Альбом порожній</p>
                            <p className="mt-1 text-sm text-white/45">{can.upload ? `Перетягніть сюди фото або натисніть «Додати фото» — до ${limits.upload} за раз.` : 'Тут поки нічого немає.'}</p>
                        </div>
                    ) : (
                        <Grid photos={photos.data} onOpen={setOpen} />
                    )}
                    {photos.last_page > 1 && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                            <Button small disabled={pg <= 1} onClick={() => setPg(pg - 1)}>
                                ←
                            </Button>
                            {pg} / {photos.last_page}
                            <Button small disabled={pg >= photos.last_page} onClick={() => setPg(pg + 1)}>
                                →
                            </Button>
                        </div>
                    )}
                </div>
                <aside className="space-y-4">
                    <Card>
                        <Cover src={a.cover_url} className="mb-3 aspect-[4/3] w-full rounded-xl" fallback={<Images size={28} />} />
                        {a.description && <p className="mb-2 text-sm text-white/65">{a.description}</p>}
                        <p className="text-xs text-white/45">Оновлено {when(a.updated_at)}</p>
                    </Card>
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Фото" value={a.photos_count} accent />
                        <StatTile label="Вподобань" value={photos.data.reduce((s, p) => s + p.likes_count, 0)} />
                    </div>
                    {page.data.contributors.length > 0 && (
                        <Card title="Співавтори">
                            {page.data.contributors.map((u) => (
                                <div key={u.id} className="flex items-center gap-2 py-1 text-sm">
                                    <Avatar user={u} size={26} /> {u.name}
                                </div>
                            ))}
                        </Card>
                    )}
                </aside>
            </div>
            {edit && <AlbumForm album={a} onClose={() => setEdit(false)} onDone={page.reload} />}
            {open && <Lightbox id={open} onClose={() => setOpen(null)} onChanged={page.reload} />}
        </div>
    );
}

type PhotoFull = Thumb & {
    caption: string | null;
    views_count: number;
    created_at: string;
    user: User | null;
    liked: boolean;
    is_cover: boolean;
    position: number;
    album: Album & { owner: Owner };
    prev_id: number | null;
    next_id: number | null;
    tags: User[];
    can: { edit: boolean; delete: boolean; cover: boolean; comment: boolean };
};
type Comment = { id: number; body: string | null; user: User; created_at: string };

/** Перегляд фото: гортання стрілками, вподобання, підпис, обкладинка альбому, коментарі. */
function Lightbox({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => Promise<void> }) {
    const [cur, setCur] = useState(id);
    const [d, setD] = useState<{ photo: PhotoFull; comments: Comment[] } | null>(null);
    const [body, setBody] = useState('');
    const [caption, setCaption] = useState<string | null>(null);
    const toast = useToast();
    const load = async (pid: number): Promise<void> => setD(await api('GET', `/api/v1/site/photos/${pid}`));
    useEffect(() => {
        void load(cur).catch((e: Error) => toast(e.message, 'error'));
    }, [cur, toast]);
    useEffect(() => {
        const key = (e: KeyboardEvent): void => {
            if (e.key === 'ArrowLeft' && d?.photo.prev_id) setCur(d.photo.prev_id);
            if (e.key === 'ArrowRight' && d?.photo.next_id) setCur(d.photo.next_id);
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [d, onClose]);
    const act = async (method: string, path: string, payload?: unknown, msg?: string): Promise<void> => {
        try {
            await api(method, `/api/v1/site${path}`, payload);
            if (msg) toast(msg);
            await load(cur);
            void onChanged();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const p = d?.photo;
    return (
        <div className="fixed inset-0 z-50 grid grid-cols-[minmax(0,1fr)_360px] bg-black/90 backdrop-blur" onClick={onClose}>
            <div className="relative grid min-h-0 place-items-center p-6" onClick={(e) => e.stopPropagation()}>
                {p ? <SmartImage src={p.url} className="max-h-[calc(100vh-48px)] max-w-full rounded-lg object-contain" /> : <Loading />}
                {p?.prev_id && (
                    <button
                        type="button"
                        onClick={() => setCur(p.prev_id!)}
                        className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                    >
                        <ChevronLeft size={22} />
                    </button>
                )}
                {p?.next_id && (
                    <button
                        type="button"
                        onClick={() => setCur(p.next_id!)}
                        className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                    >
                        <ChevronRight size={22} />
                    </button>
                )}
            </div>
            <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#0f121b]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 border-b border-white/10 p-4">
                    {p?.user && <Avatar user={p.user} size={36} />}
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p?.user?.name ?? p?.album.owner.name}</p>
                        <p className="truncate text-xs text-white/45">{p ? `${p.album.title} · ${p.position}/${p.album.photos_count} · ${when(p.created_at)}` : ''}</p>
                    </div>
                    <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-white/10">
                        <X size={18} />
                    </button>
                </div>
                {p && (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                        {caption !== null ? (
                            <div className="space-y-2">
                                <TextArea value={caption} maxLength={500} onChange={(e) => setCaption(e.target.value)} />
                                <div className="flex gap-2">
                                    <Button small tone="primary" onClick={() => void act('PATCH', `/photos/${p.id}`, { caption: caption || null }, 'Підпис збережено.').then(() => setCaption(null))}>
                                        Зберегти
                                    </Button>
                                    <Button small onClick={() => setCaption(null)}>
                                        Скасувати
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            p.caption && <p className="text-sm whitespace-pre-wrap text-white/80">{p.caption}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <Button small tone={p.liked ? 'primary' : 'ghost'} onClick={() => void act('POST', `/photos/${p.id}/like`)}>
                                <Heart size={14} fill={p.liked ? 'currentColor' : 'none'} /> {p.likes_count}
                            </Button>
                            {p.can.edit && caption === null && (
                                <Button small onClick={() => setCaption(p.caption ?? '')}>
                                    <Pencil size={13} /> Підпис
                                </Button>
                            )}
                            {p.can.cover && !p.is_cover && (
                                <Button small onClick={() => void act('POST', `/photos/${p.id}/cover`, undefined, 'Обкладинку альбому змінено.')}>
                                    <Star size={13} /> Обкладинка
                                </Button>
                            )}
                            {p.can.delete && (
                                <Button
                                    small
                                    onClick={() =>
                                        confirm('Видалити фото?') &&
                                        void api('DELETE', `/api/v1/site/photos/${p.id}`).then(() => {
                                            toast('Фото видалено.');
                                            void onChanged();
                                            if (p.next_id ?? p.prev_id) setCur((p.next_id ?? p.prev_id)!);
                                            else onClose();
                                        })
                                    }
                                >
                                    <Trash2 size={13} />
                                </Button>
                            )}
                        </div>
                        {p.tags.length > 0 && (
                            <div>
                                <p className="mb-1.5 text-xs text-white/45">На фото</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {p.tags.map((u) => (
                                        <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-0.5 pr-2.5 pl-0.5 text-xs">
                                            <Avatar user={u} size={20} /> {u.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <p className="mb-2 text-xs text-white/45">Коментарі · {p.comments_count}</p>
                            <div className="space-y-2.5">
                                {d.comments.map((c) => (
                                    <div key={c.id} className="flex gap-2">
                                        <Avatar user={c.user} size={28} />
                                        <div className="min-w-0 flex-1 rounded-xl bg-white/[0.05] px-3 py-1.5 text-sm">
                                            <b className="text-xs">{c.user.name}</b> <span className="text-[10px] text-white/40">{when(c.created_at)}</span>
                                            <p className="whitespace-pre-wrap text-white/80">{c.body}</p>
                                        </div>
                                    </div>
                                ))}
                                {d.comments.length === 0 && <p className="text-sm text-white/40">Будьте першим, хто прокоментує.</p>}
                            </div>
                        </div>
                    </div>
                )}
                {p?.can.comment && (
                    <form
                        className="flex gap-2 border-t border-white/10 p-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (body.trim()) void act('POST', `/photos/${p.id}/comments`, { body }).then(() => setBody(''));
                        }}
                    >
                        <Input value={body} maxLength={2000} placeholder="Коментар…" onChange={(e) => setBody(e.target.value)} />
                        <Button type="submit" tone="primary" disabled={!body.trim()}>
                            →
                        </Button>
                    </form>
                )}
            </aside>
        </div>
    );
}

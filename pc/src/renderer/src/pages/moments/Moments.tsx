import { Clapperboard, Crown, Film, Heart, Link2, Play, Plus, Trash2, Trophy, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Card, Cover, Field, Input, Loading, Modal, PageHeader, Select, StatTile, Tabs, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Moment = {
    id: number;
    title: string | null;
    provider: string;
    provider_label: string;
    url: string;
    player: string | null;
    video: string | null;
    status: string;
    duration: number | null;
    thumbnail: string | null;
    likes: number;
    liked: boolean;
    can_delete: boolean;
    user: User;
    game: { slug: string; name: string } | null;
    server: { slug: string; name: string } | null;
    created_at: string;
};
type Game = { slug: string; name: string };
type Page = {
    clip_of_week: {
        winner: { week: string; likes: number; moment: Moment } | null;
        leader: { likes: number; moment: Moment } | null;
        history: { week: string; likes: number; moment: Moment }[];
    } | null;
    moments: Moment[];
    more: boolean;
    filters: { tab: string; game: string | null; page: number };
    games: Game[];
    options: { games: Game[] };
};

const MAX_CLIP = 90;
const secs = (n: number | null): string => (n ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : '');

function Thumb({ m, onOpen, big }: { m: Moment; onOpen: () => void; big?: boolean }) {
    return (
        <button type="button" onClick={onOpen} className="group relative block w-full overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition hover:ring-neon-cyan/40">
            <Cover src={m.thumbnail} className={`w-full ${big ? 'aspect-video' : 'aspect-video'}`} fallback={<Film size={big ? 40 : 26} />} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            <span className="absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 opacity-0 backdrop-blur transition group-hover:opacity-100">
                <Play size={20} fill="currentColor" />
            </span>
            <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur">{m.provider_label}</span>
            {m.duration ? <span className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] backdrop-blur">{secs(m.duration)}</span> : null}
            <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className={`truncate font-semibold ${big ? 'text-lg' : 'text-sm'}`}>{m.title ?? 'Без назви'}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/65">
                    <Avatar user={m.user} size={16} />
                    <span className="truncate">{m.user.name}</span>
                    {m.game && <span className="truncate text-white/45">· {m.game.name}</span>}
                    <span className={`ml-auto flex items-center gap-0.5 ${m.liked ? 'text-rose-300' : ''}`}>
                        <Heart size={11} fill={m.liked ? 'currentColor' : 'none'} /> {m.likes}
                    </span>
                </div>
            </div>
            {m.status !== 'ready' && m.provider === 'upload' && <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white/70">Обробляємо відео…</span>}
        </button>
    );
}

/** «Моменти»: найкращі кліпи гравців — кліп тижня, стрічка, лайки й власні кліпи (посилання чи файл з обрізкою). */
export function MomentsPage() {
    const [tab, setTab] = useState<'new' | 'week' | 'friends'>('new');
    const [game, setGame] = useState('');
    const [page, setPage] = useState(1);
    const data = useSite<Page>(`/moments?tab=${tab}&page=${page}${game ? `&game=${game}` : ''}`);
    const [open, setOpen] = useState<Moment | null>(null);
    const [add, setAdd] = useState(false);
    const d = data.data;
    const cow = d?.clip_of_week;
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Моменти"
                subtitle="Найкращі кліпи гравців"
                actions={
                    <Button tone="primary" onClick={() => setAdd(true)}>
                        <Plus size={15} /> Додати кліп
                    </Button>
                }
            />
            <Tabs
                tabs={[
                    { id: 'new', label: 'Нові' },
                    { id: 'week', label: 'Топ тижня' },
                    { id: 'friends', label: 'Друзі' },
                ]}
                value={tab}
                onChange={(t) => (setTab(t), setPage(1))}
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0">
                    {!d && <Loading error={data.error} />}
                    {d && (
                        <>
                            {d.games.length > 0 && (
                                <div className="mb-4 flex flex-wrap gap-1.5">
                                    {[{ slug: '', name: 'Усі ігри' }, ...d.games.slice(0, 14)].map((g) => (
                                        <button
                                            key={g.slug}
                                            type="button"
                                            onClick={() => (setGame(g.slug), setPage(1))}
                                            className={`h-8 rounded-lg px-3 text-sm ring-1 ${game === g.slug ? 'bg-white/10 ring-white/25' : 'text-white/60 ring-white/10 hover:bg-white/5'}`}
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {d.moments.length === 0 ? (
                                <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                                    <Clapperboard size={36} className="mb-3 text-white/25" />
                                    <p className="font-semibold">{tab === 'friends' ? 'Друзі ще не ділилися кліпами' : 'Кліпів поки немає'}</p>
                                    <p className="mt-1 max-w-sm text-sm text-white/45">
                                        Ейс, кумедний баг чи епічна погоня — додайте посилання з YouTube, Twitch, Medal або завантажте відео прямо з ПК.
                                    </p>
                                    <div className="mt-4">
                                        <Button tone="primary" onClick={() => setAdd(true)}>
                                            <Plus size={15} /> Додати перший
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                                    {d.moments.map((m) => (
                                        <Thumb key={m.id} m={m} onOpen={() => setOpen(m)} />
                                    ))}
                                </div>
                            )}
                            {(page > 1 || d.more) && (
                                <div className="mt-5 flex items-center justify-center gap-2 text-sm">
                                    <Button small disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                        ←
                                    </Button>
                                    {page}
                                    <Button small disabled={!d.more} onClick={() => setPage(page + 1)}>
                                        →
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="На сторінці" value={d?.moments.length ?? '—'} accent />
                        <StatTile label="Лайків" value={d ? d.moments.reduce((s, m) => s + m.likes, 0) : '—'} />
                    </div>
                    <Card
                        title={
                            <span className="flex items-center gap-2">
                                <Trophy size={15} className="text-amber-300" /> Кліп тижня
                            </span>
                        }
                    >
                        {!cow?.winner && !cow?.leader && <p className="text-sm text-white/50">Ставте лайки кліпам — найпопулярніший за тиждень стане «Кліпом тижня» і потрапить в архів.</p>}
                        {cow?.winner && (
                            <div className="mb-3">
                                <p className="mb-1.5 flex items-center gap-1 text-xs text-amber-300">
                                    <Crown size={12} /> Переможець минулого тижня · {cow.winner.likes} ♥
                                </p>
                                <Thumb m={cow.winner.moment} onOpen={() => setOpen(cow.winner!.moment)} />
                            </div>
                        )}
                        {cow?.leader && (
                            <div>
                                <p className="mb-1.5 text-xs text-white/50">Лідирує цього тижня · {cow.leader.likes} ♥</p>
                                <Thumb m={cow.leader.moment} onOpen={() => setOpen(cow.leader!.moment)} />
                            </div>
                        )}
                    </Card>
                    {cow && cow.history.length > 0 && (
                        <Card title="Архів">
                            <div className="space-y-2">
                                {cow.history.map((h) => (
                                    <button key={h.week} type="button" onClick={() => setOpen(h.moment)} className="flex w-full items-center gap-2.5 text-left">
                                        <Cover src={h.moment.thumbnail} className="h-12 w-20 shrink-0 rounded-lg" fallback={<Film size={14} />} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">{h.moment.title ?? 'Без назви'}</span>
                                            <span className="block text-[11px] text-white/45">тиждень з {when(h.week, false)}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
            {open && <Viewer m={open} onClose={() => setOpen(null)} onChanged={data.reload} />}
            {add && d && <AddMoment games={d.options.games} onClose={() => setAdd(false)} onDone={data.reload} />}
        </div>
    );
}

function Viewer({ m, onClose, onChanged }: { m: Moment; onClose: () => void; onChanged: () => Promise<void> }) {
    const { run } = useAction();
    const nav = useNav();
    const [liked, setLiked] = useState(m.liked);
    const [likes, setLikes] = useState(m.likes);
    return (
        <Modal title={m.title ?? 'Момент'} onClose={onClose} wide>
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
                {m.video ? (
                    <video src={m.video} poster={m.thumbnail ?? undefined} controls autoPlay className="h-full w-full" />
                ) : m.player ? (
                    <iframe src={m.player} title={m.title ?? 'clip'} allow="autoplay; fullscreen" allowFullScreen className="h-full w-full" />
                ) : (
                    <div className="grid h-full place-items-center text-sm text-white/50">Відео ще обробляється.</div>
                )}
            </div>
            <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={() => m.user.username && (onClose(), nav.go(`/u/${m.user.username}`))}>
                    <Avatar user={m.user} size={36} />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.user.name}</p>
                    <p className="text-xs text-white/45">{[m.game?.name, m.server?.name, when(m.created_at)].filter(Boolean).join(' · ')}</p>
                </div>
                <Button
                    tone={liked ? 'primary' : 'ghost'}
                    onClick={() =>
                        void api('POST', `/api/v1/site/moments/${m.id}/like`).then(() => {
                            setLikes(likes + (liked ? -1 : 1));
                            setLiked(!liked);
                            void onChanged();
                        })
                    }
                >
                    <Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {likes}
                </Button>
                {m.can_delete && (
                    <Button onClick={() => confirm('Видалити кліп?') && void run('DELETE', `/moments/${m.id}`, undefined, 'Кліп видалено.', async () => (onClose(), await onChanged()))}>
                        <Trash2 size={15} />
                    </Button>
                )}
            </div>
        </Modal>
    );
}

function AddMoment({ games, onClose, onDone }: { games: Game[]; onClose: () => void; onDone: () => Promise<void> }) {
    const [mode, setMode] = useState<'link' | 'file'>('link');
    const [f, setF] = useState({ url: '', title: '', game: '' });
    const [file, setFile] = useState<File | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [len, setLen] = useState(0);
    const [cut, setCut] = useState({ start: 0, end: 0 });
    const [busy, setBusy] = useState(false);
    const video = useRef<HTMLVideoElement>(null);
    const toast = useToast();
    const pick = (fl: File | null): void => {
        setFile(fl);
        setSrc(fl ? URL.createObjectURL(fl) : null);
        if (fl && !f.title) setF({ ...f, title: fl.name.replace(/\.[^.]+$/, '') });
    };
    const submit = async (): Promise<void> => {
        setBusy(true);
        try {
            if (mode === 'link') {
                await api('POST', '/api/v1/site/moments', { url: f.url.trim(), title: f.title || null, game: f.game || null });
            } else if (file) {
                await api('POST', '/api/v1/site/moments/upload', {
                    __form: true,
                    fields: { start: cut.start.toFixed(2), end: cut.end.toFixed(2), title: f.title, game: f.game },
                    files: [{ field: 'video', name: file.name, type: file.type || 'video/mp4', data: await file.arrayBuffer() }],
                });
            }
            toast(mode === 'file' ? 'Кліп завантажено — обробимо за хвилину.' : 'Кліп додано.');
            onClose();
            await onDone();
        } catch (e) {
            toast((e as Error).message, 'error');
        } finally {
            setBusy(false);
        }
    };
    const length = cut.end - cut.start;
    return (
        <Modal title="Додати кліп" onClose={onClose} wide>
            <Tabs
                tabs={[
                    { id: 'link', label: 'Посилання' },
                    { id: 'file', label: 'Файл з ПК' },
                ]}
                value={mode}
                onChange={setMode}
            />
            <div className="mt-4 space-y-3">
                {mode === 'link' ? (
                    <Field label="Посилання" hint="YouTube, Twitch чи Medal">
                        <div className="relative">
                            <Link2 size={15} className="absolute top-3 left-3 text-white/40" />
                            <Input value={f.url} placeholder="https://youtu.be/…" onChange={(e) => setF({ ...f, url: e.target.value })} className="pl-9" />
                        </div>
                    </Field>
                ) : (
                    <>
                        {!src ? (
                            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 py-10 text-sm text-white/55 hover:bg-white/[0.03]">
                                <Upload size={26} />
                                Оберіть відео (MP4, WebM, MOV, MKV — до 300 МБ)
                                <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                            </label>
                        ) : (
                            <>
                                <video
                                    ref={video}
                                    src={src}
                                    controls
                                    className="aspect-video w-full rounded-xl bg-black"
                                    onLoadedMetadata={(e) => {
                                        const dur = e.currentTarget.duration;
                                        setLen(dur);
                                        setCut({ start: 0, end: Math.min(dur, MAX_CLIP) });
                                    }}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label={`Початок · ${cut.start.toFixed(1)} с`}>
                                        <input
                                            type="range"
                                            min={0}
                                            max={len}
                                            step={0.1}
                                            value={cut.start}
                                            className="w-full accent-cyan-400"
                                            onChange={(e) => {
                                                const s = Number(e.target.value);
                                                setCut({ start: s, end: Math.min(Math.max(cut.end, s + 1), s + MAX_CLIP, len) });
                                                if (video.current) video.current.currentTime = s;
                                            }}
                                        />
                                    </Field>
                                    <Field label={`Кінець · ${cut.end.toFixed(1)} с`}>
                                        <input
                                            type="range"
                                            min={0}
                                            max={len}
                                            step={0.1}
                                            value={cut.end}
                                            className="w-full accent-violet-400"
                                            onChange={(e) => {
                                                const en = Number(e.target.value);
                                                setCut({ start: Math.max(Math.min(cut.start, en - 1), en - MAX_CLIP, 0), end: en });
                                                if (video.current) video.current.currentTime = en;
                                            }}
                                        />
                                    </Field>
                                </div>
                                <p className={`text-xs ${length > MAX_CLIP ? 'text-rose-300' : 'text-white/50'}`}>
                                    Кліп: {length.toFixed(1)} с (до {MAX_CLIP} с). Обріжемо на сервері — повне відео не зберігається.
                                </p>
                            </>
                        )}
                    </>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Назва">
                        <Input value={f.title} maxLength={140} onChange={(e) => setF({ ...f, title: e.target.value })} />
                    </Field>
                    <Field label="Гра">
                        <Select value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })}>
                            <option value="">Не вказано</option>
                            {games.map((g) => (
                                <option key={g.slug} value={g.slug}>
                                    {g.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>
                <div className="flex justify-end">
                    <Button tone="primary" disabled={busy || (mode === 'link' ? !f.url.trim() : !file || f.title.trim().length < 2 || length <= 0 || length > MAX_CLIP)} onClick={() => void submit()}>
                        {busy ? 'Завантажуємо…' : 'Опублікувати'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

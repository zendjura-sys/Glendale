import { Clapperboard, Eye, Heart, Radio, Send, Volume2, VolumeX } from 'lucide-react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Loading, PageHeader, StatTile, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Broadcast = {
    id: number;
    title: string;
    category: string | null;
    status: string;
    started_at: string | null;
    viewers: number;
    peak_viewers: number;
    likes: number;
    host: User | null;
    donations: { provider: string; url: string }[];
};
type Gift = { key: string; emoji: string; label: string };
type Msg = { id: number; kind: string; gift_key: string | null; gift: Gift | null; body: string | null; created_at: string; user: User | null };
type State = { broadcast: Broadcast; messages: Msg[]; gifts: Gift[]; me: { is_host: boolean; liked: boolean } | null; can_manage: boolean };

/** LiveCast: хто в ефірі зараз, пульс і запуск власного стріму зі Студії. */
export function LiveCastList() {
    const page = useSite<{ live: Broadcast[]; pulse: { live: number; viewers: number }; gifts: Gift[] }>('/livecast');
    const nav = useNav();
    const d = page.data;
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="LiveCast"
                subtitle="Стріми камерою чи екраном — дивіться й спілкуйтеся в чаті"
                actions={
                    <Button tone="primary" onClick={() => void window.gamecon.studio.open()}>
                        <Clapperboard size={15} /> Студія — почати стрім
                    </Button>
                }
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0">
                    {!d && <Loading error={page.error} />}
                    {d && d.live.length === 0 && (
                        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                            <Radio size={36} className="mb-3 text-white/25" />
                            <p className="font-semibold">Зараз ніхто не в ефірі</p>
                            <p className="mt-1 max-w-sm text-sm text-white/45">Станьте першим: Студія GameCon покаже гру, камеру й чат — як OBS, але без налаштувань.</p>
                            <div className="mt-4">
                                <Button tone="primary" onClick={() => void window.gamecon.studio.open()}>
                                    <Clapperboard size={15} /> Відкрити Студію
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                        {d?.live.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                onClick={() => nav.go(`/livecast/${b.id}`)}
                                className="group overflow-hidden rounded-2xl bg-white/[0.04] text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-rose-400/40"
                            >
                                <div className="relative grid aspect-video place-items-center bg-gradient-to-br from-rose-500/20 via-neon-violet/15 to-black">
                                    {b.host && <Avatar user={b.host} size={64} />}
                                    <span className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold">
                                        <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
                                    </span>
                                    <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] backdrop-blur">
                                        <Eye size={11} /> {b.viewers}
                                    </span>
                                </div>
                                <div className="p-3">
                                    <p className="truncate font-semibold">{b.title}</p>
                                    <p className="truncate text-xs text-white/50">
                                        {b.host?.name}
                                        {b.category ? ` · ${b.category}` : ''}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="В ефірі" value={d?.pulse.live ?? '—'} accent />
                        <StatTile label="Глядачів" value={d?.pulse.viewers ?? '—'} />
                    </div>
                    <Card title="Подарунки стрімерам">
                        <div className="grid grid-cols-4 gap-2 text-center">
                            {d?.gifts.map((g) => (
                                <div key={g.key} className="rounded-xl bg-white/[0.04] py-2 ring-1 ring-white/[0.06]">
                                    <p className="text-2xl">{g.emoji}</p>
                                    <p className="truncate text-[10px] text-white/50">{g.label}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                    <Card title="Як стрімити">
                        <ul className="space-y-2 text-sm text-white/60">
                            <li>• Відкрийте Студію й оберіть джерело: гра, екран чи камера.</li>
                            <li>• Додайте назву й посилання на донати — Donatik, Donatello чи банку.</li>
                            <li>• Чат і подарунки глядачів бачите просто в Студії.</li>
                        </ul>
                    </Card>
                </aside>
            </div>
        </div>
    );
}

/** Перегляд стріму: відео й звук через LiveKit, чат, вподобання й подарунки. */
export function LiveCastView({ id }: { id: number }) {
    const [state, setState] = useState<State | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [body, setBody] = useState('');
    const [muted, setMuted] = useState(false);
    const [hasVideo, setHasVideo] = useState(false);
    const video = useRef<HTMLDivElement>(null);
    const room = useRef<Room | null>(null);
    const chat = useRef<HTMLDivElement>(null);
    const toast = useToast();
    const base = `/api/v1/site/livecast/${id}`;

    useEffect(() => {
        let alive = true;
        const r = new Room({ adaptiveStream: true });
        room.current = r;
        r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            const el = track.attach();
            el.className = track.kind === Track.Kind.Video ? 'h-full w-full object-contain' : 'hidden';
            video.current?.appendChild(el);
            if (track.kind === Track.Kind.Video) setHasVideo(true);
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            track.detach().forEach((el) => el.remove());
            if (track.kind === Track.Kind.Video) setHasVideo(false);
        });
        void (async () => {
            try {
                const j = await api<{ url: string; token: string }>('POST', `${base}/join`);
                if (alive) await r.connect(j.url, j.token, { autoSubscribe: true });
            } catch (e) {
                if (alive) setError((e as Error).message);
            }
        })();
        return () => {
            alive = false;
            void r.disconnect();
            void api('POST', `${base}/leave`).catch(() => undefined);
        };
    }, [base]);

    useEffect(() => {
        let stop = false;
        const tick = async (): Promise<void> => {
            try {
                const s = await api<State>('GET', `${base}/state`);
                if (!stop) setState(s);
            } catch (e) {
                if (!stop) setError((e as Error).message);
            }
        };
        void tick();
        const t = window.setInterval(tick, 4000);
        return () => {
            stop = true;
            window.clearInterval(t);
        };
    }, [base]);

    useEffect(() => {
        chat.current?.scrollTo({ top: chat.current.scrollHeight });
    }, [state?.messages.length]);

    useEffect(() => {
        video.current?.querySelectorAll('audio,video').forEach((el) => ((el as HTMLMediaElement).muted = muted));
    }, [muted, hasVideo]);

    if (!state) return <Loading error={error} />;
    const b = state.broadcast;
    const post = async (path: string, payload?: unknown): Promise<void> => {
        try {
            setState(await api<State>('POST', `${base}/${path}`, payload));
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={b.title}
                subtitle={`${b.host?.name ?? ''}${b.category ? ` · ${b.category}` : ''} · ${b.status === 'live' ? `в ефірі з ${when(b.started_at)}` : 'ефір завершено'}`}
                image={b.host ? <Avatar user={b.host} size={44} /> : undefined}
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-4 p-4 max-[1100px]:grid-cols-1">
                <div className="flex min-h-0 min-w-0 flex-col gap-3">
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
                        <div ref={video} className="h-full w-full" />
                        {!hasVideo && (
                            <div className="absolute inset-0 grid place-items-center text-center text-white/50">
                                <div>
                                    {b.host && <Avatar user={b.host} size={72} />}
                                    <p className="mt-3 text-sm">{b.status === 'live' ? 'Підключаємося до ефіру…' : 'Ефір завершено'}</p>
                                </div>
                            </div>
                        )}
                        {b.status === 'live' && (
                            <span className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-rose-500 px-2 py-0.5 text-xs font-bold">
                                <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setMuted(!muted)}
                            className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
                        >
                            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-sm text-white/60">
                            <Eye size={14} /> {b.viewers} дивляться
                        </span>
                        <Button small tone={state.me?.liked ? 'primary' : 'ghost'} onClick={() => void post('like')}>
                            <Heart size={14} fill={state.me?.liked ? 'currentColor' : 'none'} /> {b.likes}
                        </Button>
                        <div className="ml-auto flex gap-1">
                            {state.gifts.map((g) => (
                                <button
                                    key={g.key}
                                    type="button"
                                    title={g.label}
                                    onClick={() => void post('gifts', { gift: g.key })}
                                    className="grid size-9 place-items-center rounded-lg text-xl ring-1 ring-white/10 transition hover:scale-110 hover:bg-white/10"
                                >
                                    {g.emoji}
                                </button>
                            ))}
                        </div>
                        {b.donations.map((dn) => (
                            <a
                                key={dn.url}
                                href={dn.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30"
                            >
                                Підтримати · {dn.provider}
                            </a>
                        ))}
                    </div>
                </div>
                <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
                    <p className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Чат ефіру</p>
                    <div ref={chat} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                        {state.messages.length === 0 && <p className="py-6 text-center text-sm text-white/40">Привітайте стрімера першим 👋</p>}
                        {state.messages.map((m) => (
                            <div key={m.id} className={`flex gap-2 text-sm ${m.gift ? 'rounded-lg bg-neon-violet/10 p-1.5' : ''}`}>
                                {m.user && <Avatar user={m.user} size={22} />}
                                <p className="min-w-0 break-words text-white/80">
                                    <b className="text-white">{m.user?.name}</b> {m.gift ? `${m.gift.emoji} подарував(ла) «${m.gift.label}»` : m.body}
                                </p>
                            </div>
                        ))}
                    </div>
                    <form
                        className="flex gap-2 border-t border-white/10 p-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (body.trim()) void post('messages', { body }).then(() => setBody(''));
                        }}
                    >
                        <input
                            value={body}
                            maxLength={280}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Повідомлення…"
                            className="h-10 min-w-0 flex-1 rounded-xl bg-white/[0.05] px-3 text-sm ring-1 ring-white/10 outline-none focus:ring-neon-cyan/40"
                        />
                        <Button type="submit" tone="primary" disabled={!body.trim()}>
                            <Send size={14} />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}

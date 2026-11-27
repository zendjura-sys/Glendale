import { CalendarClock, Hand, Heart, Mic, MicOff, Plus, Radio, Square, Users, Volume2, VolumeX } from 'lucide-react';
import { Room, RoomEvent, Track, type Participant, type RemoteTrack } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Field, Input, Loading, Modal, PageHeader, Select, StatTile, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type ShowCard = {
    id: number;
    title: string;
    topic: string | null;
    topics: string[];
    format: string;
    status: string;
    scheduled_at: string | null;
    started_at: string | null;
    listeners: number;
    host: User | null;
    stage: User[];
};
type Person = User & { role: string; likes?: number; liked?: boolean; seconds_left?: number };
type State = {
    show: ShowCard & { stage_seats: number; guest_seats: number; question_seconds: number; peak_listeners: number };
    stage: Person[];
    guests: Person[];
    hands: Person[];
    listeners: Person[];
    listeners_count: number;
    me: { role: string; hand: boolean; can_speak: boolean } | null;
    can_manage: boolean;
};
type Index = {
    live: ShowCard[];
    upcoming: ShowCard[];
    mine: ShowCard[];
    formats: Record<string, { stage: number; guests: number }>;
    trends: { topic: string; count?: number }[] | string[];
    max_topics: number;
};

const FORMAT: Record<string, string> = { duo: 'Дует: 2 на сцені', double: 'Подвійний: 4 на сцені', custom: 'Свій формат' };

function ShowTile({ s, onOpen }: { s: ShowCard; onOpen: () => void }) {
    const live = s.status === 'live';
    return (
        <button
            type="button"
            onClick={onOpen}
            className={`flex flex-col rounded-2xl bg-white/[0.04] p-4 text-left ring-1 transition hover:-translate-y-0.5 ${live ? 'ring-rose-400/30 hover:ring-rose-400/60' : 'ring-white/10 hover:ring-white/25'}`}
        >
            <div className="mb-2 flex items-center gap-2 text-xs">
                {live ? (
                    <span className="flex items-center gap-1 rounded-md bg-rose-500 px-1.5 py-0.5 font-bold">
                        <span className="size-1.5 animate-pulse rounded-full bg-white" /> НАЖИВО
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-white/55">
                        <CalendarClock size={12} /> {s.scheduled_at ? when(s.scheduled_at) : 'Скоро'}
                    </span>
                )}
                {live && (
                    <span className="ml-auto flex items-center gap-1 text-white/55">
                        <Users size={12} /> {s.listeners}
                    </span>
                )}
            </div>
            <p className="line-clamp-2 font-bold">{s.title}</p>
            {s.topic && <p className="mt-1 line-clamp-2 text-sm text-white/55">{s.topic}</p>}
            {s.topics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {s.topics.map((t) => (
                        <span key={t} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/60">
                            #{t}
                        </span>
                    ))}
                </div>
            )}
            <div className="mt-auto flex items-center gap-1 pt-3">
                {[...(s.host ? [s.host] : []), ...s.stage.filter((u) => u.id !== s.host?.id)].slice(0, 5).map((u) => (
                    <Avatar key={u.id} user={u} size={26} />
                ))}
                <span className="ml-2 truncate text-xs text-white/50">{s.host?.name}</span>
            </div>
        </button>
    );
}

/** GameCast: подкасти наживо — зараз в ефірі, заплановані, мої й створення свого. */
export function GameCastList() {
    const page = useSite<Index>('/shows');
    const nav = useNav();
    const [create, setCreate] = useState(false);
    const d = page.data;
    const section = (title: string, list: ShowCard[]) =>
        list.length > 0 && (
            <section className="mb-6">
                <h2 className="mb-3 text-lg font-bold">{title}</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                    {list.map((s) => (
                        <ShowTile key={s.id} s={s} onOpen={() => nav.go(`/shows/${s.id}`)} />
                    ))}
                </div>
            </section>
        );
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="GameCast"
                subtitle="Подкасти наживо: слухайте, піднімайте руку й говоріть зі сцени"
                actions={
                    <Button tone="primary" onClick={() => setCreate(true)}>
                        <Plus size={15} /> Свій ефір
                    </Button>
                }
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0">
                    {!d && <Loading error={page.error} />}
                    {d && d.live.length + d.upcoming.length + d.mine.length === 0 && (
                        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                            <Radio size={36} className="mb-3 text-white/25" />
                            <p className="font-semibold">Ефірів поки немає</p>
                            <p className="mt-1 max-w-sm text-sm text-white/45">Зберіть друзів на сцену й поговоріть про гру, патч чи турнір — слухачі піднімуть руку, щоб поставити питання.</p>
                            <div className="mt-4">
                                <Button tone="primary" onClick={() => setCreate(true)}>
                                    <Plus size={15} /> Створити ефір
                                </Button>
                            </div>
                        </div>
                    )}
                    {d && section('Зараз в ефірі', d.live)}
                    {d && section('Заплановані', d.upcoming)}
                    {d && section('Мої ефіри', d.mine)}
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Наживо" value={d?.live.length ?? '—'} accent />
                        <StatTile label="Слухачів" value={d ? d.live.reduce((s, x) => s + x.listeners, 0) : '—'} />
                    </div>
                    {d && d.trends.length > 0 && (
                        <Card title="Популярні теми">
                            <div className="flex flex-wrap gap-1.5">
                                {d.trends.map((t) => {
                                    const name = typeof t === 'string' ? t : t.topic;
                                    return (
                                        <span key={name} className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-white/70">
                                            #{name}
                                        </span>
                                    );
                                })}
                            </div>
                        </Card>
                    )}
                    <Card title="Як це працює">
                        <ul className="space-y-2 text-sm text-white/60">
                            <li>• На сцені — ведучий і співведучі, їх чують усі.</li>
                            <li>• Слухач піднімає руку — ведучий дає слово на хвилину.</li>
                            <li>• Вподобання й подарунки підтримують тих, хто говорить.</li>
                        </ul>
                    </Card>
                </aside>
            </div>
            {d && create && <CreateShow formats={d.formats} maxTopics={d.max_topics} onClose={() => setCreate(false)} />}
        </div>
    );
}

function CreateShow({ formats, maxTopics, onClose }: { formats: Index['formats']; maxTopics: number; onClose: () => void }) {
    const nav = useNav();
    const toast = useToast();
    const [f, setF] = useState({ title: '', topic: '', topics: '', format: 'duo', scheduled_at: '' });
    const [busy, setBusy] = useState(false);
    const submit = async (): Promise<void> => {
        setBusy(true);
        try {
            const r = await api<{ redirect?: string | null; show?: { id: number } }>('POST', '/api/v1/site/shows', {
                title: f.title,
                topic: f.topic || null,
                topics: f.topics
                    .split(/[,#]/)
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, maxTopics),
                format: f.format,
                scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
            });
            toast('Ефір створено.');
            onClose();
            const to = r.show ? `/shows/${r.show.id}` : r.redirect;
            if (to?.startsWith('/shows/')) nav.go(to);
        } catch (e) {
            toast((e as Error).message, 'error');
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal title="Новий ефір GameCast" onClose={onClose}>
            <div className="space-y-3">
                <Field label="Назва">
                    <Input value={f.title} maxLength={80} placeholder="Напр.: Розбираємо новий патч" onChange={(e) => setF({ ...f, title: e.target.value })} />
                </Field>
                <Field label="Про що">
                    <Input value={f.topic} maxLength={200} onChange={(e) => setF({ ...f, topic: e.target.value })} />
                </Field>
                <Field label="Теги" hint={`Через кому, до ${maxTopics}`}>
                    <Input value={f.topics} onChange={(e) => setF({ ...f, topics: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Формат">
                        <Select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>
                            {Object.keys(formats).map((k) => (
                                <option key={k} value={k}>
                                    {FORMAT[k] ?? k}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Коли" hint="Порожньо — одразу">
                        <Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
                    </Field>
                </div>
                <div className="flex justify-end">
                    <Button tone="primary" disabled={busy || f.title.trim().length < 3} onClick={() => void submit()}>
                        Створити
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

const uid = (p: Participant): number => Number(p.identity.replace(/^u/, '')) || 0;

/** Ефір: сцена, гості з таймером, слухачі, підняти руку, мікрофон (коли дали слово), керування для ведучого. */
export function GameCastView({ id }: { id: number }) {
    const [state, setState] = useState<State | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [speaking, setSpeaking] = useState<number[]>([]);
    const [micOn, setMicOn] = useState(false);
    const [deaf, setDeaf] = useState(false);
    const [connected, setConnected] = useState(false);
    const room = useRef<Room | null>(null);
    const audio = useRef<HTMLDivElement>(null);
    const toast = useToast();
    const { run } = useAction();
    const base = `/api/v1/site/shows/${id}`;
    const live = state?.show.status === 'live';

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

    // Аудіо: підключаємося, щойно ефір наживо.
    useEffect(() => {
        if (!live) return;
        let alive = true;
        const r = new Room();
        room.current = r;
        r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (track.kind !== Track.Kind.Audio) return;
            const el = track.attach();
            audio.current?.appendChild(el);
        });
        r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach().forEach((el) => el.remove()));
        r.on(RoomEvent.ActiveSpeakersChanged, (ps: Participant[]) => setSpeaking(ps.map(uid)));
        void (async () => {
            try {
                const j = await api<{ url: string; token: string }>('POST', `${base}/join`);
                if (!alive) return;
                await r.connect(j.url, j.token, { autoSubscribe: true });
                setConnected(true);
            } catch (e) {
                if (alive) toast((e as Error).message, 'error');
            }
        })();
        return () => {
            alive = false;
            setConnected(false);
            void r.disconnect();
            void api('POST', `${base}/leave`).catch(() => undefined);
        };
    }, [live, base, toast]);

    useEffect(() => {
        audio.current?.querySelectorAll('audio').forEach((el) => (el.muted = deaf));
    }, [deaf, speaking]);

    // Забрали слово — вимикаємо мікрофон.
    useEffect(() => {
        if (micOn && state?.me && !state.me.can_speak) {
            void room.current?.localParticipant.setMicrophoneEnabled(false);
            setMicOn(false);
        }
    }, [state, micOn]);

    if (!state) return <Loading error={error} />;
    const s = state.show;
    const act = async (method: string, path: string, payload?: unknown): Promise<void> => {
        try {
            const r = await api<State | { ok: boolean }>(method, `${base}${path}`, payload);
            if ('show' in r) setState(r);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const toggleMic = async (): Promise<void> => {
        try {
            await room.current?.localParticipant.setMicrophoneEnabled(!micOn);
            setMicOn(!micOn);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const seat = (p: Person, big: boolean) => (
        <div key={p.id} className="flex flex-col items-center text-center">
            <div className={`rounded-full p-1 transition ${speaking.includes(p.id) ? 'ring-4 ring-emerald-400/70' : 'ring-2 ring-white/10'}`}>
                <Avatar user={p} size={big ? 84 : 60} />
            </div>
            <p className="mt-2 max-w-[120px] truncate text-sm font-semibold">{p.name}</p>
            <p className="text-[11px] text-white/45">{p.role === 'host' ? 'Ведучий' : p.role === 'speaker' ? 'Співведучий' : `Гість · ${p.seconds_left ?? 0} с`}</p>
            <button
                type="button"
                onClick={() => void act('POST', `/like/${p.id}`)}
                className={`mt-1 flex items-center gap-1 text-xs ${p.liked ? 'text-rose-300' : 'text-white/45 hover:text-rose-200'}`}
            >
                <Heart size={11} fill={p.liked ? 'currentColor' : 'none'} /> {p.likes ?? 0}
            </button>
            {state.can_manage && p.role === 'guest' && (
                <button type="button" onClick={() => void act('DELETE', `/floor/${p.id}`)} className="mt-1 text-[11px] text-white/40 hover:text-rose-300">
                    Забрати слово
                </button>
            )}
        </div>
    );
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={s.title}
                subtitle={live ? `Наживо · ${state.listeners_count} слухають` : s.status === 'ended' ? 'Ефір завершено' : s.scheduled_at ? `Початок ${when(s.scheduled_at)}` : 'Ще не почався'}
                actions={
                    state.can_manage && (
                        <div className="flex gap-2">
                            {s.status !== 'live' && s.status !== 'ended' && (
                                <Button tone="primary" onClick={() => void run('POST', `/shows/${s.id}/start`, undefined, 'Ефір почався!', async () => setState(await api('GET', `${base}/state`)))}>
                                    <Radio size={14} /> Почати ефір
                                </Button>
                            )}
                            {live && (
                                <Button
                                    onClick={() =>
                                        confirm('Завершити ефір для всіх?') &&
                                        void run('POST', `/shows/${s.id}/end`, undefined, 'Ефір завершено.', async () => setState(await api('GET', `${base}/state`)))
                                    }
                                >
                                    <Square size={14} /> Завершити
                                </Button>
                            )}
                        </div>
                    )
                }
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0 space-y-4">
                    <div className="rounded-3xl bg-gradient-to-b from-neon-violet/15 via-white/[0.03] to-transparent p-6 ring-1 ring-white/10">
                        {s.topic && <p className="mb-5 text-center text-white/65">{s.topic}</p>}
                        <div className="flex flex-wrap justify-center gap-8">{state.stage.map((p) => seat(p, true))}</div>
                        {state.guests.length > 0 && (
                            <>
                                <p className="mt-6 mb-3 text-center text-xs tracking-wide text-white/40 uppercase">Слово гостям</p>
                                <div className="flex flex-wrap justify-center gap-6">{state.guests.map((p) => seat(p, false))}</div>
                            </>
                        )}
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                            {live && state.me?.can_speak && (
                                <Button tone={micOn ? 'primary' : 'ghost'} disabled={!connected} onClick={() => void toggleMic()}>
                                    {micOn ? <Mic size={15} /> : <MicOff size={15} />} {micOn ? 'Мікрофон увімкнено' : 'Увімкнути мікрофон'}
                                </Button>
                            )}
                            {live && state.me && !state.me.can_speak && (
                                <Button tone={state.me.hand ? 'primary' : 'ghost'} onClick={() => void act('POST', '/hand', { raised: !state.me!.hand })}>
                                    <Hand size={15} /> {state.me.hand ? 'Рука піднята' : 'Підняти руку'}
                                </Button>
                            )}
                            {live && (
                                <Button onClick={() => setDeaf(!deaf)}>
                                    {deaf ? <VolumeX size={15} /> : <Volume2 size={15} />} {deaf ? 'Звук вимкнено' : 'Звук'}
                                </Button>
                            )}
                            {!live && <p className="text-sm text-white/50">{s.status === 'ended' ? 'Цей ефір уже завершився.' : 'Щойно ведучий почне — звук увімкнеться тут сам.'}</p>}
                        </div>
                    </div>
                    <Card title={`Слухачі · ${state.listeners_count}`}>
                        {state.listeners.length === 0 && <p className="text-sm text-white/45">Поки тихо — поділіться ефіром з друзями.</p>}
                        <div className="flex flex-wrap gap-3">
                            {state.listeners.map((u) => (
                                <div key={u.id} className="flex w-16 flex-col items-center text-center">
                                    <Avatar user={u} size={40} />
                                    <span className="mt-1 w-full truncate text-[11px] text-white/60">{u.first_name ?? u.name}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Слухають" value={state.listeners_count} accent />
                        <StatTile label="Пік" value={s.peak_listeners} />
                    </div>
                    {state.can_manage && (
                        <Card
                            title={
                                <span className="flex items-center gap-2">
                                    <Hand size={15} /> Підняті руки · {state.hands.length}
                                </span>
                            }
                        >
                            {state.hands.length === 0 && <p className="text-sm text-white/45">Ніхто не просить слова.</p>}
                            {state.hands.map((u) => (
                                <div key={u.id} className="flex items-center gap-2 py-1">
                                    <Avatar user={u} size={28} />
                                    <span className="flex-1 truncate text-sm">{u.name}</span>
                                    <Button small tone="primary" onClick={() => void act('POST', `/floor/${u.id}`)}>
                                        Дати слово
                                    </Button>
                                </div>
                            ))}
                            <p className="mt-2 text-[11px] text-white/40">Гість говорить {s.question_seconds} с, потім мікрофон вимкнеться сам.</p>
                        </Card>
                    )}
                    {s.topics.length > 0 && (
                        <Card title="Теми">
                            <div className="flex flex-wrap gap-1.5">
                                {s.topics.map((t) => (
                                    <span key={t} className="rounded-lg bg-white/[0.06] px-2 py-1 text-xs text-white/70">
                                        #{t}
                                    </span>
                                ))}
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
            <div ref={audio} className="hidden" />
        </div>
    );
}

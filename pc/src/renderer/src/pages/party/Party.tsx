import { Clock, Copy, Crown, Link2, Globe, Mic, Plus, Radio, Rocket, Search, Sparkles, Swords, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Cover, Field, Input, Loading, Modal, PageHeader, Select, StatTile, Tabs, TextArea, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Opt = Record<string, string>;
type Party = {
    id: number;
    title: string;
    note: string | null;
    platform_label: string | null;
    roles: string[];
    taken_roles: string[];
    mic: boolean;
    language_label: string | null;
    age_min: number | null;
    style_label: string | null;
    slots: number;
    count: number;
    full: boolean;
    starts_at: string | null;
    expires_at: string;
    open: boolean;
    bumped: boolean;
    mine: boolean;
    joined: boolean;
    host: User;
    game: { slug: string; name: string; cover: string | null } | null;
    server: { slug: string; name: string; icon: string | null } | null;
    members: (User & { role: string | null })[];
    voice_room?: { slug?: string; id?: number } | string | null;
    time_poll: {
        decided: boolean;
        options: {
            id: number;
            starts_at: string;
            votes: number;
            mine: boolean;
            picked: boolean;
            voters: User[];
        }[];
    } | null;
};
type Board = {
    parties: Party[];
    filters: Record<string, string | boolean | null>;
    options: {
        platforms: Opt;
        languages: Opt;
        styles: Opt;
        ages: number[];
        games: { slug: string; name: string }[];
    };
};

const TIMES: Opt = {
    morning: 'Вранці',
    day: 'Вдень',
    evening: 'Ввечері',
    night: 'Вночі',
    weekend: 'На вихідних',
};
const SKILLS: Opt = {
    new: 'Новачок',
    casual: 'Для душі',
    mid: 'Впевнено',
    pro: 'Профі',
};
const LANGS: Opt = {
    uk: 'Українська',
    en: 'English',
    pl: 'Polski',
    de: 'Deutsch',
};

const chip = 'inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/65';

/** «Пошук паті»: дошка оголошень із фільтрами, створення паті й підбір тиммейтів. */
export function PartyBoard() {
    const [tab, setTab] = useState<'board' | 'match'>('board');
    const [f, setF] = useState({
        game: '',
        platform: '',
        language: '',
        style: '',
        mic: false,
    });
    const qs = new URLSearchParams(
        Object.entries(f)
            .filter(([, v]) => v !== '' && v !== false)
            .map(([k, v]) => [k, v === true ? '1' : String(v)]),
    ).toString();
    const page = useSite<Board>(`/party${qs ? `?${qs}` : ''}`);
    const [create, setCreate] = useState(false);
    const nav = useNav();
    const d = page.data;
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Пошук паті"
                subtitle="Знайдіть команду на вечір або зберіть свою"
                actions={
                    <Button tone="primary" onClick={() => setCreate(true)}>
                        <Plus size={15} /> Зібрати паті
                    </Button>
                }
            />
            <Tabs
                tabs={[
                    {
                        id: 'board',
                        label: 'Оголошення',
                        badge: d?.parties.length || null,
                    },
                    { id: 'match', label: 'Підбір тиммейтів' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'match' ? (
                <Teammates />
            ) : (
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                    <div className="min-w-0">
                        {!d && <Loading error={page.error} />}
                        {d && (
                            <>
                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                    <Select value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })} className="!w-56">
                                        <option value="">Усі ігри</option>
                                        {d.options.games.map((g) => (
                                            <option key={g.slug} value={g.slug}>
                                                {g.name}
                                            </option>
                                        ))}
                                    </Select>
                                    <Select
                                        value={f.platform}
                                        onChange={(e) =>
                                            setF({
                                                ...f,
                                                platform: e.target.value,
                                            })
                                        }
                                        className="!w-40"
                                    >
                                        <option value="">Платформа</option>
                                        {Object.entries(d.options.platforms).map(([k, v]) => (
                                            <option key={k} value={k}>
                                                {v}
                                            </option>
                                        ))}
                                    </Select>
                                    <Select
                                        value={f.language}
                                        onChange={(e) =>
                                            setF({
                                                ...f,
                                                language: e.target.value,
                                            })
                                        }
                                        className="!w-40"
                                    >
                                        <option value="">Мова</option>
                                        {Object.entries(d.options.languages).map(([k, v]) => (
                                            <option key={k} value={k}>
                                                {v}
                                            </option>
                                        ))}
                                    </Select>
                                    <Select
                                        value={f.style}
                                        onChange={(e) =>
                                            setF({
                                                ...f,
                                                style: e.target.value,
                                            })
                                        }
                                        className="!w-40"
                                    >
                                        <option value="">Стиль гри</option>
                                        {Object.entries(d.options.styles).map(([k, v]) => (
                                            <option key={k} value={k}>
                                                {v}
                                            </option>
                                        ))}
                                    </Select>
                                    <button
                                        type="button"
                                        onClick={() => setF({ ...f, mic: !f.mic })}
                                        className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm ring-1 ${f.mic ? 'bg-neon-cyan/15 text-neon-cyan ring-neon-cyan/50' : 'text-white/60 ring-white/10 hover:bg-white/5'}`}
                                    >
                                        <Mic size={14} /> З мікрофоном
                                    </button>
                                </div>
                                {d.parties.length === 0 ? (
                                    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                                        <Swords size={36} className="mb-3 text-white/25" />
                                        <p className="font-semibold">Зараз ніхто не шукає паті</p>
                                        <p className="mt-1 max-w-sm text-sm text-white/45">Зберіть своє — його побачать гравці з тими ж іграми, а підбір тиммейтів підкаже, кого покликати.</p>
                                        <div className="mt-4">
                                            <Button tone="primary" onClick={() => setCreate(true)}>
                                                <Plus size={15} /> Зібрати паті
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
                                        {d.parties.map((p) => (
                                            <PartyCard key={p.id} p={p} onOpen={() => nav.go(`/party/${p.id}`)} />
                                        ))}
                                    </div>
                                )}
                                {create && <CreateParty options={d.options} onClose={() => setCreate(false)} onDone={page.reload} />}
                            </>
                        )}
                    </div>
                    <BoardAside onMatch={() => setTab('match')} />
                </div>
            )}
        </div>
    );
}

function Slots({ p }: { p: Party }) {
    return (
        <div className="flex items-center gap-1">
            <Avatar user={p.host} size={26} />
            {p.members.map((m) => (
                <Avatar key={m.id} user={m} size={26} />
            ))}
            {Array.from({ length: Math.max(0, p.slots - p.count) }, (_, i) => (
                <span key={i} className="grid size-[26px] place-items-center rounded-full border border-dashed border-white/20 text-white/30">
                    <Plus size={11} />
                </span>
            ))}
        </div>
    );
}

function PartyCard({ p, onOpen }: { p: Party; onOpen: () => void }) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className={`flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] text-left ring-1 transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${p.bumped ? 'ring-amber-400/40' : 'ring-white/10'}`}
        >
            <div className="flex items-center gap-3 p-3">
                <Cover src={p.game?.cover ?? p.server?.icon} className="size-12 shrink-0 rounded-xl" fallback={<Swords size={18} />} />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-white/50">{[p.game?.name, p.server?.name].filter(Boolean).join(' · ') || 'Будь-яка гра'}</p>
                </div>
                {p.bumped && <Rocket size={15} className="text-amber-300" />}
            </div>
            {p.note && <p className="line-clamp-2 px-3 text-sm text-white/65">{p.note}</p>}
            <div className="flex flex-wrap gap-1 px-3 pt-2">
                {p.platform_label && <span className={chip}>{p.platform_label}</span>}
                {p.mic && (
                    <span className={chip}>
                        <Mic size={10} /> мікрофон
                    </span>
                )}
                {p.language_label && (
                    <span className={chip}>
                        <Globe size={10} /> {p.language_label}
                    </span>
                )}
                {p.style_label && <span className={chip}>{p.style_label}</span>}
                {p.age_min && <span className={chip}>{p.age_min}+</span>}
                {p.roles.map((r) => (
                    <span key={r} className={`${chip} ${p.taken_roles.includes(r) ? 'line-through opacity-50' : '!text-neon-cyan'}`}>
                        {r}
                    </span>
                ))}
            </div>
            <div className="mt-auto flex items-center gap-2 p-3 pt-3">
                <Slots p={p} />
                <span className="ml-auto text-xs text-white/45">
                    {p.count}/{p.slots}
                    {p.starts_at ? ` · ${when(p.starts_at)}` : ' · зараз'}
                </span>
            </div>
        </button>
    );
}

function CreateParty({ options, onClose, onDone }: { options: Board['options']; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [f, setF] = useState({
        title: '',
        note: '',
        game: '',
        platform: '',
        slots: '4',
        roles: '',
        mic: false,
        language: 'uk',
        style: '',
        age_min: '',
        starts_at: '',
    });
    const submit = (): void =>
        void run(
            'POST',
            '/party',
            {
                title: f.title,
                note: f.note || null,
                game: f.game || null,
                platform: f.platform || null,
                slots: Number(f.slots),
                roles: f.roles
                    .split(',')
                    .map((r) => r.trim())
                    .filter(Boolean),
                mic: f.mic,
                language: f.language || null,
                style: f.style || null,
                age_min: f.age_min ? Number(f.age_min) : null,
                starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
            },
            'Паті створено — чекаємо тиммейтів.',
            async () => {
                onClose();
                await onDone();
            },
        );
    return (
        <Modal title="Зібрати паті" onClose={onClose} wide>
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <Field label="Що граємо">
                        <Input value={f.title} maxLength={120} placeholder="Напр.: Ранкед вечір, шукаю саппорта" onChange={(e) => setF({ ...f, title: e.target.value })} />
                    </Field>
                </div>
                <Field label="Гра">
                    <Select value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })}>
                        <option value="">Будь-яка</option>
                        {options.games.map((g) => (
                            <option key={g.slug} value={g.slug}>
                                {g.name}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Платформа">
                    <Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
                        <option value="">Будь-яка</option>
                        {Object.entries(options.platforms).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Гравців разом з вами">
                    <Select value={f.slots} onChange={(e) => setF({ ...f, slots: e.target.value })}>
                        {Array.from({ length: 19 }, (_, i) => i + 2).map((n) => (
                            <option key={n}>{n}</option>
                        ))}
                    </Select>
                </Field>
                <Field label="Коли" hint="Порожньо — грати зараз">
                    <Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />
                </Field>
                <Field label="Ролі" hint="Через кому: снайпер, медик…">
                    <Input value={f.roles} onChange={(e) => setF({ ...f, roles: e.target.value })} />
                </Field>
                <Field label="Мова">
                    <Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
                        <option value="">Будь-яка</option>
                        {Object.entries(options.languages).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Стиль">
                    <Select value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })}>
                        <option value="">Будь-який</option>
                        {Object.entries(options.styles).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Вік">
                    <Select value={f.age_min} onChange={(e) => setF({ ...f, age_min: e.target.value })}>
                        <option value="">Без обмежень</option>
                        {options.ages.map((a) => (
                            <option key={a} value={a}>
                                {a}+
                            </option>
                        ))}
                    </Select>
                </Field>
                <div className="col-span-2">
                    <Field label="Подробиці">
                        <TextArea value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} />
                    </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-white/70">
                    <input type="checkbox" checked={f.mic} onChange={(e) => setF({ ...f, mic: e.target.checked })} /> Потрібен мікрофон
                </label>
            </div>
            <div className="mt-4 flex justify-end">
                <Button tone="primary" disabled={busy || f.title.trim().length < 3} onClick={submit}>
                    Опублікувати
                </Button>
            </div>
        </Modal>
    );
}

type Suggestion = {
    user: User;
    score: number;
    reasons: { type: string; name?: string }[];
    games: string[];
    skill: string | null;
    platform: string | null;
    mic: boolean;
    note: string | null;
    looking: boolean;
    friend: boolean;
};
const REASON: Opt = {
    time: 'Грає в той же час',
    language: 'Та ж мова',
    skill: 'Схожий рівень',
    platform: 'Та ж платформа',
    mic: 'З мікрофоном',
    friend: 'Друг',
    looking: 'Шукає зараз',
};

function MatchCard({ m, action }: { m: Suggestion; action?: React.ReactNode }) {
    const nav = useNav();
    return (
        <div className="flex flex-col rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => m.user.username && nav.go(`/u/${m.user.username}`)}>
                    <Avatar user={m.user} size={42} />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                        {m.user.name}
                        {m.looking && <span className="rounded bg-emerald-400/15 px-1.5 text-[10px] text-emerald-300">шукає</span>}
                    </p>
                    <p className="truncate text-xs text-white/50">{[m.skill && SKILLS[m.skill], m.mic && 'мікрофон', m.friend && 'друг'].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-lg font-black text-neon-cyan">{m.score}%</span>
            </div>
            {m.note && <p className="mt-2 line-clamp-2 text-sm text-white/60">{m.note}</p>}
            <div className="mt-2 flex flex-wrap gap-1">
                {m.reasons.slice(0, 4).map((r, i) => (
                    <span key={i} className={chip}>
                        {r.name ?? REASON[r.type] ?? r.type}
                    </span>
                ))}
            </div>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

type MatchPage = {
    profile: {
        games: { slug: string; name: string }[];
        languages: string[];
        times: string[];
        skill: string | null;
        platform: string | null;
        mic: boolean;
        note: string | null;
        visible: boolean;
        looking_until: string | null;
    };
    matches: Suggestion[];
    parties: { id: number; title: string }[];
    options: { games: { slug: string; name: string }[]; platforms: string[] };
};

function Teammates() {
    const page = useSite<MatchPage>('/party/match');
    const { run, busy } = useAction();
    const [form, setForm] = useState<MatchPage['profile'] | null>(null);
    const [invite, setInvite] = useState<Record<number, string>>({});
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const p = form ?? d.profile;
    const toggle = (list: string[], v: string): string[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    const pill = (on: boolean): string => `h-8 rounded-lg px-2.5 text-xs ring-1 ${on ? 'bg-neon-cyan/15 text-neon-cyan ring-neon-cyan/50' : 'text-white/60 ring-white/10 hover:bg-white/5'}`;
    return (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
            <div className="min-w-0">
                <div className="mb-4 grid grid-cols-3 gap-2">
                    <StatTile label="Збігів" value={d.matches.length} accent />
                    <StatTile label="Шукають зараз" value={d.matches.filter((m) => m.looking).length} />
                    <StatTile label="Мої паті" value={d.parties.length} />
                </div>
                {d.matches.length === 0 ? (
                    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                        <Sparkles size={34} className="mb-3 text-white/25" />
                        <p className="font-semibold">Поки немає збігів</p>
                        <p className="mt-1 max-w-sm text-sm text-white/45">Заповніть анкету праворуч: ігри, час і мову — ми підберемо людей, з якими буде комфортно грати.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                        {d.matches.map((m) => (
                            <MatchCard
                                key={m.user.id}
                                m={m}
                                action={
                                    d.parties.length > 0 && (
                                        <div className="flex gap-2">
                                            <Select
                                                value={invite[m.user.id] ?? String(d.parties[0].id)}
                                                onChange={(e) =>
                                                    setInvite({
                                                        ...invite,
                                                        [m.user.id]: e.target.value,
                                                    })
                                                }
                                            >
                                                {d.parties.map((x) => (
                                                    <option key={x.id} value={x.id}>
                                                        {x.title}
                                                    </option>
                                                ))}
                                            </Select>
                                            <Button small onClick={() => void run('POST', `/party/${invite[m.user.id] ?? d.parties[0].id}/invite`, { user_id: m.user.id }, 'Запрошення надіслано.')}>
                                                <UserPlus size={14} />
                                            </Button>
                                        </div>
                                    )
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
            <aside className="space-y-4">
                <Card>
                    <div className="flex items-center gap-3">
                        <Radio size={18} className={d.profile.looking_until ? 'text-emerald-300' : 'text-white/40'} />
                        <div className="flex-1">
                            <p className="font-semibold">{d.profile.looking_until ? 'Ви шукаєте гру' : 'Шукаю гру зараз'}</p>
                            <p className="text-xs text-white/50">{d.profile.looking_until ? `до ${when(d.profile.looking_until)}` : 'Вас покажуть першим у підборі'}</p>
                        </div>
                        <Button
                            small
                            tone={d.profile.looking_until ? 'ghost' : 'primary'}
                            onClick={() =>
                                void run('POST', '/party/match/looking', { on: !d.profile.looking_until }, d.profile.looking_until ? 'Пошук вимкнено.' : 'Вас видно як «шукає гру».', page.reload)
                            }
                        >
                            {d.profile.looking_until ? 'Вимкнути' : 'Увімкнути'}
                        </Button>
                    </div>
                </Card>
                <Card title="Моя анкета">
                    <div className="space-y-3">
                        <Field label="Ігри (до 8)">
                            <Select
                                value=""
                                onChange={(e) => {
                                    const g = d.options.games.find((x) => x.slug === e.target.value);
                                    if (g && p.games.length < 8 && !p.games.some((x) => x.slug === g.slug))
                                        setForm({
                                            ...p,
                                            games: [...p.games, g],
                                        });
                                }}
                            >
                                <option value="">+ Додати гру</option>
                                {d.options.games.map((g) => (
                                    <option key={g.slug} value={g.slug}>
                                        {g.name}
                                    </option>
                                ))}
                            </Select>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {p.games.map((g) => (
                                    <button
                                        key={g.slug}
                                        type="button"
                                        onClick={() =>
                                            setForm({
                                                ...p,
                                                games: p.games.filter((x) => x.slug !== g.slug),
                                            })
                                        }
                                        className={`${chip} hover:bg-rose-500/15`}
                                    >
                                        {g.name} <X size={10} />
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Коли граю">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(TIMES).map(([k, v]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={pill(p.times.includes(k))}
                                        onClick={() =>
                                            setForm({
                                                ...p,
                                                times: toggle(p.times, k),
                                            })
                                        }
                                    >
                                        <Clock size={11} className="mr-1 inline" />
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Мови">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(LANGS).map(([k, v]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={pill(p.languages.includes(k))}
                                        onClick={() =>
                                            setForm({
                                                ...p,
                                                languages: toggle(p.languages, k),
                                            })
                                        }
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Рівень">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(SKILLS).map(([k, v]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={pill(p.skill === k)}
                                        onClick={() =>
                                            setForm({
                                                ...p,
                                                skill: p.skill === k ? null : k,
                                            })
                                        }
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Про себе">
                            <Input value={p.note ?? ''} maxLength={140} onChange={(e) => setForm({ ...p, note: e.target.value })} />
                        </Field>
                        <label className="flex items-center gap-2 text-sm text-white/70">
                            <input type="checkbox" checked={p.mic} onChange={(e) => setForm({ ...p, mic: e.target.checked })} /> Є мікрофон
                        </label>
                        <label className="flex items-center gap-2 text-sm text-white/70">
                            <input type="checkbox" checked={p.visible} onChange={(e) => setForm({ ...p, visible: e.target.checked })} /> Показувати мене в підборі
                        </label>
                        <Button
                            tone="primary"
                            disabled={busy || !form}
                            onClick={() =>
                                void run(
                                    'PUT',
                                    '/party/match/profile',
                                    {
                                        ...p,
                                        games: p.games.map((g) => g.slug),
                                        note: p.note || null,
                                    },
                                    'Анкету збережено.',
                                    async () => {
                                        setForm(null);
                                        await page.reload();
                                    },
                                )
                            }
                        >
                            Зберегти анкету
                        </Button>
                    </div>
                </Card>
            </aside>
        </div>
    );
}

/** Сторінка паті: склад і вільні місця, ролі, голосування за час, запрошення з підбору. */
export function PartyPage({ id }: { id: number }) {
    const page = useSite<{ party: Party; suggestions: Suggestion[] }>(`/party/${id}`);
    const { run, busy } = useAction();
    const nav = useNav();
    const [role, setRole] = useState('');
    if (!page.data) return <Loading error={page.error} />;
    const { party: p, suggestions } = page.data;
    const free = p.roles.filter((r) => !p.taken_roles.includes(r));
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={p.title}
                subtitle={[p.game?.name, p.server?.name, p.open ? (p.full ? 'Склад зібрано' : `Шукаємо ще ${p.slots - p.count}`) : 'Закрито'].filter(Boolean).join(' · ')}
                image={<Cover src={p.game?.cover ?? p.server?.icon} className="size-11 rounded-xl" fallback={<Swords size={18} />} />}
                actions={
                    <div className="flex gap-2">
                        {p.mine && p.open && (
                            <>
                                <Button onClick={() => void run('POST', `/party/${p.id}/bump`, undefined, 'Паті піднято вгору.', page.reload)}>
                                    <Rocket size={14} /> Підняти
                                </Button>
                                <Button onClick={() => void run('DELETE', `/party/${p.id}`, undefined, 'Паті закрито.', () => nav.back())}>Закрити</Button>
                            </>
                        )}
                        {!p.mine && p.joined && <Button onClick={() => void run('DELETE', `/party/${p.id}/join`, undefined, 'Ви вийшли з паті.', page.reload)}>Вийти</Button>}
                    </div>
                }
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0 space-y-4">
                    <Card
                        title={
                            <span className="flex items-center gap-2">
                                <Users size={15} /> Склад · {p.count}/{p.slots}
                            </span>
                        }
                    >
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                            {[
                                {
                                    ...p.host,
                                    role: null as string | null,
                                    host: true,
                                },
                                ...p.members.map((m) => ({
                                    ...m,
                                    host: false,
                                })),
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => m.username && nav.go(`/u/${m.username}`)}
                                    className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2.5 text-left ring-1 ring-white/10 hover:bg-white/[0.07]"
                                >
                                    <Avatar user={m} size={36} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{m.name}</p>
                                        <p className="truncate text-xs text-white/50">{m.host ? 'Збирає паті' : (m.role ?? 'Учасник')}</p>
                                    </div>
                                    {m.host && <Crown size={14} className="text-amber-300" />}
                                </button>
                            ))}
                            {Array.from({ length: Math.max(0, p.slots - p.count) }, (_, i) => (
                                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/15 p-2.5 text-sm text-white/40">
                                    <span className="grid size-9 place-items-center rounded-full bg-white/[0.04]">
                                        <Plus size={14} />
                                    </span>
                                    {free[i] ? `Потрібен: ${free[i]}` : 'Вільне місце'}
                                </div>
                            ))}
                        </div>
                        {!p.mine && !p.joined && p.open && !p.full && (
                            <div className="mt-4 flex items-center gap-2">
                                {free.length > 0 && (
                                    <Select value={role} onChange={(e) => setRole(e.target.value)} className="!w-56">
                                        <option value="">Будь-яка роль</option>
                                        {free.map((r) => (
                                            <option key={r}>{r}</option>
                                        ))}
                                    </Select>
                                )}
                                <Button
                                    tone="primary"
                                    disabled={busy}
                                    onClick={() => void run('POST', `/party/${p.id}/join`, { role: role || null }, 'Ви в паті. Заходьте в голосову кімнату.', page.reload)}
                                >
                                    Приєднатися
                                </Button>
                            </div>
                        )}
                    </Card>
                    {p.note && (
                        <Card title="Подробиці">
                            <p className="text-sm whitespace-pre-wrap text-white/75">{p.note}</p>
                        </Card>
                    )}
                    <MoreParties id={p.id} game={p.game} />
                    {p.time_poll && p.time_poll.options.length > 0 && (
                        <Card
                            title={
                                <span className="flex items-center gap-2">
                                    <Clock size={15} /> Коли граємо
                                </span>
                            }
                        >
                            <div className="space-y-2">
                                {p.time_poll.options.map((o) => (
                                    <div key={o.id} className={`flex items-center gap-3 rounded-xl p-2.5 ring-1 ${o.picked ? 'bg-emerald-400/10 ring-emerald-400/40' : 'ring-white/10'}`}>
                                        <span className="flex-1 text-sm font-semibold">{when(o.starts_at)}</span>
                                        <div className="flex -space-x-2">
                                            {o.voters.map((v) => (
                                                <Avatar key={v.id} user={v} size={22} />
                                            ))}
                                        </div>
                                        <span className="w-6 text-right text-sm text-white/55">{o.votes}</span>
                                        {!p.time_poll!.decided && (
                                            <Button
                                                small
                                                tone={o.mine ? 'primary' : 'ghost'}
                                                onClick={() =>
                                                    void run(
                                                        'POST',
                                                        `/party/${p.id}/time`,
                                                        {
                                                            slots: o.mine
                                                                ? p.time_poll!.options.filter((x) => x.mine && x.id !== o.id).map((x) => x.id)
                                                                : [...p.time_poll!.options.filter((x) => x.mine).map((x) => x.id), o.id],
                                                        },
                                                        'Голос враховано.',
                                                        page.reload,
                                                    )
                                                }
                                            >
                                                {o.mine ? 'Мій вибір' : 'Підходить'}
                                            </Button>
                                        )}
                                        {p.mine && !p.time_poll!.decided && (
                                            <Button small onClick={() => void run('POST', `/party/${p.id}/time/${o.id}`, undefined, 'Час обрано — всім прийде нагадування.', page.reload)}>
                                                Обрати
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Старт" value={p.starts_at ? when(p.starts_at) : 'Зараз'} accent />
                        <StatTile label="Активне до" value={when(p.expires_at)} />
                    </div>
                    <Card title="Умови">
                        <div className="flex flex-wrap gap-1">
                            {[p.platform_label, p.mic && 'Мікрофон', p.language_label, p.style_label, p.age_min && `${p.age_min}+`].filter(Boolean).map((x) => (
                                <span key={String(x)} className={chip}>
                                    {x}
                                </span>
                            ))}
                            {!p.platform_label && !p.mic && !p.language_label && !p.style_label && !p.age_min && <span className="text-sm text-white/45">Без особливих вимог.</span>}
                        </div>
                    </Card>
                    {p.open && (p.mine || p.joined) && <InviteLink id={p.id} />}
                    {p.mine && suggestions.length > 0 && (
                        <Card
                            title={
                                <span className="flex items-center gap-2">
                                    <Search size={15} /> Кого покликати
                                </span>
                            }
                        >
                            <div className="space-y-2">
                                {suggestions.slice(0, 6).map((m) => (
                                    <MatchCard
                                        key={m.user.id}
                                        m={m}
                                        action={
                                            <Button small onClick={() => void run('POST', `/party/${p.id}/invite`, { user_id: m.user.id }, 'Запрошення надіслано.')}>
                                                <UserPlus size={14} /> Запросити
                                            </Button>
                                        }
                                    />
                                ))}
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
        </div>
    );
}
/** Праворуч від дошки: хто шукає гру саме зараз і найкращі збіги з підбору. */
function BoardAside({ onMatch }: { onMatch: () => void }) {
    const page = useSite<MatchPage>('/party/match');
    const nav = useNav();
    const d = page.data;
    const top = (d?.matches ?? []).slice(0, 5);
    return (
        <aside className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <StatTile label="Шукають зараз" value={d ? d.matches.filter((m) => m.looking).length : '—'} accent />
                <StatTile label="Мої паті" value={d ? d.parties.length : '—'} />
            </div>
            <Card
                title={
                    <span className="flex items-center gap-2">
                        <Sparkles size={15} /> Вам підходять
                    </span>
                }
                actions={
                    <Button small onClick={onMatch}>
                        Усі
                    </Button>
                }
            >
                {top.length === 0 && <p className="text-sm text-white/45">Заповніть анкету в «Підборі тиммейтів» — і тут зʼявляться люди під ваш стиль гри.</p>}
                {top.map((m) => (
                    <button
                        key={m.user.id}
                        type="button"
                        onClick={() => m.user.username && nav.go(`/u/${m.user.username}`)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-white/5"
                    >
                        <Avatar user={m.user} size={30} />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{m.user.name}</span>
                            <span className="block truncate text-[11px] text-white/45">{m.games.slice(0, 2).join(', ') || (m.skill ? SKILLS[m.skill] : '')}</span>
                        </span>
                        <span className="text-sm font-bold text-neon-cyan">{m.score}%</span>
                    </button>
                ))}
            </Card>
            <Card title="Як зібрати команду швидше">
                <ul className="space-y-2 text-sm text-white/60">
                    <li>• Вкажіть гру й ролі — оголошення побачать ті, хто в неї грає.</li>
                    <li>• «Підняти» поверне паті нагору дошки.</li>
                    <li>• Коли склад зібрано, відкриється спільна голосова кімната.</li>
                </ul>
            </Card>
        </aside>
    );
}

/** Посилання-запрошення в паті: друг відкриває його й одразу потрапляє в склад. */
function InviteLink({ id }: { id: number }) {
    const toast = useToast();
    const [url, setUrl] = useState<string | null>(null);
    const make = async (): Promise<void> => {
        try {
            const r = await api<{ url: string }>('POST', `/api/v1/site/party/${id}/invite-link`);
            setUrl(r.url);
            await navigator.clipboard.writeText(r.url);
            toast('Посилання скопійовано — надішліть другу.');
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <Link2 size={15} /> Запросити друзів
                </span>
            }
        >
            <p className="mb-3 text-sm text-white/55">Друг відкриє посилання — і одразу опиниться в паті, навіть якщо ще не бачив оголошення.</p>
            {url && <Input readOnly value={url} onFocus={(e) => e.target.select()} className="mb-2 text-xs" />}
            <Button small tone="primary" onClick={() => void make()}>
                <Copy size={14} /> {url ? 'Нове посилання' : 'Створити посилання'}
            </Button>
        </Card>
    );
}

/** Під паті — інші відкриті оголошення в цій же грі, щоб не повертатися на дошку. */
function MoreParties({ id, game }: { id: number; game: Party['game'] }) {
    const page = useSite<Board>(`/party${game ? `?game=${game.slug}` : ''}`);
    const nav = useNav();
    const list = (page.data?.parties ?? []).filter((x) => x.id !== id).slice(0, 4);
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold text-white/70">{game ? `Ще паті в ${game.name}` : 'Інші паті'}</h3>
            {list.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/45">
                    Поки що ваше паті тут єдине — його першим побачать гравці{game ? ` ${game.name}` : ''}.
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                    {list.map((x) => (
                        <PartyCard key={x.id} p={x} onOpen={() => nav.go(`/party/${x.id}`)} />
                    ))}
                </div>
            )}
        </section>
    );
}

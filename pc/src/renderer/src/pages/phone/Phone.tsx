import { Copy, Delete, Dices, ExternalLink, Gift, MessageSquare, Phone as PhoneIcon, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Send, Shield, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Loading, PageHeader, Select, StatTile, useAction, useSite, useToast, when } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type PhoneCard = { number: string; tier: string; kind: string };
type Check = { number: string; operator: string; digits: string; tier: string; available: boolean; reason: string | null; product: string; price: number; full_price: number };
type Offer = { id: number; kind: string; phone: PhoneCard; from: User; to: User; created_at: string };
type Page = {
    phone: PhoneCard | null;
    codes: { premium: string; random: string };
    prices: Record<string, { price: number; full_price: number }>;
    chances: Record<string, number>;
    discount: number;
    isPlus: boolean;
    nextRandomAt: string | null;
    cooldownDays: number;
    privacy: 'everyone' | 'friends' | 'nobody';
    visible: boolean;
    history: { id: number; direction: 'in' | 'out' | 'missed'; at: string; seconds: number | null; conversation_id: number; user: User; phone: PhoneCard | null }[];
    incoming: Offer[];
    outgoing: Offer[];
    gifts: (PhoneCard & { id: number })[];
    friends: User[];
};

const TIER: Record<string, { label: string; tone: string }> = {
    regular: { label: 'Звичайний', tone: 'text-white/70' },
    bronze: { label: 'Бронзовий', tone: 'text-orange-300' },
    silver: { label: 'Срібний', tone: 'text-slate-200' },
    gold: { label: 'Золотий', tone: 'text-amber-300' },
    platinum: { label: 'Платиновий', tone: 'text-cyan-200' },
    diamond: { label: 'Діамантовий', tone: 'text-fuchsia-300' },
};
const uah = (minor: number): string => `${(minor / 100).toLocaleString('uk-UA', { minimumFractionDigits: minor % 100 ? 2 : 0 })} ₴`;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', '⌫'];

/** «Телефон»: свій номер у мережі GameCon, набір номера, історія дзвінків, гарні номери й подарунки. */
export function PhonePage() {
    const page = useSite<Page>('/phone');
    const { run } = useAction();
    const toast = useToast();
    const nav = useNav();
    const [dial, setDial] = useState('');
    const [found, setFound] = useState<{ phone: PhoneCard; user: User } | null>(null);
    const [miss, setMiss] = useState<string | null>(null);
    useEffect(() => {
        setFound(null);
        setMiss(null);
        const digits = dial.replace(/\D/g, '');
        if (digits.length < 9) return;
        const t = window.setTimeout(() => {
            void api<{ found: boolean; message?: string; phone?: PhoneCard; user?: User }>('GET', `/api/v1/site/phone/lookup?number=${encodeURIComponent(dial)}`).then(
                (r) => (r.found && r.phone && r.user ? setFound({ phone: r.phone, user: r.user }) : setMiss(r.message ?? 'Номер не знайдено.')),
                () => undefined,
            );
        }, 350);
        return () => window.clearTimeout(t);
    }, [dial]);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const press = (k: string): void => setDial(k === '⌫' ? dial.slice(0, -1) : (dial + k).slice(0, 20));
    const call = async (): Promise<void> => {
        try {
            const r = await api<{ conversation: { id: number } }>('POST', '/api/v1/site/phone/dial', { number: dial });
            nav.go(`/messages/${r.conversation.id}`);
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const random = async (): Promise<void> => {
        try {
            const r = await api<{ phone: PhoneCard }>('POST', '/api/v1/site/phone/random');
            toast(`Ваш новий номер — ${r.phone.number}`);
            await page.reload();
        } catch (e) {
            toast((e as Error).message, 'error');
        }
    };
    const missed = d.history.filter((h) => h.direction === 'missed').length;
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Телефон" subtitle="Свій номер у мережі GameCon — дзвінки й повідомлення за номером" />
            <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)_320px] gap-5 overflow-y-auto p-5 max-[1300px]:grid-cols-[340px_minmax(0,1fr)] max-[900px]:grid-cols-1">
                {/* Мій номер + набір. */}
                <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neon-cyan/20 via-neon-violet/15 to-transparent p-5 ring-1 ring-white/10">
                        <p className="text-xs text-white/55">Мій номер</p>
                        {d.phone ? (
                            <>
                                <p className="mt-1 text-2xl font-black tracking-wide tabular-nums">{d.phone.number}</p>
                                <div className="mt-4 flex items-end justify-between gap-3">
                                    <p className={`text-sm font-semibold ${TIER[d.phone.tier]?.tone ?? ''}`}>{TIER[d.phone.tier]?.label ?? d.phone.tier}</p>
                                    <Button small onClick={() => void navigator.clipboard.writeText(d.phone!.number).then(() => toast('Номер скопійовано.'))}>
                                        <Copy size={13} /> Копіювати
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="mt-1 text-lg font-bold">Номера ще немає</p>
                                <p className="mt-1 mb-3 text-sm text-white/55">Отримайте випадковий безкоштовно — з шансом на рідкісний «гарний» номер.</p>
                                <Button tone="primary" disabled={!!d.nextRandomAt && new Date(d.nextRandomAt) > new Date()} onClick={() => void random()}>
                                    <Dices size={15} /> Отримати номер
                                </Button>
                            </>
                        )}
                    </div>
                    <Card>
                        <div className="relative mb-3">
                            <input
                                value={dial}
                                onChange={(e) => setDial(e.target.value.slice(0, 20))}
                                placeholder="Номер абонента"
                                className="h-12 w-full rounded-xl bg-white/[0.05] px-4 text-center text-xl tracking-wider tabular-nums ring-1 ring-white/10 outline-none focus:ring-neon-cyan/50"
                            />
                        </div>
                        {found && (
                            <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-emerald-400/10 p-2.5 ring-1 ring-emerald-400/30">
                                <Avatar user={found.user} size={32} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">{found.user.name}</p>
                                    <p className="text-xs text-white/50">{TIER[found.phone.tier]?.label}</p>
                                </div>
                            </div>
                        )}
                        {miss && <p className="mb-3 text-center text-sm text-rose-300">{miss}</p>}
                        <div className="grid grid-cols-3 gap-2">
                            {KEYS.map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => press(k)}
                                    className="grid h-12 place-items-center rounded-xl bg-white/[0.05] text-lg font-semibold ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
                                >
                                    {k === '⌫' ? <Delete size={18} /> : k}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button tone="primary" disabled={!found} onClick={() => void call()}>
                                <PhoneIcon size={15} /> Подзвонити
                            </Button>
                            <Button disabled={!found} onClick={() => void call()}>
                                <MessageSquare size={15} /> Написати
                            </Button>
                        </div>
                    </Card>
                </div>
                {/* Історія дзвінків і подарунки. */}
                <div className="min-w-0 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        <StatTile label="Дзвінків" value={d.history.length} accent />
                        <StatTile label="Пропущені" value={missed} alert={missed > 0} />
                        <StatTile label="Подарунки" value={d.gifts.length + d.incoming.length} />
                    </div>
                    {d.incoming.length > 0 && (
                        <Card
                            title={
                                <span className="flex items-center gap-2">
                                    <Gift size={15} /> Вам пропонують номер
                                </span>
                            }
                        >
                            {d.incoming.map((o) => (
                                <div key={o.id} className="flex items-center gap-3 py-1.5">
                                    <Avatar user={o.from} size={32} />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold tabular-nums">{o.phone.number}</p>
                                        <p className="text-xs text-white/50">від {o.from.name}</p>
                                    </div>
                                    <Button small tone="primary" onClick={() => void run('POST', `/phone/offers/${o.id}/accept`, undefined, `Тепер ваш номер — ${o.phone.number}.`, page.reload)}>
                                        Прийняти
                                    </Button>
                                    <Button small onClick={() => void run('POST', `/phone/offers/${o.id}/decline`, undefined, 'Відхилено.', page.reload)}>
                                        Ні
                                    </Button>
                                </div>
                            ))}
                        </Card>
                    )}
                    <Card title="Останні дзвінки">
                        {d.history.length === 0 && <p className="py-6 text-center text-sm text-white/45">Дзвінків ще не було. Наберіть номер друга або знайдіть його в «Друзях».</p>}
                        <div className="divide-y divide-white/[0.06]">
                            {d.history.map((h) => {
                                const Icon = h.direction === 'out' ? PhoneOutgoing : h.direction === 'in' ? PhoneIncoming : PhoneMissed;
                                return (
                                    <button
                                        key={h.id}
                                        type="button"
                                        onClick={() => nav.go(`/messages/${h.conversation_id}`)}
                                        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[0.03]"
                                    >
                                        <Avatar user={h.user} size={36} />
                                        <div className="min-w-0 flex-1">
                                            <p className={`truncate font-semibold ${h.direction === 'missed' ? 'text-rose-300' : ''}`}>{h.user.name}</p>
                                            <p className="flex items-center gap-1 text-xs text-white/45">
                                                <Icon size={12} /> {h.phone?.number ?? (h.direction === 'out' ? 'Вихідний' : h.direction === 'in' ? 'Вхідний' : 'Пропущений')}
                                                {h.seconds ? ` · ${Math.floor(h.seconds / 60)}:${String(h.seconds % 60).padStart(2, '0')}` : ''}
                                            </p>
                                        </div>
                                        <span className="text-xs text-white/40">{when(h.at)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                    {d.friends.length > 0 && (
                        <Card title="Друзі">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                                {d.friends.slice(0, 12).map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => f.username && nav.go(`/u/${f.username}`)}
                                        className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2 text-left ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
                                    >
                                        <Avatar user={f} size={30} />
                                        <span className="truncate text-sm">{f.first_name ?? f.name}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                    {d.gifts.length > 0 && <Gifts d={d} reload={page.reload} />}
                    {d.outgoing.length > 0 && (
                        <Card title="Очікують відповіді">
                            {d.outgoing.map((o) => (
                                <div key={o.id} className="flex items-center gap-3 py-1.5 text-sm">
                                    <span className="flex-1">
                                        <b className="tabular-nums">{o.phone.number}</b> → {o.to.name}
                                    </span>
                                    <Button small onClick={() => void run('DELETE', `/phone/offers/${o.id}`, undefined, 'Пропозицію скасовано.', page.reload)}>
                                        Скасувати
                                    </Button>
                                </div>
                            ))}
                        </Card>
                    )}
                </div>
                {/* Гарні номери й налаштування. */}
                <aside className="space-y-4 max-[1300px]:col-span-2 max-[900px]:col-span-1">
                    <NumberPicker d={d} />
                    <Card
                        title={
                            <span className="flex items-center gap-2">
                                <Shield size={15} /> Приватність
                            </span>
                        }
                    >
                        <Field label="Хто може дзвонити за номером">
                            <Select
                                value={d.privacy}
                                onChange={(e) => void run('PUT', '/phone/settings', { privacy: e.target.value, visible: d.visible }, 'Налаштування номера збережено.', page.reload)}
                            >
                                <option value="everyone">Усі</option>
                                <option value="friends">Лише друзі</option>
                                <option value="nobody">Ніхто</option>
                            </Select>
                        </Field>
                        <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
                            <input
                                type="checkbox"
                                checked={d.visible}
                                onChange={(e) => void run('PUT', '/phone/settings', { privacy: d.privacy, visible: e.target.checked }, 'Налаштування номера збережено.', page.reload)}
                            />{' '}
                            Показувати номер у профілі
                        </label>
                        {d.phone && (
                            <div className="mt-4 border-t border-white/10 pt-3">
                                <TransferForm friends={d.friends} onDone={page.reload} />
                            </div>
                        )}
                    </Card>
                </aside>
            </div>
        </div>
    );
}

function Gifts({ d, reload }: { d: Page; reload: () => Promise<void> }) {
    const { run } = useAction();
    const [to, setTo] = useState<Record<number, string>>({});
    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <Gift size={15} /> Мої подарункові номери
                </span>
            }
        >
            {d.gifts.map((g) => (
                <div key={g.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className={`flex-1 font-semibold tabular-nums ${TIER[g.tier]?.tone ?? ''}`}>{g.number}</span>
                    <Button small onClick={() => void run('POST', `/phone/gifts/${g.id}/claim`, undefined, 'Номер тепер ваш.', reload)}>
                        Забрати собі
                    </Button>
                    <Select value={to[g.id] ?? ''} onChange={(e) => setTo({ ...to, [g.id]: e.target.value })} className="!h-8 !w-40 text-xs">
                        <option value="">Кому подарувати</option>
                        {d.friends.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.name}
                            </option>
                        ))}
                    </Select>
                    <Button small disabled={!to[g.id]} onClick={() => void run('POST', `/phone/gifts/${g.id}/give`, { user_id: Number(to[g.id]) }, 'Подарунок надіслано.', reload)}>
                        <Send size={13} />
                    </Button>
                </div>
            ))}
        </Card>
    );
}

function TransferForm({ friends, onDone }: { friends: User[]; onDone: () => Promise<void> }) {
    const { run } = useAction();
    const [to, setTo] = useState('');
    return (
        <Field label="Передати свій номер другові">
            <div className="flex gap-2">
                <Select value={to} onChange={(e) => setTo(e.target.value)}>
                    <option value="">Оберіть друга</option>
                    {friends.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.name}
                        </option>
                    ))}
                </Select>
                <Button
                    small
                    disabled={!to}
                    onClick={() => confirm('Передати номер? Він перейде, щойно друг прийме.') && void run('POST', '/phone/transfer', { user_id: Number(to) }, 'Пропозицію надіслано.', onDone)}
                >
                    <Send size={13} />
                </Button>
            </div>
        </Field>
    );
}

/** Підбір гарного номера: свій код і цифри або ідеї за рівнем. Оплата — на сторінці оплати GameCon у браузері. */
function NumberPicker({ d }: { d: Page }) {
    const [op, setOp] = useState('');
    const [digits, setDigits] = useState('');
    const [check, setCheck] = useState<Check | null>(null);
    const [ideas, setIdeas] = useState<Check[]>([]);
    const [tier, setTier] = useState<string | null>(null);
    useEffect(() => {
        setCheck(null);
        if (!/^\d{2}$/.test(op) || !/^\d{7}$/.test(digits)) return;
        const t = window.setTimeout(() => void api<Check>('GET', `/api/v1/site/phone/check?operator=${op}&digits=${digits}`).then(setCheck, () => undefined), 300);
        return () => window.clearTimeout(t);
    }, [op, digits]);
    const suggest = async (t: string): Promise<void> => {
        setTier(t);
        const r = await api<{ numbers: Check[] }>('GET', `/api/v1/site/phone/suggest?tier=${t}${/^\d{2}$/.test(op) ? `&operator=${op}` : ''}`).catch(() => ({ numbers: [] }));
        setIdeas(r.numbers);
    };
    const choose = (c: Check): void => {
        setOp(c.operator);
        setDigits(c.digits);
    };
    return (
        <Card
            title={
                <span className="flex items-center gap-2">
                    <Sparkles size={15} /> Гарний номер
                </span>
            }
        >
            <div className="mb-3 flex gap-2">
                <Input value={op} maxLength={2} placeholder="Код" onChange={(e) => setOp(e.target.value.replace(/\D/g, ''))} className="!w-20 text-center tabular-nums" />
                <Input value={digits} maxLength={7} placeholder="7 цифр" onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))} className="text-center tracking-wider tabular-nums" />
            </div>
            {check && (
                <div className={`mb-3 rounded-xl p-3 ring-1 ${check.available ? 'bg-emerald-400/10 ring-emerald-400/30' : 'bg-rose-400/10 ring-rose-400/30'}`}>
                    <p className="font-bold tabular-nums">{check.number}</p>
                    <p className="text-xs text-white/60">
                        {TIER[check.tier]?.label} · {check.available ? uah(check.price) : (check.reason ?? 'Зайнятий')}
                        {check.available && check.price < check.full_price && <span className="ml-1 text-white/35 line-through">{uah(check.full_price)}</span>}
                    </p>
                    {check.available && (
                        <a href="https://gamecon.online/phone" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-neon-cyan hover:underline">
                            Купити за {uah(check.price)} <ExternalLink size={12} />
                        </a>
                    )}
                </div>
            )}
            <p className="mb-1.5 text-xs text-white/45">Ідеї за рівнем{d.isPlus ? ` · −${d.discount}% з GameCon+` : ''}</p>
            <div className="mb-2 flex flex-wrap gap-1">
                {Object.entries(d.prices).map(([t, p]) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => void suggest(t)}
                        className={`rounded-lg px-2 py-1 text-xs ring-1 ${tier === t ? 'bg-white/10 ring-white/25' : 'ring-white/10 hover:bg-white/5'}`}
                    >
                        <span className={TIER[t]?.tone}>{TIER[t]?.label ?? t}</span> <span className="text-white/45">{uah(p.price)}</span>
                    </button>
                ))}
            </div>
            <div className="space-y-1">
                {ideas.slice(0, 6).map((c) => (
                    <button key={c.number} type="button" onClick={() => choose(c)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                        <span className="font-semibold tabular-nums">{c.number}</span>
                        <Search size={12} className="text-white/35" />
                    </button>
                ))}
            </div>
            <p className="mt-2 text-[11px] text-white/35">
                Випадковий номер (код {d.codes.random}) — безкоштовно раз на {d.cooldownDays} дн.; шанс на золотий — {d.chances.gold}%.
            </p>
        </Card>
    );
}

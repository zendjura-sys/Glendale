import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    CalendarDays,
    Check,
    Coins,
    Crown,
    LogOut,
    MessageCircle,
    Newspaper,
    Pin,
    ScrollText,
    Settings,
    Swords,
    Trash2,
    Trophy,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ClanCard, UserCard } from '@/types';
import { ClanLogo } from './index';

type Member = {
    id: number;
    user: UserCard | null;
    nickname: string | null;
    rank: number;
    rank_title: string;
    is_owner: boolean;
    contributed: number;
    note: string | null;
    joined_at: string | null;
    applied_at: string;
    events?: number;
};

type Props = {
    clan: ClanCard & {
        description: string | null;
        rules: string | null;
        features: string[];
        currency: string;
        treasury: number | null;
        owner: UserCard | null;
        rank_titles: Record<number, string>;
        conversation_id: number | null;
        created_at: string | null;
    };
    me: (Member & { can: Record<string, boolean> }) | null;
    application: { applied_at: string } | null;
    features: Record<string, { label: string; text: string }>;
    join_modes: Record<string, string>;
    members: Member[];
    applications: Member[];
    news: {
        id: number;
        title: string;
        body: string;
        is_pinned: boolean;
        user: UserCard | null;
        created_at: string;
        mine: boolean;
    }[];
    events: {
        id: number;
        title: string;
        description: string | null;
        starts_at: string;
        going_count: number;
        going: boolean;
    }[];
    contributions: {
        id: number;
        amount: number;
        comment: string | null;
        status: 'pending' | 'approved' | 'rejected';
        user: UserCard | null;
        created_at: string;
    }[];
    rating: Member[];
    permissions: {
        labels: Record<string, string>;
        matrix: Record<string, number[]>;
    } | null;
    settings: {
        name: string;
        tag: string;
        description: string | null;
        rules: string | null;
        join_mode: string;
        is_recruiting: boolean;
        currency: string;
    } | null;
    logs: {
        id: number;
        text: string;
        actor: string | null;
        created_at: string;
    }[];
};

const input =
    'input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';
const area =
    'input-glass w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none';
const btn =
    'btn-glow inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50';
const ghost =
    'glass inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm text-white/75 hover:text-white';

const num = (n: number) => new Intl.NumberFormat('uk-UA').format(n);
const kyiv = (iso: string) =>
    new Date(iso).toLocaleString('uk-UA', {
        timeZone: 'Europe/Kyiv',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

function Card({
    title,
    icon: Icon,
    actions,
    children,
}: {
    title: string;
    icon: typeof Users;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="glass rounded-3xl p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
                <Icon className="size-4 text-[#a5b4fc]" />
                <h2 className="flex-1 font-display text-base font-semibold text-white">
                    {title}
                </h2>
                {actions}
            </div>
            {children}
        </section>
    );
}

const post = (url: string, data: Record<string, unknown> = {}) =>
    router.post(url, data as never, { preserveScroll: true });

/** Сторінка клану: огляд, новини, заходи, внески, рейтинг, статут, учасники й налаштування — за увімкненими розділами. */
export default function ClanShow(props: Props) {
    const {
        clan,
        me,
        application,
        members,
        applications,
        news,
        events,
        contributions,
        rating,
        features,
    } = props;
    const can = me?.can ?? {};
    const base = `/clans/${clan.slug}`;
    const has = (f: string) => clan.features.includes(f);

    const tabs = [
        ['overview', 'Огляд', Swords, true],
        ['news', 'Новини', Newspaper, me && has('news')],
        ['events', 'Заходи', CalendarDays, me && has('events')],
        ['treasury', 'Внески', Coins, me && has('treasury')],
        ['rating', 'Рейтинг', Trophy, me && has('rating')],
        ['rules', 'Статут', ScrollText, has('rules') && clan.rules],
        ['members', 'Учасники', Users, !!me],
        ['settings', 'Налаштування', Settings, can['settings.manage']],
    ].filter((t) => t[3]) as [string, string, typeof Users, boolean][];
    const [tab, setTab] = useState('overview');

    return (
        <>
            <Head title={clan.display_name} />
            <div className="glass mb-4 flex flex-wrap items-center gap-4 rounded-3xl p-4 sm:p-5">
                <ClanLogo clan={clan} size="lg" />
                <div className="min-w-0 flex-1">
                    <h1 className="truncate font-display text-xl font-semibold text-white sm:text-2xl">
                        {clan.display_name}
                    </h1>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/55">
                        <span className="font-mono text-[#a5b4fc]">
                            [{clan.tag}]
                        </span>
                        {clan.game && (
                            <Link
                                href={`/games/${clan.game.slug}`}
                                className="hover:text-white"
                            >
                                {clan.game.name}
                            </Link>
                        )}
                        <span className="inline-flex items-center gap-1">
                            <Users className="size-4" /> {clan.members_count}
                        </span>
                        {clan.treasury !== null && (
                            <span className="inline-flex items-center gap-1 text-amber-200">
                                <Coins className="size-4" />{' '}
                                {num(clan.treasury)} {clan.currency}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {clan.conversation_id && (
                        <a href={`${base}/chat`} className={ghost}>
                            <MessageCircle className="size-4" /> Чат
                        </a>
                    )}
                    {!me && !application && clan.is_recruiting && (
                        <button
                            type="button"
                            onClick={() =>
                                post(`${base}/join`, {
                                    note:
                                        prompt(
                                            'Кілька слів про себе (необов’язково)',
                                        ) ?? '',
                                })
                            }
                            className={btn}
                        >
                            <UserPlus className="size-4" />{' '}
                            {clan.join_mode === 'open'
                                ? 'Вступити'
                                : 'Подати заявку'}
                        </button>
                    )}
                    {application && (
                        <button
                            type="button"
                            onClick={() => post(`${base}/leave`)}
                            className={ghost}
                        >
                            Заявка на розгляді · відкликати
                        </button>
                    )}
                    {me && !me.is_owner && (
                        <button
                            type="button"
                            onClick={() =>
                                confirm('Вийти з клану?') &&
                                post(`${base}/leave`)
                            }
                            className={ghost}
                        >
                            <LogOut className="size-4" /> Вийти
                        </button>
                    )}
                </div>
            </div>

            <div className="mb-4 flex [scrollbar-width:none] gap-1 overflow-x-auto">
                {tabs.map(([key, label, Icon]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={cn(
                            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm transition',
                            tab === key
                                ? 'bg-gradient-brand text-white'
                                : 'glass text-white/65 hover:text-white',
                        )}
                    >
                        <Icon className="size-4" /> {label}
                        {key === 'members' && applications.length > 0 && (
                            <span className="rounded-full bg-rose-500 px-1.5 text-[11px] text-white">
                                {applications.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {tab === 'overview' && (
                    <>
                        <Card title="Про клан" icon={Swords}>
                            <p className="text-sm whitespace-pre-line text-white/75">
                                {clan.description || 'Опису поки немає.'}
                            </p>
                            <p className="mt-3 text-xs text-white/45">
                                {props.join_modes[clan.join_mode]} · засновник{' '}
                                {clan.owner?.name ?? '—'}
                                {clan.created_at &&
                                    ` · з ${new Date(clan.created_at).toLocaleDateString('uk-UA')}`}
                            </p>
                        </Card>
                        {me && has('voice') && (
                            <VoiceRooms
                                owner={{ type: 'clan', id: clan.id }}
                                label={clan.display_name}
                                href={base}
                            />
                        )}
                        {me && has('news') && news.length > 0 && (
                            <Card title="Останні новини" icon={Newspaper}>
                                {news.slice(0, 3).map((n) => (
                                    <div
                                        key={n.id}
                                        className="border-b border-white/[0.06] py-2 last:border-0"
                                    >
                                        <p className="text-sm font-semibold text-white">
                                            {n.title}
                                        </p>
                                        <p className="line-clamp-2 text-sm text-white/60">
                                            {n.body}
                                        </p>
                                    </div>
                                ))}
                            </Card>
                        )}
                        {me && has('events') && events.length > 0 && (
                            <Card title="Найближчі заходи" icon={CalendarDays}>
                                {events.slice(0, 3).map((e) => (
                                    <p
                                        key={e.id}
                                        className="py-1 text-sm text-white/75"
                                    >
                                        <span className="text-[#a5b4fc]">
                                            {kyiv(e.starts_at)}
                                        </span>{' '}
                                        — {e.title} · {e.going_count} іде
                                    </p>
                                ))}
                            </Card>
                        )}
                        {!me && (
                            <p className="text-center text-sm text-white/45">
                                Новини, заходи, внески й голосові кімнати бачать
                                лише учасники.
                            </p>
                        )}
                    </>
                )}

                {tab === 'news' && (
                    <NewsTab
                        base={base}
                        news={news}
                        canPost={!!can['news.post']}
                    />
                )}
                {tab === 'events' && (
                    <EventsTab
                        base={base}
                        events={events}
                        canManage={!!can['events.manage']}
                    />
                )}
                {tab === 'treasury' && (
                    <TreasuryTab
                        base={base}
                        clan={clan}
                        contributions={contributions}
                        canManage={!!can['treasury.manage']}
                    />
                )}

                {tab === 'rating' && (
                    <Card title="Рейтинг учасників" icon={Trophy}>
                        {rating.map((m, i) => (
                            <div
                                key={m.id}
                                className="flex items-center gap-3 py-1.5"
                            >
                                <span className="w-6 text-center text-sm font-bold text-white/60">
                                    {i + 1}
                                </span>
                                {m.user && (
                                    <UserAvatar user={m.user} size="sm" />
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm text-white">
                                    {m.nickname || m.user?.name}
                                </span>
                                <span className="text-xs text-white/55">
                                    {m.events ?? 0} заходів
                                </span>
                                <span className="w-24 text-right text-sm text-amber-200">
                                    {num(m.contributed)} {clan.currency}
                                </span>
                            </div>
                        ))}
                    </Card>
                )}

                {tab === 'rules' && (
                    <Card title="Статут" icon={ScrollText}>
                        <p className="text-sm whitespace-pre-line text-white/75">
                            {clan.rules}
                        </p>
                    </Card>
                )}

                {tab === 'members' && (
                    <MembersTab
                        base={base}
                        me={me}
                        members={members}
                        applications={applications}
                        rankTitles={clan.rank_titles}
                    />
                )}
                {tab === 'settings' && props.settings && (
                    <SettingsTab
                        base={base}
                        clan={clan}
                        features={features}
                        joinModes={props.join_modes}
                        settings={props.settings}
                        permissions={props.permissions}
                        logs={props.logs}
                        isOwner={!!me?.is_owner}
                        myRank={me?.rank ?? 0}
                    />
                )}
            </div>
        </>
    );
}

function NewsTab({
    base,
    news,
    canPost,
}: {
    base: string;
    news: Props['news'];
    canPost: boolean;
}) {
    const form = useForm({ title: '', body: '', is_pinned: false });

    return (
        <>
            {canPost && (
                <Card title="Нова новина" icon={Newspaper}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(`${base}/news`, {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                        className="space-y-2"
                    >
                        <input
                            value={form.data.title}
                            maxLength={120}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder="Заголовок"
                            className={input}
                        />
                        <textarea
                            value={form.data.body}
                            rows={4}
                            maxLength={5000}
                            onChange={(e) =>
                                form.setData('body', e.target.value)
                            }
                            placeholder="Текст новини"
                            className={area}
                        />
                        <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-white/70">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_pinned}
                                    onChange={(e) =>
                                        form.setData(
                                            'is_pinned',
                                            e.target.checked,
                                        )
                                    }
                                />{' '}
                                Закріпити
                            </label>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className={cn(btn, 'ml-auto')}
                            >
                                Опублікувати
                            </button>
                        </div>
                    </form>
                </Card>
            )}
            {news.length === 0 && (
                <p className="text-center text-sm text-white/45">
                    Новин ще немає.
                </p>
            )}
            {news.map((n) => (
                <article key={n.id} className="glass rounded-3xl p-4">
                    <div className="mb-1 flex items-center gap-2">
                        {n.is_pinned && (
                            <Pin className="size-4 text-amber-300" />
                        )}
                        <h3 className="flex-1 font-semibold text-white">
                            {n.title}
                        </h3>
                        {(n.mine || canPost) && (
                            <button
                                type="button"
                                onClick={() =>
                                    confirm('Видалити новину?') &&
                                    router.delete(`${base}/news/${n.id}`, {
                                        preserveScroll: true,
                                    })
                                }
                                className="text-white/40 hover:text-rose-300"
                                aria-label="Видалити"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        )}
                    </div>
                    <p className="text-sm whitespace-pre-line text-white/75">
                        {n.body}
                    </p>
                    <p className="mt-2 text-xs text-white/40">
                        {n.user?.name} · {timeAgo(n.created_at)}
                    </p>
                </article>
            ))}
        </>
    );
}

function EventsTab({
    base,
    events,
    canManage,
}: {
    base: string;
    events: Props['events'];
    canManage: boolean;
}) {
    const form = useForm({ title: '', description: '', starts_at: '' });

    return (
        <>
            {canManage && (
                <Card title="Новий захід" icon={CalendarDays}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(`${base}/events`, {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                        className="grid gap-2 sm:grid-cols-[1fr_220px]"
                    >
                        <input
                            value={form.data.title}
                            maxLength={120}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder="Рейд, турнір, збір…"
                            className={input}
                        />
                        <input
                            type="datetime-local"
                            value={form.data.starts_at}
                            onChange={(e) =>
                                form.setData('starts_at', e.target.value)
                            }
                            className={input}
                        />
                        <textarea
                            value={form.data.description}
                            rows={2}
                            maxLength={1000}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            placeholder="Деталі (необов’язково)"
                            className={cn(area, 'sm:col-span-2')}
                        />
                        {form.errors.starts_at && (
                            <p className="text-xs text-rose-300 sm:col-span-2">
                                {form.errors.starts_at}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={form.processing}
                            className={cn(btn, 'sm:col-span-2')}
                        >
                            Створити захід
                        </button>
                    </form>
                </Card>
            )}
            {events.length === 0 && (
                <p className="text-center text-sm text-white/45">
                    Найближчих заходів немає.
                </p>
            )}
            {events.map((e) => (
                <article
                    key={e.id}
                    className="glass flex flex-wrap items-center gap-3 rounded-3xl p-4"
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#a5b4fc]">
                            {kyiv(e.starts_at)}
                        </p>
                        <h3 className="font-semibold text-white">{e.title}</h3>
                        {e.description && (
                            <p className="text-sm text-white/60">
                                {e.description}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-white/45">
                            Іде: {e.going_count}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => post(`${base}/events/${e.id}/rsvp`)}
                        className={e.going ? btn : ghost}
                    >
                        {e.going ? (
                            <>
                                <Check className="size-4" /> Іду
                            </>
                        ) : (
                            'Піду'
                        )}
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() =>
                                confirm('Видалити захід?') &&
                                router.delete(`${base}/events/${e.id}`, {
                                    preserveScroll: true,
                                })
                            }
                            className="text-white/40 hover:text-rose-300"
                            aria-label="Видалити"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    )}
                </article>
            ))}
        </>
    );
}

function TreasuryTab({
    base,
    clan,
    contributions,
    canManage,
}: {
    base: string;
    clan: Props['clan'];
    contributions: Props['contributions'];
    canManage: boolean;
}) {
    const give = useForm({ amount: '', comment: '' });
    const spend = useForm({ amount: '', comment: '' });
    const label = {
        pending: 'очікує',
        approved: '',
        rejected: 'відхилено',
    } as const;

    return (
        <>
            <Card
                title={`Скарбниця: ${num(clan.treasury ?? 0)} ${clan.currency}`}
                icon={Coins}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        give.post(`${base}/contributions`, {
                            preserveScroll: true,
                            onSuccess: () => give.reset(),
                        });
                    }}
                    className="flex flex-wrap gap-2"
                >
                    <input
                        type="number"
                        min={1}
                        value={give.data.amount}
                        onChange={(e) => give.setData('amount', e.target.value)}
                        placeholder={`Сума, ${clan.currency}`}
                        className={cn(input, 'w-40')}
                    />
                    <input
                        value={give.data.comment}
                        maxLength={200}
                        onChange={(e) =>
                            give.setData('comment', e.target.value)
                        }
                        placeholder="Коментар"
                        className={cn(input, 'min-w-[160px] flex-1')}
                    />
                    <button
                        type="submit"
                        disabled={give.processing}
                        className={btn}
                    >
                        Зробити внесок
                    </button>
                </form>
                <p className="mt-2 text-xs text-white/45">
                    Внесок зараховується після підтвердження скарбником.
                </p>
                {canManage && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            spend.post(`${base}/spend`, {
                                preserveScroll: true,
                                onSuccess: () => spend.reset(),
                            });
                        }}
                        className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4"
                    >
                        <input
                            type="number"
                            min={1}
                            value={spend.data.amount}
                            onChange={(e) =>
                                spend.setData('amount', e.target.value)
                            }
                            placeholder="Витрата"
                            className={cn(input, 'w-40')}
                        />
                        <input
                            value={spend.data.comment}
                            maxLength={200}
                            onChange={(e) =>
                                spend.setData('comment', e.target.value)
                            }
                            placeholder="На що"
                            className={cn(input, 'min-w-[160px] flex-1')}
                        />
                        <button
                            type="submit"
                            disabled={spend.processing}
                            className={ghost}
                        >
                            Записати витрату
                        </button>
                        {spend.errors.amount && (
                            <p className="w-full text-xs text-rose-300">
                                {spend.errors.amount}
                            </p>
                        )}
                    </form>
                )}
            </Card>
            <Card title="Історія" icon={Coins}>
                {contributions.length === 0 && (
                    <p className="text-sm text-white/45">Ще немає операцій.</p>
                )}
                {contributions.map((c) => (
                    <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] py-2 last:border-0"
                    >
                        {c.user && <UserAvatar user={c.user} size="xs" />}
                        <span className="min-w-0 flex-1 text-sm text-white/75">
                            {c.user?.name}{' '}
                            {c.comment && (
                                <span className="text-white/45">
                                    · {c.comment}
                                </span>
                            )}
                        </span>
                        <span
                            className={cn(
                                'text-sm font-semibold',
                                c.amount < 0
                                    ? 'text-rose-300'
                                    : 'text-emerald-300',
                            )}
                        >
                            {c.amount > 0 ? '+' : ''}
                            {num(c.amount)}
                        </span>
                        {c.status !== 'approved' && (
                            <span className="text-xs text-white/45">
                                {label[c.status]}
                            </span>
                        )}
                        {canManage && c.status === 'pending' && (
                            <span className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        post(`${base}/contributions/${c.id}`, {
                                            approve: true,
                                        })
                                    }
                                    className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-200"
                                    aria-label="Підтвердити"
                                >
                                    <Check className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        post(`${base}/contributions/${c.id}`, {
                                            approve: false,
                                        })
                                    }
                                    className="rounded-lg bg-rose-500/15 p-1.5 text-rose-200"
                                    aria-label="Відхилити"
                                >
                                    <X className="size-4" />
                                </button>
                            </span>
                        )}
                    </div>
                ))}
            </Card>
        </>
    );
}

function MembersTab({
    base,
    me,
    members,
    applications,
    rankTitles,
}: {
    base: string;
    me: Props['me'];
    members: Member[];
    applications: Member[];
    rankTitles: Record<number, string>;
}) {
    const manage = !!me?.can['members.manage'];
    const act = (m: Member, action: string, rank?: number) =>
        post(`${base}/members/${m.id}`, { action, ...(rank ? { rank } : {}) });

    return (
        <>
            {manage && applications.length > 0 && (
                <Card title={`Заявки (${applications.length})`} icon={UserPlus}>
                    {applications.map((m) => (
                        <div
                            key={m.id}
                            className="flex flex-wrap items-center gap-3 py-2"
                        >
                            {m.user && <UserAvatar user={m.user} size="sm" />}
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm text-white">
                                    {m.user?.name}
                                </span>
                                {m.note && (
                                    <span className="block text-xs text-white/50">
                                        {m.note}
                                    </span>
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => act(m, 'accept')}
                                className={btn}
                            >
                                Прийняти
                            </button>
                            <button
                                type="button"
                                onClick={() => act(m, 'decline')}
                                className={ghost}
                            >
                                Відхилити
                            </button>
                        </div>
                    ))}
                </Card>
            )}
            <Card title={`Склад (${members.length})`} icon={Users}>
                {members.map((m) => {
                    const canTouch =
                        manage &&
                        !m.is_owner &&
                        me &&
                        m.id !== me.id &&
                        (me.is_owner || me.rank > m.rank);

                    return (
                        <div
                            key={m.id}
                            className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] py-2 last:border-0"
                        >
                            {m.user && <UserAvatar user={m.user} size="sm" />}
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-sm text-white">
                                    {m.nickname || m.user?.name}{' '}
                                    {m.is_owner && (
                                        <Crown className="size-3.5 text-amber-300" />
                                    )}
                                </span>
                                <span className="block text-xs text-white/50">
                                    {m.rank_title}
                                </span>
                            </span>
                            {canTouch && (
                                <>
                                    <select
                                        value={m.rank}
                                        onChange={(e) =>
                                            act(
                                                m,
                                                'rank',
                                                Number(e.target.value),
                                            )
                                        }
                                        className="input-glass h-9 rounded-lg px-2 text-xs text-white"
                                        aria-label="Ранг"
                                    >
                                        {[1, 2, 3, 4]
                                            .filter(
                                                (r) =>
                                                    me.is_owner || r < me.rank,
                                            )
                                            .map((r) => (
                                                <option key={r} value={r}>
                                                    {rankTitles[r]}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            confirm(
                                                `Виключити ${m.user?.name}?`,
                                            ) && act(m, 'kick')
                                        }
                                        className="text-xs text-rose-300 hover:underline"
                                    >
                                        Виключити
                                    </button>
                                </>
                            )}
                            {me?.is_owner && !m.is_owner && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        confirm(
                                            `Передати лідерство ${m.user?.name}?`,
                                        ) && act(m, 'transfer')
                                    }
                                    className="text-xs text-amber-200 hover:underline"
                                >
                                    Зробити лідером
                                </button>
                            )}
                        </div>
                    );
                })}
            </Card>
        </>
    );
}

function SettingsTab({
    base,
    clan,
    features,
    joinModes,
    settings,
    permissions,
    logs,
    isOwner,
    myRank,
}: {
    base: string;
    clan: Props['clan'];
    features: Props['features'];
    joinModes: Record<string, string>;
    settings: NonNullable<Props['settings']>;
    permissions: Props['permissions'];
    logs: Props['logs'];
    isOwner: boolean;
    myRank: number;
}) {
    const form = useForm({
        ...settings,
        description: settings.description ?? '',
        rules: settings.rules ?? '',
        features: clan.features,
        rank_titles: [1, 2, 3, 4, 5].map((r) => clan.rank_titles[r] ?? ''),
        permissions: permissions?.matrix ?? {},
        logo: null as File | null,
    });
    const toggleFeature = (key: string) =>
        form.setData(
            'features',
            form.data.features.includes(key)
                ? form.data.features.filter((f) => f !== key)
                : [...form.data.features, key],
        );
    const togglePerm = (perm: string, rank: number) => {
        const current = form.data.permissions[perm] ?? [];
        form.setData('permissions', {
            ...form.data.permissions,
            [perm]: current.includes(rank)
                ? current.filter((r) => r !== rank)
                : [...current, rank],
        });
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.post(`${base}/settings`, {
                    preserveScroll: true,
                    forceFormData: true,
                });
            }}
            className="space-y-4"
        >
            <Card title="Основне" icon={Settings}>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_160px]">
                    <input
                        value={form.data.name}
                        maxLength={60}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className={input}
                        aria-label="Назва"
                    />
                    <input
                        value={form.data.tag}
                        maxLength={6}
                        onChange={(e) =>
                            form.setData('tag', e.target.value.toUpperCase())
                        }
                        className={input}
                        aria-label="Тег"
                    />
                    <input
                        value={form.data.currency}
                        maxLength={24}
                        onChange={(e) =>
                            form.setData('currency', e.target.value)
                        }
                        className={input}
                        aria-label="Валюта внесків"
                        placeholder="Валюта внесків"
                    />
                </div>
                <textarea
                    value={form.data.description}
                    rows={3}
                    maxLength={1000}
                    onChange={(e) =>
                        form.setData('description', e.target.value)
                    }
                    placeholder="Опис"
                    className={cn(area, 'mt-2')}
                />
                <textarea
                    value={form.data.rules}
                    rows={4}
                    maxLength={10000}
                    onChange={(e) => form.setData('rules', e.target.value)}
                    placeholder="Статут (розділ «Статут»)"
                    className={cn(area, 'mt-2')}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    {Object.entries(joinModes).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => form.setData('join_mode', key)}
                            className={cn(
                                'rounded-xl px-3 py-1.5 text-sm',
                                form.data.join_mode === key
                                    ? 'bg-gradient-brand text-white'
                                    : 'bg-white/[0.05] text-white/65',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                    <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-white/70">
                        Логотип
                        <input
                            type="file"
                            accept="image/*"
                            className="text-xs"
                            onChange={(e) =>
                                form.setData(
                                    'logo',
                                    e.target.files?.[0] ?? null,
                                )
                            }
                        />
                    </label>
                </div>
            </Card>

            <Card title="Розділи клану" icon={Swords}>
                <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(features).map(([key, f]) => {
                        const on = form.data.features.includes(key);

                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggleFeature(key)}
                                className={cn(
                                    'flex items-start gap-3 rounded-2xl p-3 text-left',
                                    on
                                        ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/60'
                                        : 'bg-white/[0.03]',
                                )}
                            >
                                <span
                                    className={cn(
                                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                                        on
                                            ? 'border-transparent bg-gradient-brand'
                                            : 'border-white/25',
                                    )}
                                >
                                    {on && (
                                        <Check className="size-3.5 text-white" />
                                    )}
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-white">
                                        {f.label}
                                    </span>
                                    <span className="block text-xs text-white/50">
                                        {f.text}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </Card>

            <Card title="Ранги й права" icon={Crown}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {form.data.rank_titles.map((t, i) => (
                        <label key={i}>
                            <span className="mb-1 block text-[11px] text-white/45">
                                Ранг {i + 1}
                            </span>
                            <input
                                value={t}
                                maxLength={24}
                                onChange={(e) =>
                                    form.setData(
                                        'rank_titles',
                                        form.data.rank_titles.map((x, j) =>
                                            j === i ? e.target.value : x,
                                        ),
                                    )
                                }
                                className={cn(input, 'h-9 text-xs')}
                            />
                        </label>
                    ))}
                </div>
                {permissions && (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[480px] text-xs">
                            <thead>
                                <tr className="text-white/40">
                                    <th className="py-2 text-left font-medium">
                                        Право
                                    </th>
                                    {[1, 2, 3, 4].map((r) => (
                                        <th
                                            key={r}
                                            className="w-9 py-2 font-medium"
                                        >
                                            {r}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(permissions.labels).map(
                                    ([perm, label]) => (
                                        <tr
                                            key={perm}
                                            className="border-t border-white/[0.05]"
                                        >
                                            <td className="py-2 pr-2 text-white/70">
                                                {label}
                                            </td>
                                            {[1, 2, 3, 4].map((r) => {
                                                const on = (
                                                    form.data.permissions[
                                                        perm
                                                    ] ?? []
                                                ).includes(r);
                                                const locked =
                                                    !isOwner && r >= myRank;

                                                return (
                                                    <td
                                                        key={r}
                                                        className="text-center"
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={locked}
                                                            onClick={() =>
                                                                togglePerm(
                                                                    perm,
                                                                    r,
                                                                )
                                                            }
                                                            className={cn(
                                                                'size-6 rounded-md disabled:opacity-30',
                                                                on
                                                                    ? 'bg-gradient-brand text-white'
                                                                    : 'bg-white/[0.05]',
                                                            )}
                                                            aria-label={`${label}: ранг ${r}`}
                                                        >
                                                            {on && (
                                                                <Check className="mx-auto size-3.5" />
                                                            )}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                        <p className="mt-2 text-xs text-white/40">
                            Ранг 5 (лідер) і засновник мають усі права.
                        </p>
                    </div>
                )}
            </Card>

            <button
                type="submit"
                disabled={form.processing}
                className={cn(btn, 'w-full')}
            >
                Зберегти налаштування
            </button>

            {logs.length > 0 && (
                <Card title="Журнал дій" icon={ScrollText}>
                    {logs.map((l) => (
                        <p key={l.id} className="py-1 text-xs text-white/60">
                            <span className="text-white/40">
                                {timeAgo(l.created_at)}
                            </span>{' '}
                            · {l.actor ?? 'Система'}: {l.text}
                        </p>
                    ))}
                </Card>
            )}
        </form>
    );
}

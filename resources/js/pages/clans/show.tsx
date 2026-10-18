import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    BellRing,
    CalendarDays,
    Check,
    Coins,
    Crown,
    Download,
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
import { InviteLinkButton } from '@/components/gc/invite-link';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VoiceRooms } from '@/components/gc/voice-rooms';
import { timeAgo } from '@/lib/format';
import { cn, formText } from '@/lib/utils';
import type { ClanCard, UserCard } from '@/types';
import { ClanLogo } from './index';
import { eventTime } from '@/lib/event-time';
import { BotsCard } from '@/components/bots/bots-card';
import { LOCALE, tr } from '@/lib/i18n';

type Member = {
    id: number;
    user: UserCard | null;
    nickname: string | null;
    rank: number;
    rank_title: string;
    is_owner: boolean;
    contributed: number;
    note: string | null;
    answers?: string[];
    joined_at: string | null;
    applied_at: string;
    events?: number;
    away?: boolean;
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
        questions: string[];
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
        repeat: string | null;
        cover_url: string | null;
        ics_url: string;
        bracket: {
            teams: string[];
            semi: [number | null, number | null][];
            final: [number | null, number | null];
        } | null;
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
        questions: string[];
    } | null;
    logs: {
        id: number;
        text: string;
        actor: string | null;
        created_at: string;
    }[];
    allies: { name: string; slug: string }[];
    alliance_requests: { id: number; name: string; slug: string }[];
    matches: {
        id: number;
        home: string;
        away: string;
        starts_at: string;
        note: string | null;
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

const num = (n: number) => new Intl.NumberFormat(LOCALE).format(n);

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
                <Icon className="size-4 text-gc-lilac-200" />
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

function JoinForm({ base, questions }: { base: string; questions: string[] }) {
    const form = useForm({ note: '', answers: questions.map(() => '') });

    return (
        <form
            className="glass w-full basis-full space-y-2 rounded-2xl p-3"
            onSubmit={(event) => {
                event.preventDefault();
                form.post(`${base}/join`, { preserveScroll: true });
            }}
        >
            {questions.map((question, index) => (
                <label
                    key={`${index}-${question}`}
                    className="block text-xs text-white/55"
                >
                    {question}
                    <input
                        value={form.data.answers[index] ?? ''}
                        maxLength={300}
                        onChange={(event) => {
                            const next = [...form.data.answers];
                            next[index] = event.target.value;
                            form.setData('answers', next);
                        }}
                        className={cn(input, 'mt-1')}
                        required
                    />
                </label>
            ))}
            <input
                value={form.data.note}
                maxLength={500}
                onChange={(event) => form.setData('note', event.target.value)}
                placeholder={tr('Кілька слів про себе (необов’язково)')}
                className={input}
            />
            {form.errors.answers && (
                <p className="text-xs text-rose-300">{form.errors.answers}</p>
            )}
            <button type="submit" disabled={form.processing} className={btn}>
                <UserPlus className="size-4" /> {tr('Подати заявку')}
            </button>
        </form>
    );
}

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
        ['overview', tr('Огляд'), Swords, true],
        ['news', tr('Новини'), Newspaper, me && has('news')],
        ['events', tr('Заходи'), CalendarDays, me && has('events')],
        ['treasury', tr('Внески'), Coins, me && has('treasury')],
        ['rating', tr('Рейтинг'), Trophy, me && has('rating')],
        ['rules', tr('Статут'), ScrollText, has('rules') && clan.rules],
        ['members', tr('Учасники'), Users, !!me],
        ['settings', tr('Налаштування'), Settings, can['settings.manage']],
    ].filter((t) => t[3]) as [string, string, typeof Users, boolean][];
    // ?tab=settings — сюди повертає підключення бота Discord.
    const [tab, setTab] = useState(() =>
        typeof window === 'undefined'
            ? 'overview'
            : (new URLSearchParams(window.location.search).get('tab') ??
              'overview'),
    );

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
                        <span className="font-mono text-gc-lilac-200">
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
                            <MessageCircle className="size-4" /> {tr('Чат')}
                        </a>
                    )}
                    {me?.can['members.manage'] && (
                        <InviteLinkButton
                            url={`${base}/invite-link`}
                            className={ghost}
                        />
                    )}
                    {!me &&
                    !application &&
                    clan.is_recruiting &&
                    clan.questions.length > 0 &&
                    clan.join_mode !== 'open' ? (
                        <JoinForm base={base} questions={clan.questions} />
                    ) : (
                        !me &&
                        !application &&
                        clan.is_recruiting && (
                            <button
                                type="button"
                                onClick={() =>
                                    post(`${base}/join`, { note: '' })
                                }
                                className={btn}
                            >
                                <UserPlus className="size-4" />{' '}
                                {clan.join_mode === 'open'
                                    ? tr('Вступити')
                                    : tr('Подати заявку')}
                            </button>
                        )
                    )}
                    {application && (
                        <button
                            type="button"
                            onClick={() => post(`${base}/leave`)}
                            className={ghost}
                        >
                            {tr('Заявка на розгляді · відкликати')}
                        </button>
                    )}
                    {me && !me.is_owner && (
                        <button
                            type="button"
                            onClick={() =>
                                confirm(tr('Вийти з клану?')) &&
                                post(`${base}/leave`)
                            }
                            className={ghost}
                        >
                            <LogOut className="size-4" /> {tr('Вийти')}
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
                        <Card title={tr('Про клан')} icon={Swords}>
                            <p className="text-sm whitespace-pre-line text-white/75">
                                {clan.description || tr('Опису поки немає.')}
                            </p>
                            <p className="mt-3 text-xs text-white/45">
                                {props.join_modes[clan.join_mode]}{' '}
                                {tr('· засновник')} {clan.owner?.name ?? '—'}
                                {clan.created_at &&
                                    tr(' · з {toLocaleDateString}', {
                                        toLocaleDateString: new Date(
                                            clan.created_at,
                                        ).toLocaleDateString(LOCALE),
                                    })}
                            </p>
                        </Card>
                        <Card title={tr('Союз і матчі')} icon={Swords}>
                            {props.allies.length === 0 ? (
                                <p className="text-sm text-white/45">
                                    {tr('Союзників ще немає.')}
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {props.allies.map((ally) => (
                                        <Link
                                            key={ally.slug}
                                            href={`/clans/${ally.slug}`}
                                            className="rounded-full bg-white/10 px-3 py-1 text-sm text-white"
                                        >
                                            {ally.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                            {props.matches.length > 0 && (
                                <ul className="mt-3 space-y-1 text-sm text-white/75">
                                    {props.matches.map((match) => (
                                        <li key={match.id}>
                                            {match.home} vs {match.away} ·{' '}
                                            {eventTime(match.starts_at)}
                                            {match.note
                                                ? ` · ${match.note}`
                                                : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {me?.is_owner && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <form
                                        className="flex gap-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const data = new FormData(
                                                event.currentTarget,
                                            );
                                            post(`${base}/allies`, {
                                                tag: formText(data, 'tag'),
                                            });
                                            event.currentTarget.reset();
                                        }}
                                    >
                                        <input
                                            name="tag"
                                            placeholder={tr('Тег союзу')}
                                            className={cn(input, 'w-28')}
                                        />
                                        <button type="submit" className={ghost}>
                                            {tr('Союз')}
                                        </button>
                                    </form>
                                    <form
                                        className="flex flex-wrap gap-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const data = new FormData(
                                                event.currentTarget,
                                            );
                                            post(`${base}/matches`, {
                                                tag: formText(data, 'tag'),
                                                starts_at: formText(
                                                    data,
                                                    'starts_at',
                                                ),
                                                note: formText(data, 'note'),
                                            });
                                        }}
                                    >
                                        <input
                                            name="tag"
                                            placeholder={tr('Тег суперника')}
                                            className={cn(input, 'w-28')}
                                        />
                                        <input
                                            name="starts_at"
                                            type="datetime-local"
                                            required
                                            className={cn(input, 'w-48')}
                                        />
                                        <input
                                            name="note"
                                            placeholder={tr('Нотатка')}
                                            className={cn(input, 'w-36')}
                                        />
                                        <button type="submit" className={ghost}>
                                            {tr('Матч')}
                                        </button>
                                    </form>
                                </div>
                            )}
                            {props.alliance_requests.map((request) => (
                                <button
                                    key={request.id}
                                    type="button"
                                    onClick={() =>
                                        post(
                                            `${base}/allies/${request.id}/accept`,
                                        )
                                    }
                                    className={cn(ghost, 'mt-2')}
                                >
                                    {tr('Прийняти союз від {name}', {
                                        name: request.name,
                                    })}
                                </button>
                            ))}
                        </Card>
                        {me && has('voice') && (
                            <VoiceRooms
                                owner={{ type: 'clan', id: clan.id }}
                                label={clan.display_name}
                                href={base}
                            />
                        )}
                        {me && has('news') && news.length > 0 && (
                            <Card title={tr('Останні новини')} icon={Newspaper}>
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
                            <Card
                                title={tr('Найближчі заходи')}
                                icon={CalendarDays}
                            >
                                {events.slice(0, 3).map((e) => (
                                    <p
                                        key={e.id}
                                        className="py-1 text-sm text-white/75"
                                    >
                                        <span className="text-gc-lilac-200">
                                            {eventTime(e.starts_at)}
                                        </span>{' '}
                                        — {e.title} · {e.going_count}{' '}
                                        {tr('іде')}
                                    </p>
                                ))}
                            </Card>
                        )}
                        {!me && (
                            <p className="text-center text-sm text-white/45">
                                {tr(
                                    'Новини, заходи, внески й голосові кімнати бачать лише учасники.',
                                )}
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
                    <Card title={tr('Рейтинг учасників')} icon={Trophy}>
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
                                    {m.events ?? 0} {tr('заходів')}
                                </span>
                                <span className="w-24 text-right text-sm text-amber-200">
                                    {num(m.contributed)} {clan.currency}
                                </span>
                            </div>
                        ))}
                    </Card>
                )}

                {tab === 'rules' && (
                    <Card title={tr('Статут')} icon={ScrollText}>
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
                    <BotsCard type="clan" id={clan.id} />
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
                <Card title={tr('Нова новина')} icon={Newspaper}>
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
                            placeholder={tr('Заголовок')}
                            className={input}
                        />
                        <textarea
                            value={form.data.body}
                            rows={4}
                            maxLength={5000}
                            onChange={(e) =>
                                form.setData('body', e.target.value)
                            }
                            placeholder={tr('Текст новини')}
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
                                {tr('Закріпити')}
                            </label>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className={cn(btn, 'ml-auto')}
                            >
                                {tr('Опублікувати')}
                            </button>
                        </div>
                    </form>
                </Card>
            )}
            {news.length === 0 && (
                <p className="text-center text-sm text-white/45">
                    {tr('Новин ще немає.')}
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
                                    confirm(tr('Видалити новину?')) &&
                                    router.delete(`${base}/news/${n.id}`, {
                                        preserveScroll: true,
                                    })
                                }
                                className="text-white/40 hover:text-rose-300"
                                aria-label={tr('Видалити')}
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
    const form = useForm({
        title: '',
        description: '',
        starts_at: '',
        weekly: false,
        cover: null as File | null,
    });

    return (
        <>
            {canManage && (
                <Card title={tr('Новий захід')} icon={CalendarDays}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post(`${base}/events`, {
                                preserveScroll: true,
                                onSuccess: () => form.reset(),
                            });
                        }}
                        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]"
                    >
                        <input
                            value={form.data.title}
                            maxLength={120}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr('Рейд, турнір, збір…')}
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
                            placeholder={tr('Деталі (необов’язково)')}
                            className={cn(area, 'sm:col-span-2')}
                        />
                        {form.errors.starts_at && (
                            <p className="text-xs text-rose-300 sm:col-span-2">
                                {form.errors.starts_at}
                            </p>
                        )}
                        <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                            {tr('Обкладинка (необов’язково)')}
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                    form.setData(
                                        'cover',
                                        e.target.files?.[0] ?? null,
                                    )
                                }
                                className={cn(input, 'py-2')}
                            />
                            {form.errors.cover && (
                                <span className="text-rose-300">
                                    {form.errors.cover}
                                </span>
                            )}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
                            <input
                                type="checkbox"
                                checked={form.data.weekly}
                                onChange={(e) =>
                                    form.setData('weekly', e.target.checked)
                                }
                            />
                            {tr('Щотижня')}
                        </label>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className={cn(btn, 'sm:col-span-2')}
                        >
                            {tr('Створити захід')}
                        </button>
                    </form>
                </Card>
            )}
            {events.length === 0 && (
                <p className="text-center text-sm text-white/45">
                    {tr('Найближчих заходів немає.')}
                </p>
            )}
            {events.map((e) => (
                <article
                    key={e.id}
                    className="glass flex flex-wrap items-center gap-3 rounded-3xl p-4"
                >
                    {e.cover_url && (
                        <img
                            loading="lazy"
                            decoding="async"
                            src={e.cover_url}
                            alt=""
                            className="aspect-[3/1] w-full rounded-2xl object-cover"
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-gc-lilac-200">
                            {eventTime(e.starts_at)}
                        </p>
                        <h3 className="font-semibold text-white">{e.title}</h3>
                        {e.description && (
                            <p className="text-sm text-white/60">
                                {e.description}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-white/45">
                            {tr('Іде:')} {e.going_count}
                            {e.repeat === 'weekly' ? ` · ${tr('Щотижня')}` : ''}
                        </p>
                        {canManage && <BracketForm base={base} event={e} />}
                    </div>
                    <button
                        type="button"
                        onClick={() => post(`${base}/events/${e.id}/rsvp`)}
                        className={e.going ? btn : ghost}
                    >
                        {e.going ? (
                            <>
                                <Check className="size-4" /> {tr('Іду')}
                            </>
                        ) : (
                            tr('Піду')
                        )}
                    </button>
                    <a
                        href={e.ics_url}
                        className={ghost}
                        title={tr('Додати в календар телефона')}
                    >
                        <Download className="size-4" />
                        <span className="sr-only">{tr('У календар')}</span>
                    </a>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() =>
                                confirm(tr('Видалити захід?')) &&
                                router.delete(`${base}/events/${e.id}`, {
                                    preserveScroll: true,
                                })
                            }
                            className="text-white/40 hover:text-rose-300"
                            aria-label={tr('Видалити')}
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
        pending: tr('очікує'),
        approved: '',
        rejected: tr('відхилено'),
    } as const;

    return (
        <>
            <Card
                title={tr('Скарбниця: {num} {currency}', {
                    num: num(clan.treasury ?? 0),
                    currency: clan.currency,
                })}
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
                        placeholder={tr('Сума, {currency}', {
                            currency: clan.currency,
                        })}
                        className={cn(input, 'w-40')}
                    />
                    <input
                        value={give.data.comment}
                        maxLength={200}
                        onChange={(e) =>
                            give.setData('comment', e.target.value)
                        }
                        placeholder={tr('Коментар')}
                        className={cn(input, 'min-w-[160px] flex-1')}
                    />
                    <button
                        type="submit"
                        disabled={give.processing}
                        className={btn}
                    >
                        {tr('Зробити внесок')}
                    </button>
                </form>
                <p className="mt-2 text-xs text-white/45">
                    {tr('Внесок зараховується після підтвердження скарбником.')}
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
                            placeholder={tr('Витрата')}
                            className={cn(input, 'w-40')}
                        />
                        <input
                            value={spend.data.comment}
                            maxLength={200}
                            onChange={(e) =>
                                spend.setData('comment', e.target.value)
                            }
                            placeholder={tr('На що')}
                            className={cn(input, 'min-w-[160px] flex-1')}
                        />
                        <button
                            type="submit"
                            disabled={spend.processing}
                            className={ghost}
                        >
                            {tr('Записати витрату')}
                        </button>
                        {spend.errors.amount && (
                            <p className="w-full text-xs text-rose-300">
                                {spend.errors.amount}
                            </p>
                        )}
                    </form>
                )}
            </Card>
            <Card title={tr('Історія')} icon={Coins}>
                {contributions.length === 0 && (
                    <p className="text-sm text-white/45">
                        {tr('Ще немає операцій.')}
                    </p>
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
                                    aria-label={tr('Підтвердити')}
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
                                    aria-label={tr('Відхилити')}
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
                <Card
                    title={tr('Заявки ({length})', {
                        length: applications.length,
                    })}
                    icon={UserPlus}
                >
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
                                {m.answers && m.answers.length > 0 && (
                                    <span className="block text-xs text-white/45">
                                        {m.answers.join(' · ')}
                                    </span>
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => act(m, 'accept')}
                                className={btn}
                            >
                                {tr('Прийняти')}
                            </button>
                            <button
                                type="button"
                                onClick={() => act(m, 'decline')}
                                className={ghost}
                            >
                                {tr('Відхилити')}
                            </button>
                        </div>
                    ))}
                </Card>
            )}
            <Card
                title={tr('Склад ({length})', { length: members.length })}
                icon={Users}
            >
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
                                    {m.away && ` · ${tr('давно не заходив')}`}
                                </span>
                            </span>
                            {manage && m.away && me && m.id !== me.id && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `${base}/members/${m.id}/nudge`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-300/10 px-3 text-xs font-medium text-amber-100 hover:bg-amber-300/20"
                                >
                                    <BellRing className="size-3.5" />
                                    {tr('Нагадати')}
                                </button>
                            )}
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
                                        aria-label={tr('Ранг')}
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
                                                tr('Виключити {name}?', {
                                                    name: m.user?.name,
                                                }),
                                            ) && act(m, 'kick')
                                        }
                                        className="text-xs text-rose-300 hover:underline"
                                    >
                                        {tr('Виключити')}
                                    </button>
                                </>
                            )}
                            {me?.is_owner && !m.is_owner && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        confirm(
                                            tr('Передати лідерство {name}?', {
                                                name: m.user?.name,
                                            }),
                                        ) && act(m, 'transfer')
                                    }
                                    className="text-xs text-amber-200 hover:underline"
                                >
                                    {tr('Зробити лідером')}
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
        questions: [0, 1, 2].map((index) => settings.questions?.[index] ?? ''),
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
            <Card title={tr('Основне')} icon={Settings}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_160px]">
                    <input
                        value={form.data.name}
                        maxLength={60}
                        onChange={(e) => form.setData('name', e.target.value)}
                        className={input}
                        aria-label={tr('Назва')}
                    />
                    <input
                        value={form.data.tag}
                        maxLength={6}
                        onChange={(e) =>
                            form.setData('tag', e.target.value.toUpperCase())
                        }
                        className={input}
                        aria-label={tr('Тег')}
                    />
                    <input
                        value={form.data.currency}
                        maxLength={24}
                        onChange={(e) =>
                            form.setData('currency', e.target.value)
                        }
                        className={input}
                        aria-label={tr('Валюта внесків')}
                        placeholder={tr('Валюта внесків')}
                    />
                </div>
                <textarea
                    value={form.data.description}
                    rows={3}
                    maxLength={1000}
                    onChange={(e) =>
                        form.setData('description', e.target.value)
                    }
                    placeholder={tr('Опис')}
                    className={cn(area, 'mt-2')}
                />
                <textarea
                    value={form.data.rules}
                    rows={4}
                    maxLength={10000}
                    onChange={(e) => form.setData('rules', e.target.value)}
                    placeholder={tr('Статут (розділ «Статут»)')}
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
                        {tr('Логотип')}
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
                <div className="mt-3 space-y-2">
                    <p className="text-xs text-white/45">
                        {tr('Питання в заявці')}
                    </p>
                    {[0, 1, 2].map((index) => (
                        <input
                            key={index}
                            value={form.data.questions[index] ?? ''}
                            maxLength={80}
                            onChange={(e) => {
                                const next = [...form.data.questions];
                                next[index] = e.target.value;
                                form.setData('questions', next);
                            }}
                            placeholder={tr('Питання {n}', { n: index + 1 })}
                            className={input}
                            aria-label={tr('Питання {n}', { n: index + 1 })}
                        />
                    ))}
                </div>
            </Card>

            <Card title={tr('Розділи клану')} icon={Swords}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

            <Card title={tr('Ранги й права')} icon={Crown}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {form.data.rank_titles.map((t, i) => (
                        <label key={i}>
                            <span className="mb-1 block text-xs text-white/45">
                                {tr('Ранг')} {i + 1}
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
                                        {tr('Право')}
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
                                                            aria-label={tr(
                                                                '{label}: ранг {r}',
                                                                { label, r },
                                                            )}
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
                            {tr('Ранг 5 (лідер) і засновник мають усі права.')}
                        </p>
                    </div>
                )}
            </Card>

            <button
                type="submit"
                disabled={form.processing}
                className={cn(btn, 'w-full')}
            >
                {tr('Зберегти налаштування')}
            </button>

            {logs.length > 0 && (
                <Card title={tr('Журнал дій')} icon={ScrollText}>
                    {logs.map((l) => (
                        <p key={l.id} className="py-1 text-xs text-white/60">
                            <span className="text-white/40">
                                {timeAgo(l.created_at)}
                            </span>{' '}
                            · {l.actor ?? tr('Система')}: {l.text}
                        </p>
                    ))}
                </Card>
            )}
        </form>
    );
}

function BracketForm({
    base,
    event,
}: {
    base: string;
    event: Props['events'][number];
}) {
    const form = useForm({
        teams: event.bracket?.teams ?? ['', '', '', ''],
        semi: event.bracket?.semi ?? [
            [null, null],
            [null, null],
        ],
        final: event.bracket?.final ?? [null, null],
    });
    const field =
        'input-glass h-9 w-full rounded-lg px-2 text-xs text-white placeholder:text-white/30 focus:outline-none';

    return (
        <form
            className="mt-3 grid gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                form.post(`${base}/events/${event.id}/bracket`, {
                    preserveScroll: true,
                });
            }}
        >
            <p className="text-xs text-white/45">{tr('Сітка на 4')}</p>
            <div className="grid grid-cols-2 gap-2">
                {form.data.teams.map((name, index) => (
                    <input
                        key={index}
                        value={name}
                        onChange={(e) => {
                            const teams = [...form.data.teams];
                            teams[index] = e.target.value;
                            form.setData('teams', teams);
                        }}
                        placeholder={tr('Команда {n}', { n: index + 1 })}
                        className={field}
                    />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {form.data.semi.map((pair, index) => (
                    <div key={index} className="flex gap-1">
                        {pair.map((score, side) => (
                            <input
                                key={side}
                                type="number"
                                min={0}
                                max={99}
                                value={score ?? ''}
                                onChange={(e) => {
                                    const semi = form.data.semi.map((row) => [
                                        ...row,
                                    ]) as [number | null, number | null][];
                                    semi[index][side] =
                                        e.target.value === ''
                                            ? null
                                            : Number(e.target.value);
                                    form.setData('semi', semi);
                                }}
                                placeholder={
                                    index === 0
                                        ? tr('Півфінал')
                                        : tr('Півфінал')
                                }
                                className={field}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex gap-1">
                {form.data.final.map((score, side) => (
                    <input
                        key={side}
                        type="number"
                        min={0}
                        max={99}
                        value={score ?? ''}
                        onChange={(e) => {
                            const final = [...form.data.final] as [
                                number | null,
                                number | null,
                            ];
                            final[side] =
                                e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                            form.setData('final', final);
                        }}
                        placeholder={tr('Фінал')}
                        className={field}
                    />
                ))}
            </div>
            <button
                type="submit"
                className="h-9 rounded-lg bg-white/10 text-xs font-semibold text-white"
            >
                {tr('Зберегти сітку')}
            </button>
        </form>
    );
}

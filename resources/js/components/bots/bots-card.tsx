import { router } from '@inertiajs/react';
import {
    Bot,
    Check,
    Loader2,
    Megaphone,
    Send,
    Shield,
    Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Option = { id: string; name: string };
type Flags = {
    post_events: boolean;
    post_reminders: boolean;
    post_posts: boolean;
};

type BotsState = {
    owner: { type: 'family' | 'clan' | 'community'; id: number };
    has_events: boolean;
    telegram: {
        configured: boolean;
        bot: string | null;
        link: ({ id: number; title: string | null } & Flags) | null;
    };
    discord: {
        configured: boolean;
        buttons: boolean;
        link:
            | ({
                  id: number;
                  title: string | null;
                  channel_id: string | null;
                  channels: Option[];
                  roles: Option[];
                  member_role_id: string | null;
                  leader_role_id: string | null;
                  roles_synced_at: string | null;
                  roles_error: string | null;
              } & Flags)
            | null;
        linked: number;
        members: number;
    };
};

/** Логотипи платформ — прості плоскі знаки, без брендових кольорів на фоні. */
function TelegramMark() {
    return <Send className="size-5 text-[#5fb7ec]" />;
}

function DiscordMark() {
    return <Bot className="size-5 text-[#8b9bff]" />;
}

function Toggle({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/[0.06]"
        >
            <span className="min-w-0">{label}</span>
            <span
                className={cn(
                    'relative h-6 w-10 shrink-0 rounded-full transition',
                    checked ? 'bg-gc-indigo' : 'bg-white/15',
                )}
            >
                <span
                    className={cn(
                        'absolute top-1 size-4 rounded-full bg-white transition-all',
                        checked ? 'left-5' : 'left-1',
                    )}
                />
            </span>
        </button>
    );
}

function Preview({ community }: { community: boolean }) {
    const buttons = community
        ? ['📰 Пости', '👥 Склад', '🙋 Я']
        : ['📅 Події', '👥 Склад', '🙋 Я'];

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
            <div className="mb-2 text-[11px] font-medium tracking-wide text-white/35 uppercase">
                {tr('Так виглядає панель бота')}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {buttons.map((label) => (
                    <span
                        key={label}
                        className="rounded-lg bg-white/[0.07] px-2.5 py-1 text-xs text-white/80"
                    >
                        {label}
                    </span>
                ))}
                <span className="rounded-lg bg-white/[0.07] px-2.5 py-1 text-xs text-white/80">
                    🌐 GameCon
                </span>
            </div>
            {!community && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-100">
                        ✅ {tr('Піду')}
                    </span>
                    <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-xs text-rose-100">
                        ❌ {tr('Не піду')}
                    </span>
                    <span className="self-center text-xs text-white/40">
                        {tr('— на картці кожної події')}
                    </span>
                </div>
            )}
        </div>
    );
}

/** Налаштування ботів GameCon для групи: Telegram і Discord, без жодних команд. */
export function BotsCard({
    type,
    id,
}: {
    type: BotsState['owner']['type'];
    id: number;
}) {
    const [state, setState] = useState<BotsState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(
        () =>
            api<BotsState>('GET', `/bots/${type}/${id}`)
                .then(setState)
                .catch((e: Error) => setError(e.message)),
        [type, id],
    );
    useEffect(() => {
        void load();
    }, [load]);

    const act = (
        method: 'post' | 'patch' | 'delete',
        url: string,
        data: Record<string, string | boolean | null> = {},
    ) =>
        router[method](url, data, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => {
                setBusy(false);
                void load();
            },
        });

    if (state === null) {
        return (
            <section className="glass rounded-3xl p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <Megaphone className="size-5 text-gc-lilac-300" />
                    {tr('Боти Telegram і Discord')}
                </h2>
                <p className="mt-3 flex items-center gap-2 text-sm text-white/50">
                    {error ?? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            {tr('Завантажуємо…')}
                        </>
                    )}
                </p>
            </section>
        );
    }

    const community = state.owner.type === 'community';
    const flags = (link: Flags, linkId: number) => (
        <div className="space-y-1.5">
            {state.has_events && (
                <>
                    <Toggle
                        label={tr('Нові події з кнопками «Піду / Не піду»')}
                        checked={link.post_events}
                        onChange={(v) =>
                            act('patch', `/bots/links/${linkId}`, {
                                post_events: v,
                            })
                        }
                    />
                    <Toggle
                        label={tr('Нагадування за 30 хвилин до старту')}
                        checked={link.post_reminders}
                        onChange={(v) =>
                            act('patch', `/bots/links/${linkId}`, {
                                post_reminders: v,
                            })
                        }
                    />
                </>
            )}
            {community && (
                <Toggle
                    label={tr('Нові пости спільноти')}
                    checked={link.post_posts}
                    onChange={(v) =>
                        act('patch', `/bots/links/${linkId}`, { post_posts: v })
                    }
                />
            )}
        </div>
    );
    const footer = (linkId: number) => (
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                disabled={busy}
                onClick={() => act('post', `/bots/links/${linkId}/panel`)}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 text-sm font-medium text-white transition hover:bg-white/[0.12] disabled:opacity-50"
            >
                <Megaphone className="size-4" />
                {tr('Опублікувати панель')}
            </button>
            <button
                type="button"
                disabled={busy}
                onClick={() => {
                    if (window.confirm(tr('Відключити бота від цієї групи?'))) {
                        act('delete', `/bots/links/${linkId}`);
                    }
                }}
                className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-50"
            >
                <Unplug className="size-4" />
                {tr('Відключити')}
            </button>
        </div>
    );

    const tg = state.telegram;
    const dc = state.discord;

    return (
        <section className="glass space-y-4 rounded-3xl p-5">
            <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <Megaphone className="size-5 text-gc-lilac-300" />
                    {tr('Боти Telegram і Discord')}
                </h2>
                <p className="mt-1 text-sm text-white/55">
                    {tr(
                        'Додайте бота GameCon у свою групу — він публікуватиме картки з кнопками. Жодних команд: усе натисканням.',
                    )}
                </p>
            </div>
            <Preview community={community} />

            <div className="grid gap-3 lg:grid-cols-2">
                <div className="min-w-0 space-y-3 rounded-2xl bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 font-semibold text-white">
                        <TelegramMark /> Telegram
                    </div>
                    {!tg.configured ? (
                        <p className="text-sm text-white/45">
                            {tr(
                                'Бот Telegram ще не налаштований адміністрацією сайту.',
                            )}
                        </p>
                    ) : tg.link === null ? (
                        <>
                            <p className="text-sm text-white/55">
                                {tr(
                                    'Натисніть кнопку, оберіть групу — бот приєднається й сам опублікує панель.',
                                )}
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    act('post', `/bots/${type}/${id}/telegram`)
                                }
                                className="btn-glow inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                <Send className="size-4" />
                                {tr('Додати в Telegram-групу')}
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="flex items-center gap-2 text-sm text-emerald-200">
                                <Check className="size-4 shrink-0" />
                                <span className="truncate">
                                    {tr('Підключено: {title}', {
                                        title: tg.link.title ?? '',
                                    })}
                                </span>
                            </p>
                            {flags(tg.link, tg.link.id)}
                            {footer(tg.link.id)}
                        </>
                    )}
                </div>

                <div className="min-w-0 space-y-3 rounded-2xl bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 font-semibold text-white">
                        <DiscordMark /> Discord
                    </div>
                    {!dc.configured ? (
                        <p className="text-sm text-white/45">
                            {tr(
                                'Бот Discord ще не налаштований адміністрацією сайту.',
                            )}
                        </p>
                    ) : dc.link === null ? (
                        <>
                            <p className="text-sm text-white/55">
                                {tr(
                                    'Додайте бота на свій сервер Discord, потім оберіть канал для публікацій.',
                                )}
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    act('post', `/bots/${type}/${id}/discord`)
                                }
                                className="btn-glow inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                            >
                                <Bot className="size-4" />
                                {tr('Додати на сервер Discord')}
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="flex items-center gap-2 text-sm text-emerald-200">
                                <Check className="size-4 shrink-0" />
                                <span className="truncate">
                                    {tr('Сервер: {title}', {
                                        title: dc.link.title ?? '',
                                    })}
                                </span>
                            </p>
                            {!dc.buttons && (
                                <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                                    {tr(
                                        'Кнопки запрацюють, щойно адміністрація збереже Public Key бота.',
                                    )}
                                </p>
                            )}
                            <label className="block space-y-1.5">
                                <span className="text-xs text-white/50">
                                    {tr('Канал для публікацій')}
                                </span>
                                <select
                                    value={dc.link.channel_id ?? ''}
                                    disabled={busy}
                                    onChange={(e) =>
                                        act(
                                            'patch',
                                            `/bots/links/${dc.link!.id}`,
                                            {
                                                channel_id:
                                                    e.target.value || null,
                                            },
                                        )
                                    }
                                    className={cn(
                                        selectClass,
                                        'h-10 w-full min-w-0',
                                    )}
                                >
                                    <option value="">
                                        {tr('Оберіть канал')}
                                    </option>
                                    {dc.link.channels.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {dc.link.channel_id && flags(dc.link, dc.link.id)}

                            <div className="space-y-2 rounded-xl border border-white/[0.06] p-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-white">
                                    <Shield className="size-4 text-gc-lilac-300" />
                                    {tr('Ролі за складом')}
                                </div>
                                <p className="text-xs text-white/45">
                                    {tr(
                                        'Discord прив’язали {linked} із {members} учасників.',
                                        {
                                            linked: dc.linked,
                                            members: dc.members,
                                        },
                                    )}
                                </p>
                                {(
                                    [
                                        [
                                            'member_role_id',
                                            tr('Роль для всіх учасників'),
                                        ],
                                        [
                                            'leader_role_id',
                                            tr('Роль для керівників'),
                                        ],
                                    ] as const
                                ).map(([field, label]) => (
                                    <label
                                        key={field}
                                        className="block space-y-1"
                                    >
                                        <span className="text-xs text-white/50">
                                            {label}
                                        </span>
                                        <select
                                            value={dc.link![field] ?? ''}
                                            disabled={busy}
                                            onChange={(e) =>
                                                act(
                                                    'patch',
                                                    `/bots/links/${dc.link!.id}`,
                                                    {
                                                        [field]:
                                                            e.target.value ||
                                                            null,
                                                    },
                                                )
                                            }
                                            className={cn(
                                                selectClass,
                                                'h-10 w-full min-w-0',
                                            )}
                                        >
                                            <option value="">
                                                {tr('Не видавати')}
                                            </option>
                                            {dc.link!.roles.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    @{r.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                                {dc.link.roles_error && (
                                    <p className="text-xs text-rose-300">
                                        {dc.link.roles_error}
                                    </p>
                                )}
                                {(dc.link.member_role_id ||
                                    dc.link.leader_role_id) && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                act(
                                                    'post',
                                                    `/bots/links/${dc.link!.id}/roles`,
                                                )
                                            }
                                            className="h-8 rounded-lg bg-white/[0.08] px-3 text-xs font-medium text-white hover:bg-white/[0.12] disabled:opacity-50"
                                        >
                                            {tr('Синхронізувати зараз')}
                                        </button>
                                        {dc.link.roles_synced_at && (
                                            <span className="text-xs text-white/40">
                                                {tr(
                                                    'Оновлено {date} · далі щогодини',
                                                    {
                                                        date: formatDate(
                                                            dc.link
                                                                .roles_synced_at,
                                                            false,
                                                        ),
                                                    },
                                                )}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {dc.link.channel_id ? (
                                footer(dc.link.id)
                            ) : (
                                <button
                                    type="button"
                                    onClick={() =>
                                        act(
                                            'delete',
                                            `/bots/links/${dc.link!.id}`,
                                        )
                                    }
                                    className="text-sm text-rose-200 hover:text-rose-100"
                                >
                                    {tr('Відключити')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

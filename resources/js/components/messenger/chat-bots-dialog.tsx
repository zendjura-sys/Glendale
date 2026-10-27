import { Bot, CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Toggle } from '@/components/gc/admin';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Repeat = 'once' | 'daily' | 'weekly';

type Automation = {
    id: number;
    kind: 'welcome' | 'post' | 'ai';
    bot_name: string;
    body: string;
    enabled: boolean;
    repeat: Repeat | null;
    time: string | null;
    weekdays: number[] | null;
    next_run_at: string | null;
    last_run_at: string | null;
};

type Overview = {
    ai?: Automation | null;
    welcome: Automation | null;
    posts: Automation[];
    welcome_on?: boolean;
    posts_on?: boolean;
    ai_on?: boolean;
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/35 focus:outline-none';

function two(n: number) {
    return String(n).padStart(2, '0');
}

/** Дата за Києвом для рядка «наступний запуск». */
function when(iso: string | null) {
    if (!iso) return '—';
    const d = new Date(iso);

    return `${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/**
 * Боти бесіди: «Привітання» новеньких і «Автопости» за розкладом.
 * Пишуть від імені бота з позначкою «бот»; налаштовують адміністратори.
 */
export function ChatBotsDialog({
    conversationId,
    open,
    onOpenChange,
}: {
    conversationId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [data, setData] = useState<Overview | null>(null);
    const [tab, setTab] = useState<'welcome' | 'posts' | 'ai'>('welcome');
    const [busy, setBusy] = useState(false);
    const [welcome, setWelcome] = useState({
        enabled: true,
        bot_name: 'Бот',
        body: 'Вітаємо, {name}! Розкажіть, у що граєте 🎮',
    });
    const [ai, setAi] = useState({
        enabled: true,
        bot_name: 'ШІ',
        body: '',
    });
    const [post, setPost] = useState({
        body: '',
        bot_name: 'Бот',
        repeat: 'daily' as Repeat,
        at: '',
        time: '20:00',
        weekdays: [5] as number[],
    });
    const days = [
        tr('Пн'),
        tr('Вт'),
        tr('Ср'),
        tr('Чт'),
        tr('Пт'),
        tr('Сб'),
        tr('Нд'),
    ];

    const apply = (overview: Overview) => {
        setData((current) => ({ ...current, ...overview }));
        if (overview.welcome) {
            setWelcome({
                enabled: overview.welcome.enabled,
                bot_name: overview.welcome.bot_name,
                body: overview.welcome.body,
            });
        }
        if (overview.ai) {
            setAi({
                enabled: overview.ai.enabled,
                bot_name: overview.ai.bot_name,
                body: overview.ai.body,
            });
        }
    };
    const load = useCallback(() => {
        void api<Overview>('GET', `/messages/${conversationId}/bots`).then(
            (overview) => {
                apply(overview);
                if (overview.welcome_on === false)
                    setTab(overview.posts_on === false ? 'ai' : 'posts');
            },
        );
    }, [conversationId]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    const run = (
        method: 'PUT' | 'POST' | 'PATCH' | 'DELETE',
        url: string,
        body?: Record<string, unknown>,
        ok?: string,
    ) => {
        setBusy(true);
        void api<Overview>(method, url, body)
            .then((overview) => {
                apply(overview);
                if (ok) toast.success(ok);
            })
            .catch((error: unknown) =>
                toast.error(
                    error instanceof ApiError
                        ? error.message
                        : tr('Не вдалося зберегти.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    const schedule = (a: Automation) =>
        a.repeat === 'once'
            ? tr('Один раз')
            : a.repeat === 'daily'
              ? tr('Щодня о {time}', { time: a.time ?? '' })
              : `${(a.weekdays ?? []).map((d) => days[d - 1]).join(', ')} · ${a.time ?? ''}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-xl">
                <div>
                    <DialogTitle className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                        <Bot className="size-5 text-gc-lilac-300" />
                        {tr('Боти бесіди')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr(
                            'Пишуть від імені бота з позначкою «бот». Час — за Києвом.',
                        )}
                    </DialogDescription>
                </div>

                {data === null ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="size-6 animate-spin text-white/45" />
                    </div>
                ) : (
                    <>
                        <div className="flex rounded-xl bg-white/[0.04] p-1">
                            {(
                                [
                                    [
                                        'welcome',
                                        tr('Привітання'),
                                        data.welcome_on !== false,
                                    ],
                                    [
                                        'posts',
                                        tr('Автопости'),
                                        data.posts_on !== false,
                                    ],
                                    ['ai', tr('ШІ-бот'), data.ai_on === true],
                                ] as const
                            )
                                .filter(([, , on]) => on)
                                .map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setTab(value)}
                                        className={cn(
                                            'h-9 flex-1 rounded-lg text-sm font-medium transition',
                                            tab === value
                                                ? 'bg-white/10 text-white'
                                                : 'text-white/50 hover:text-white',
                                        )}
                                    >
                                        {label}
                                        {value === 'posts' &&
                                            data.posts.length > 0 && (
                                                <span className="ml-1.5 text-[11px] text-white/45">
                                                    {data.posts.length}
                                                </span>
                                            )}
                                    </button>
                                ))}
                        </div>

                        {tab === 'welcome' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-white/70">
                                        {tr('Вітати кожного, хто приєднався')}
                                    </p>
                                    <Toggle
                                        checked={welcome.enabled}
                                        onChange={(enabled) =>
                                            setWelcome({ ...welcome, enabled })
                                        }
                                        label={tr('Привітання')}
                                    />
                                </div>
                                <input
                                    value={welcome.bot_name}
                                    maxLength={40}
                                    onChange={(e) =>
                                        setWelcome({
                                            ...welcome,
                                            bot_name: e.target.value,
                                        })
                                    }
                                    placeholder={tr('Ім’я бота')}
                                    className={cn(field, 'h-11')}
                                />
                                <textarea
                                    value={welcome.body}
                                    maxLength={1000}
                                    rows={4}
                                    onChange={(e) =>
                                        setWelcome({
                                            ...welcome,
                                            body: e.target.value,
                                        })
                                    }
                                    className={cn(field, 'resize-none py-2.5')}
                                />
                                <p className="text-xs text-white/45">
                                    {tr(
                                        '{name} — ім’я новенького, {chat} — назва бесіди.',
                                    )}
                                </p>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        disabled={
                                            busy || welcome.body.trim() === ''
                                        }
                                        onClick={() =>
                                            run(
                                                'PUT',
                                                `/messages/${conversationId}/bots/welcome`,
                                                welcome,
                                                tr('Привітання збережено.'),
                                            )
                                        }
                                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                                    >
                                        {tr('Зберегти')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {tab === 'ai' && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-white/70">
                                        {tr('Відповідає, коли його кличуть')}
                                    </p>
                                    <Toggle
                                        checked={ai.enabled}
                                        onChange={(enabled) =>
                                            setAi({ ...ai, enabled })
                                        }
                                        label={tr('ШІ-бот')}
                                    />
                                </div>
                                <input
                                    value={ai.bot_name}
                                    maxLength={40}
                                    onChange={(e) =>
                                        setAi({
                                            ...ai,
                                            bot_name: e.target.value,
                                        })
                                    }
                                    placeholder={tr('Ім’я бота')}
                                    className={cn(field, 'h-11')}
                                />
                                <textarea
                                    value={ai.body}
                                    maxLength={1000}
                                    rows={4}
                                    onChange={(e) =>
                                        setAi({ ...ai, body: e.target.value })
                                    }
                                    placeholder={tr(
                                        'Характер і правила: «Ти — тренер з CS2, відповідай коротко й з гумором»',
                                    )}
                                    className={cn(field, 'resize-none py-2.5')}
                                />
                                <p className="text-xs text-white/45">
                                    {tr(
                                        'Згадайте @{name} або почніть повідомлення з /ші. Бот бачить останні повідомлення бесіди.',
                                        { name: ai.bot_name || 'ШІ' },
                                    )}
                                </p>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        disabled={
                                            busy || ai.bot_name.trim() === ''
                                        }
                                        onClick={() =>
                                            run(
                                                'PUT',
                                                `/messages/${conversationId}/bots/ai`,
                                                ai,
                                                tr('ШІ-бота збережено.'),
                                            )
                                        }
                                        className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                                    >
                                        {tr('Зберегти')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {tab === 'posts' && (
                            <div className="space-y-4">
                                {data.posts.length > 0 && (
                                    <ul className="space-y-2">
                                        {data.posts.map((item) => (
                                            <li
                                                key={item.id}
                                                className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3"
                                            >
                                                <CalendarClock className="mt-0.5 size-4 shrink-0 text-white/45" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-sm whitespace-pre-line text-white/85">
                                                        {item.body}
                                                    </p>
                                                    <p className="mt-1 text-xs text-white/45">
                                                        {schedule(item)} ·{' '}
                                                        {item.enabled
                                                            ? tr(
                                                                  'далі {when}',
                                                                  {
                                                                      when: when(
                                                                          item.next_run_at,
                                                                      ),
                                                                  },
                                                              )
                                                            : item.last_run_at
                                                              ? tr(
                                                                    'надіслано {when}',
                                                                    {
                                                                        when: when(
                                                                            item.last_run_at,
                                                                        ),
                                                                    },
                                                                )
                                                              : tr('вимкнено')}
                                                    </p>
                                                </div>
                                                <Toggle
                                                    checked={item.enabled}
                                                    disabled={
                                                        busy ||
                                                        (item.repeat ===
                                                            'once' &&
                                                            !item.enabled)
                                                    }
                                                    onChange={(enabled) =>
                                                        run(
                                                            'PATCH',
                                                            `/messages/${conversationId}/bots/posts/${item.id}`,
                                                            { enabled },
                                                        )
                                                    }
                                                    label={tr('Увімкнено')}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(
                                                            'DELETE',
                                                            `/messages/${conversationId}/bots/posts/${item.id}`,
                                                        )
                                                    }
                                                    aria-label={tr('Видалити')}
                                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-rose-500/10 hover:text-rose-300"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
                                    <p className="text-sm font-medium text-white">
                                        {tr('Новий автопост')}
                                    </p>
                                    <textarea
                                        value={post.body}
                                        maxLength={1000}
                                        rows={3}
                                        onChange={(e) =>
                                            setPost({
                                                ...post,
                                                body: e.target.value,
                                            })
                                        }
                                        placeholder={tr(
                                            'Наприклад: «Рейд сьогодні о 21:00, збір у голосовому»',
                                        )}
                                        className={cn(
                                            field,
                                            'resize-none py-2.5',
                                        )}
                                    />
                                    <div className="flex rounded-xl bg-white/[0.04] p-1">
                                        {(
                                            [
                                                ['once', tr('Один раз')],
                                                ['daily', tr('Щодня')],
                                                ['weekly', tr('По днях')],
                                            ] as const
                                        ).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() =>
                                                    setPost({
                                                        ...post,
                                                        repeat: value,
                                                    })
                                                }
                                                className={cn(
                                                    'h-8 flex-1 rounded-lg text-[13px] font-medium transition',
                                                    post.repeat === value
                                                        ? 'bg-white/10 text-white'
                                                        : 'text-white/50 hover:text-white',
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {post.repeat === 'once' ? (
                                        <input
                                            type="datetime-local"
                                            value={post.at}
                                            onChange={(e) =>
                                                setPost({
                                                    ...post,
                                                    at: e.target.value,
                                                })
                                            }
                                            className={cn(field, 'h-11')}
                                        />
                                    ) : (
                                        <input
                                            type="time"
                                            value={post.time}
                                            onChange={(e) =>
                                                setPost({
                                                    ...post,
                                                    time: e.target.value,
                                                })
                                            }
                                            className={cn(field, 'h-11')}
                                        />
                                    )}
                                    {post.repeat === 'weekly' && (
                                        <div className="grid grid-cols-7 gap-1">
                                            {days.map((label, index) => {
                                                const day = index + 1;
                                                const on =
                                                    post.weekdays.includes(day);

                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() =>
                                                            setPost({
                                                                ...post,
                                                                weekdays: on
                                                                    ? post.weekdays.filter(
                                                                          (d) =>
                                                                              d !==
                                                                              day,
                                                                      )
                                                                    : [
                                                                          ...post.weekdays,
                                                                          day,
                                                                      ],
                                                            })
                                                        }
                                                        className={cn(
                                                            'h-9 rounded-lg text-xs font-semibold transition',
                                                            on
                                                                ? 'bg-primary text-white'
                                                                : 'bg-white/[0.05] text-white/55 hover:text-white',
                                                        )}
                                                    >
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            disabled={
                                                busy ||
                                                post.body.trim() === '' ||
                                                (post.repeat === 'once' &&
                                                    post.at === '')
                                            }
                                            onClick={() =>
                                                run(
                                                    'POST',
                                                    `/messages/${conversationId}/bots/posts`,
                                                    post,
                                                    tr('Автопост додано.'),
                                                )
                                            }
                                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                                        >
                                            <Plus className="size-4" />
                                            {tr('Додати')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

import { Head, router, useForm } from '@inertiajs/react';
import {
    CircleCheck,
    CircleX,
    Download,
    LogOut,
    Monitor,
    Smartphone,
    Snowflake,
} from 'lucide-react';
import { SettingsCard } from '@/layouts/settings/layout';
import { formatDate, timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { WebPushSettings } from '@/components/gc/web-push-toggle';
import { cn } from '@/lib/utils';

type Props = {
    sessions: {
        id: number;
        device: string;
        ip: string | null;
        last_active_at: string;
        current: boolean;
    }[];
    tokens: { id: number; name: string; last_used_at: string | null }[];
    logins: {
        id: number;
        method: string;
        success: boolean;
        device: string;
        ip: string | null;
        at: string;
    }[];
    appeals: {
        id: number;
        kind: string;
        body: string;
        status: 'pending' | 'accepted' | 'rejected';
        reply: string | null;
        created_at: string;
    }[];
    appealKinds: Record<string, string>;
    mute: { until: string | null; reason: string | null } | null;
    hideProfanity: boolean;
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

const row =
    'flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-3 text-sm';

function methodLabel(method: string): string {
    const labels: Record<string, string> = {
        password: tr('Пароль'),
        google: 'Google',
        discord: 'Discord',
        passkey: tr('Ключ доступу'),
        '2fa': tr('Код 2FA'),
        app: tr('Застосунок'),
        register: tr('Реєстрація'),
    };

    return labels[method] ?? method;
}

function statusLabel(status: Props['appeals'][number]['status']): string {
    if (status === 'accepted') return tr('Прийнято');
    if (status === 'rejected') return tr('Відхилено');

    return tr('На розгляді');
}

export default function Account({
    sessions,
    tokens,
    logins,
    appeals,
    appealKinds,
    mute,
    hideProfanity,
}: Props) {
    const appeal = useForm({
        kind: mute ? 'mute' : 'content',
        body: '',
    });
    const freeze = useForm({ password: '' });
    const options = { preserveScroll: true };
    const others = sessions.filter((s) => !s.current).length + tokens.length;

    return (
        <>
            <Head title={tr('Акаунт')} />
            <div className="space-y-5">
                <SettingsCard
                    title={tr('Сповіщення в браузері')}
                    description={tr('Push-сповіщення сайту на цьому пристрої.')}
                >
                    <WebPushSettings />
                </SettingsCard>
                <SettingsCard
                    title={tr('Пристрої і сесії')}
                    description={tr(
                        'Де ви зараз увійшли. Завершіть сесію, якщо не впізнаєте пристрій.',
                    )}
                >
                    <ul className="space-y-2">
                        {sessions.map((session) => (
                            <li key={session.id} className={row}>
                                <Monitor className="size-5 shrink-0 text-white/50" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-white">
                                        {session.device}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        {session.ip ?? '—'} ·{' '}
                                        {session.current
                                            ? tr('цей пристрій')
                                            : timeAgo(session.last_active_at)}
                                    </span>
                                </span>
                                {session.current ? (
                                    <span className="rounded-full bg-gc-mint/15 px-2 py-0.5 text-xs font-medium text-gc-mint">
                                        {tr('Зараз')}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.delete(
                                                `/settings/account/sessions/${session.id}`,
                                                options,
                                            )
                                        }
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                                    >
                                        <LogOut className="size-4" />
                                        {tr('Завершити')}
                                    </button>
                                )}
                            </li>
                        ))}
                        {tokens.map((token) => (
                            <li key={`t${token.id}`} className={row}>
                                <Smartphone className="size-5 shrink-0 text-white/50" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-white">
                                        {tr('Застосунок GameCon')} ·{' '}
                                        {token.name}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        {token.last_used_at
                                            ? timeAgo(token.last_used_at)
                                            : '—'}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.delete(
                                            `/settings/account/tokens/${token.id}`,
                                            options,
                                        )
                                    }
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                                >
                                    <LogOut className="size-4" />
                                    {tr('Вийти')}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {others > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                router.delete(
                                    '/settings/account/sessions',
                                    options,
                                )
                            }
                            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                        >
                            <LogOut className="size-4" />
                            {tr('Завершити всі інші сесії')}
                        </button>
                    )}
                </SettingsCard>

                <SettingsCard
                    title={tr('Журнал входів')}
                    description={tr('Останні спроби увійти в акаунт')}
                >
                    {logins.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('Поки що порожньо.')}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {logins.map((login) => (
                                <li key={login.id} className={row}>
                                    {login.success ? (
                                        <CircleCheck className="size-5 shrink-0 text-gc-mint" />
                                    ) : (
                                        <CircleX className="size-5 shrink-0 text-gc-coral" />
                                    )}
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-white">
                                            {methodLabel(login.method)} ·{' '}
                                            {login.device}
                                        </span>
                                        <span className="block truncate text-xs text-white/45">
                                            {login.ip ?? '—'} ·{' '}
                                            {timeAgo(login.at)}
                                            {!login.success &&
                                                ` · ${tr('невдала спроба')}`}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </SettingsCard>

                <SettingsCard
                    title={tr('Образливі слова')}
                    description={tr(
                        'Ховати мат зірочками в записах, коментарях і чатах — лише для вас',
                    )}
                >
                    <label className="flex items-center gap-3 text-sm text-white/80">
                        <input
                            type="checkbox"
                            checked={hideProfanity}
                            onChange={(event) =>
                                router.put(
                                    '/settings/account/profanity',
                                    { hide: event.target.checked },
                                    options,
                                )
                            }
                            className="size-4 accent-gc-indigo"
                        />
                        {tr('Приховувати образливі слова')}
                    </label>
                </SettingsCard>

                <SettingsCard
                    title={tr('Оскарження рішення модерації')}
                    description={tr(
                        'Якщо вам обмежили можливість писати або видалили вміст помилково',
                    )}
                >
                    {mute && (
                        <p className="mb-4 rounded-2xl bg-gc-amber/10 px-3.5 py-3 text-sm text-gc-amber">
                            {tr('Вам заборонено писати до {date}.', {
                                date: mute.until ? formatDate(mute.until) : '—',
                            })}
                            {mute.reason && ` ${mute.reason}`}
                        </p>
                    )}
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            appeal.post('/settings/account/appeals', {
                                ...options,
                                onSuccess: () => appeal.reset('body'),
                            });
                        }}
                        className="grid gap-3"
                    >
                        <select
                            value={appeal.data.kind}
                            onChange={(event) =>
                                appeal.setData('kind', event.target.value)
                            }
                            aria-label={tr('Що оскаржуєте')}
                            className={cn(field, 'h-11')}
                        >
                            {Object.entries(appealKinds)
                                .filter(([key]) => key !== 'ban')
                                .map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {tr(label)}
                                    </option>
                                ))}
                        </select>
                        <textarea
                            value={appeal.data.body}
                            onChange={(event) =>
                                appeal.setData('body', event.target.value)
                            }
                            rows={4}
                            maxLength={2000}
                            placeholder={tr(
                                'Що сталося і чому рішення варто переглянути',
                            )}
                            className={cn(field, 'py-2.5')}
                        />
                        {appeal.errors.body && (
                            <p className="text-xs text-rose-300">
                                {appeal.errors.body}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={
                                    appeal.processing ||
                                    appeal.data.body.trim().length < 10
                                }
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Надіслати')}
                            </button>
                        </div>
                    </form>
                    {appeals.length > 0 && (
                        <ul className="mt-4 space-y-2">
                            {appeals.map((item) => (
                                <li
                                    key={item.id}
                                    className="rounded-2xl bg-white/[0.03] px-3.5 py-3 text-sm"
                                >
                                    <p className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                                        <span>
                                            {tr(appealKinds[item.kind] ?? '')}
                                        </span>
                                        <span>·</span>
                                        <span>{timeAgo(item.created_at)}</span>
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 font-medium',
                                                item.status === 'accepted' &&
                                                    'bg-gc-mint/15 text-gc-mint',
                                                item.status === 'rejected' &&
                                                    'bg-gc-coral/15 text-gc-coral',
                                                item.status === 'pending' &&
                                                    'bg-white/[0.06] text-white/70',
                                            )}
                                        >
                                            {statusLabel(item.status)}
                                        </span>
                                    </p>
                                    <p className="mt-1 whitespace-pre-line text-white/80">
                                        {item.body}
                                    </p>
                                    {item.reply && (
                                        <p className="mt-2 border-l-2 border-gc-indigo/60 pl-3 text-white/70">
                                            {item.reply}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </SettingsCard>

                <SettingsCard
                    title={tr('Мої дані')}
                    description={tr(
                        'Профіль, друзі, записи, коментарі, фото й повідомлення одним файлом JSON',
                    )}
                >
                    <a
                        href="/settings/account/export"
                        download
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                        <Download className="size-4" />
                        {tr('Завантажити свої дані')}
                    </a>
                </SettingsCard>

                <SettingsCard
                    title={tr('Заморозити акаунт')}
                    description={tr(
                        'Сторінку ніхто не бачить, усі сесії закриваються. Дані лишаються — щоб повернутися, просто увійдіть.',
                    )}
                >
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (
                                window.confirm(
                                    tr(
                                        'Заморозити акаунт? Ви вийдете на всіх пристроях.',
                                    ),
                                )
                            ) {
                                freeze.post('/settings/account/freeze');
                            }
                        }}
                        className="flex flex-col gap-3 sm:flex-row"
                    >
                        <input
                            type="password"
                            value={freeze.data.password}
                            onChange={(event) =>
                                freeze.setData('password', event.target.value)
                            }
                            autoComplete="current-password"
                            placeholder={tr('Пароль для підтвердження')}
                            className={cn(field, 'h-11 sm:flex-1')}
                        />
                        <button
                            type="submit"
                            disabled={
                                freeze.processing || freeze.data.password === ''
                            }
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-40"
                        >
                            <Snowflake className="size-4" />
                            {tr('Заморозити')}
                        </button>
                    </form>
                    {freeze.errors.password && (
                        <p className="mt-1 text-xs text-rose-300">
                            {freeze.errors.password}
                        </p>
                    )}
                </SettingsCard>
            </div>
        </>
    );
}

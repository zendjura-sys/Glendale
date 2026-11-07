import { Link, router, useForm } from '@inertiajs/react';
import { BadgeCheck, Check, Copy, KeyRound, LogIn, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type ServerApp = {
    id: number;
    name: string;
    client_id: string;
    redirect_uris: string[];
    users: number;
    secret: string | null;
};

export type VerifiedInfo = {
    players: number;
    online: number;
    me: { nickname: string | null } | null;
};

/** Що отримає сервер — так само, як ServerOAuth::SCOPES. */
export const SCOPE_LABELS = (): Record<string, string> => ({
    profile: tr('Ім’я, нік і аватар'),
    characters: tr('Ваші персонажі на цьому сервері'),
    family: tr('Сім’я на цьому сервері й ранг'),
});

const fieldClass =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

function CopyValue({
    value,
    secret = false,
}: {
    value: string;
    secret?: boolean;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <code
                className={cn(
                    'min-w-0 flex-1 truncate font-mono text-xs',
                    secret ? 'text-amber-100' : 'text-white/80',
                )}
            >
                {value}
            </code>
            <button
                type="button"
                aria-label={tr('Копіювати')}
                onClick={() => {
                    void navigator.clipboard?.writeText(value);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                }}
                className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
            >
                {copied ? (
                    <Check className="size-4 text-emerald-300" />
                ) : (
                    <Copy className="size-4" />
                )}
            </button>
        </div>
    );
}

function AppCard({ slug, app }: { slug: string; app: ServerApp }) {
    const [uris, setUris] = useState(app.redirect_uris.join('\n'));
    const base = `/servers/${slug}/apps/${app.id}`;

    return (
        <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                        {app.name}
                    </div>
                    <div className="text-xs text-white/45">
                        {tr('Входили: {count}', { count: app.users })}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (
                            window.confirm(
                                tr(
                                    'Вимкнути застосунок? Усі входи через нього буде скасовано.',
                                ),
                            )
                        ) {
                            router.delete(base, { preserveScroll: true });
                        }
                    }}
                    aria-label={tr('Вимкнути застосунок')}
                    className="shrink-0 rounded-lg p-2 text-rose-200/80 transition hover:bg-rose-400/10"
                >
                    <Trash2 className="size-4" />
                </button>
            </div>
            <div className="space-y-1.5">
                <div className="text-xs text-white/50">client_id</div>
                <CopyValue value={app.client_id} />
            </div>
            {app.secret ? (
                <div className="space-y-1.5">
                    <div className="text-xs text-amber-200">
                        {tr(
                            'client_secret — збережіть зараз, більше його не покажемо',
                        )}
                    </div>
                    <CopyValue value={app.secret} secret />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        if (
                            window.confirm(
                                tr(
                                    'Створити новий секрет? Старий одразу перестане працювати.',
                                ),
                            )
                        ) {
                            router.post(
                                `${base}/secret`,
                                {},
                                { preserveScroll: true },
                            );
                        }
                    }}
                    className="inline-flex items-center gap-2 text-xs font-medium text-white/55 hover:text-white"
                >
                    <KeyRound className="size-3.5" />
                    {tr('Новий client_secret')}
                </button>
            )}
            <label className="block space-y-1.5">
                <span className="text-xs text-white/50">
                    {tr('Адреси повернення, по одній у рядку')}
                </span>
                <textarea
                    value={uris}
                    onChange={(e) => setUris(e.target.value)}
                    rows={2}
                    className={cn(fieldClass, 'font-mono text-xs')}
                />
            </label>
            {uris !== app.redirect_uris.join('\n') && (
                <button
                    type="button"
                    onClick={() =>
                        router.patch(
                            base,
                            { redirect_uris: uris },
                            { preserveScroll: true },
                        )
                    }
                    className="h-9 rounded-xl bg-white/[0.08] px-4 text-sm font-medium text-white hover:bg-white/[0.12]"
                >
                    {tr('Зберегти адреси')}
                </button>
            )}
        </div>
    );
}

/** Власнику: застосунки «Увійти через GameCon» і синхронізація онлайну. */
export function ServerApps({
    slug,
    apps,
}: {
    slug: string;
    apps: ServerApp[];
}) {
    const form = useForm({ name: '', redirect_uris: '' });

    return (
        <section className="glass space-y-4 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                    <LogIn className="size-5 text-gc-lilac-300" />
                    {tr('Увійти через GameCon')}
                </h2>
                <Link
                    href="/developers"
                    className="text-sm font-medium text-gc-lilac-300 hover:text-white"
                >
                    {tr('Документація')}
                </Link>
            </div>
            <p className="text-sm text-white/55">
                {tr(
                    'Кнопка входу для сайту чи лаунчера проєкту: гравці входять акаунтом GameCon, сервер бачить їхніх персонажів і сім’ю й передає онлайн. Вхід підтверджує гравця.',
                )}
            </p>
            {apps.map((app) => (
                <AppCard key={app.id} slug={slug} app={app} />
            ))}
            {apps.length < 3 && (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(`/servers/${slug}/apps`, {
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                    className="space-y-2 rounded-2xl bg-white/[0.03] p-4"
                >
                    <input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        maxLength={80}
                        placeholder={tr('Назва, наприклад «Сайт проєкту»')}
                        className={fieldClass}
                    />
                    <textarea
                        value={form.data.redirect_uris}
                        onChange={(e) =>
                            form.setData('redirect_uris', e.target.value)
                        }
                        rows={2}
                        placeholder="https://example.com/auth/gamecon/callback"
                        className={cn(fieldClass, 'font-mono text-xs')}
                    />
                    {(form.errors.name || form.errors.redirect_uris) && (
                        <p className="text-xs text-rose-300">
                            {form.errors.name ?? form.errors.redirect_uris}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={
                            form.processing ||
                            !form.data.name.trim() ||
                            !form.data.redirect_uris.trim()
                        }
                        className="btn-glow h-10 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                    >
                        {tr('Створити застосунок')}
                    </button>
                </form>
            )}
        </section>
    );
}

/** Скільки гравців сервер підтвердив і чи підтверджено вас. */
export function VerifiedPlayers({ verified }: { verified: VerifiedInfo }) {
    if (verified.players === 0 && !verified.me) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            {verified.me && (
                <span className="inline-flex items-center gap-1.5 rounded-chip bg-emerald-400/10 px-3 py-1 text-emerald-200">
                    <BadgeCheck className="size-4" />
                    {verified.me.nickname
                        ? tr('Ви підтверджений гравець · {nick}', {
                              nick: verified.me.nickname,
                          })
                        : tr('Ви підтверджений гравець')}
                </span>
            )}
            <span className="rounded-chip bg-white/[0.05] px-3 py-1 text-white/60">
                {tr('Підтверджених гравців: {count}', {
                    count: verified.players,
                })}
                {verified.online > 0 &&
                    ` · ${tr('у грі: {count}', { count: verified.online })}`}
            </span>
        </div>
    );
}

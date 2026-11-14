import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    AppWindow,
    Bot,
    Check,
    Copy,
    KeyRound,
    Layers,
    Plus,
    RotateCw,
    ShieldCheck,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    OverlayEditor,
    type OverlayConfig,
} from '@/components/developers/overlay-editor';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type DevApp = {
    id: number;
    name: string;
    description: string | null;
    website: string | null;
    client_id: string;
    public_key: string;
    has_secret: boolean;
    has_bot: boolean;
    bot_token_at: string | null;
    confidential: boolean;
    redirect_uris: string[];
    scopes: string[];
    blocked: boolean;
    blocked_reason: string | null;
    users: number;
    overlay: OverlayConfig;
};

type Props = {
    apps: DevApp[];
    scopes: { key: string; label: string }[];
    base: string;
    limits: { user: number; app: number; apps: number };
    reveal: {
        app: number;
        client_secret?: string;
        bot_token?: string;
        access_token?: string;
        refresh_token?: string;
    } | null;
};

const TABS = [
    ['apps', 'Мої застосунки'],
    ['oauth', 'OAuth 2.1'],
    ['api', 'API'],
    ['bots', 'Боти й ключі'],
] as const;

function copy(value: string) {
    void navigator.clipboard?.writeText(value);
    toast.success(tr('Скопійовано.'));
}

function KeyLine({
    label,
    value,
    secret = false,
}: {
    label: string;
    value: string;
    secret?: boolean;
}) {
    return (
        <div className="grid gap-1">
            <span className="text-xs text-white/50">{label}</span>
            <div
                className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2',
                    secret
                        ? 'bg-amber-500/10 ring-1 ring-amber-400/30'
                        : 'bg-white/[0.04]',
                )}
            >
                <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-white">
                    {value}
                </code>
                <button
                    type="button"
                    onClick={() => copy(value)}
                    aria-label={tr('Копіювати')}
                    className="rounded-lg p-1 text-white/50 hover:text-white"
                >
                    <Copy className="size-4" />
                </button>
            </div>
        </div>
    );
}

function Code({ children }: { children: string }) {
    return (
        <pre className="overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-[12.5px] leading-relaxed text-white/85">
            {children}
        </pre>
    );
}

/** /developers: свої застосунки й ключі, документація OAuth 2.1, API й ботів. */
export default function Developers({
    apps,
    scopes,
    base,
    limits,
    reveal,
}: Props) {
    const { auth } = usePage().props;
    const [tab, setTab] = useState<(typeof TABS)[number][0]>(
        auth.user ? 'apps' : 'oauth',
    );

    return (
        <>
            <Head title={tr('Розробникам')} />
            <div className="mx-auto max-w-4xl space-y-5">
                <header className="space-y-2">
                    <h1 className="font-display text-3xl font-bold text-white">
                        {tr('Розробникам')}
                    </h1>
                    <p className="text-white/60">
                        {tr(
                            '«Увійти через GameCon» на вашому сайті, боти й інтеграції: застосунки з власними ключами, OAuth 2.1 з PKCE і публічний API.',
                        )}
                    </p>
                </header>

                <nav className="gc-solid-2 flex flex-wrap gap-1 rounded-xl p-1 text-sm">
                    {TABS.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-medium transition',
                                tab === key
                                    ? 'bg-primary text-white'
                                    : 'text-white/60 hover:text-white',
                            )}
                        >
                            {tr(label)}
                        </button>
                    ))}
                    <Link
                        href="/developers/plugins"
                        className="rounded-lg px-3 py-1.5 font-medium text-white/60 hover:text-white"
                    >
                        {tr('Плагіни й SDK')}
                    </Link>
                    <Link
                        href="/developers/servers"
                        className="rounded-lg px-3 py-1.5 font-medium text-white/60 hover:text-white"
                    >
                        {tr('Для серверів GTA')}
                    </Link>
                </nav>

                {tab === 'apps' &&
                    (auth.user ? (
                        <AppsTab
                            apps={apps}
                            scopes={scopes}
                            limit={limits.apps}
                            reveal={reveal}
                        />
                    ) : (
                        <section className="gc-solid rounded-2xl p-5 text-sm text-white/70">
                            {tr('Увійдіть, щоб створити застосунок.')}
                        </section>
                    ))}
                {tab === 'oauth' && <OAuthDocs base={base} scopes={scopes} />}
                {tab === 'api' && <ApiDocs base={base} limits={limits} />}
                {tab === 'bots' && <BotDocs base={base} limits={limits} />}
            </div>
        </>
    );
}

function AppsTab({
    apps,
    scopes,
    limit,
    reveal,
}: {
    apps: DevApp[];
    scopes: Props['scopes'];
    limit: number;
    reveal: Props['reveal'];
}) {
    const [creating, setCreating] = useState(apps.length === 0);

    return (
        <div className="space-y-4">
            {apps.map((app) => (
                <AppCard
                    key={app.id}
                    app={app}
                    scopes={scopes}
                    reveal={reveal?.app === app.id ? reveal : null}
                />
            ))}
            {creating ? (
                <AppForm scopes={scopes} onCancel={() => setCreating(false)} />
            ) : (
                apps.length < limit && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="gc-solid-2 flex w-full items-center justify-center gap-2 rounded-2xl p-4 text-sm font-semibold text-white/80 hover:text-white"
                    >
                        <Plus className="size-4" />
                        {tr('Новий застосунок')}
                    </button>
                )
            )}
        </div>
    );
}

function AppForm({
    app,
    scopes,
    onCancel,
}: {
    app?: DevApp;
    scopes: Props['scopes'];
    onCancel: () => void;
}) {
    const form = useForm({
        name: app?.name ?? '',
        description: app?.description ?? '',
        website: app?.website ?? '',
        confidential: app?.confidential ?? true,
        redirect_uris: (app?.redirect_uris ?? ['']).join('\n'),
        scopes: app?.scopes ?? ['profile'],
    });
    const submit = () => {
        form.transform((d) => ({
            ...d,
            redirect_uris: d.redirect_uris
                .split(/\s+/)
                .map((s) => s.trim())
                .filter(Boolean),
        }));
        const opts = { preserveScroll: true, onSuccess: () => onCancel() };
        if (app) form.put(`/developers/apps/${app.id}`, opts);
        else form.post('/developers/apps', opts);
    };
    const input =
        'input-glass w-full rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/35';
    const errors = form.errors as Record<string, string>;
    const uriError = Object.entries(errors).find(([k]) =>
        k.startsWith('redirect_uris'),
    )?.[1];

    return (
        <section className="gc-solid space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {app ? tr('Налаштування застосунку') : tr('Новий застосунок')}
            </h2>
            <label className="grid gap-1 text-sm text-white/70">
                {tr('Назва')}
                <input
                    className={input}
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    maxLength={60}
                />
                {errors.name && (
                    <span className="text-xs text-rose-300">{errors.name}</span>
                )}
            </label>
            <label className="grid gap-1 text-sm text-white/70">
                {tr('Опис (бачать люди на екрані згоди)')}
                <input
                    className={input}
                    value={form.data.description}
                    onChange={(e) =>
                        form.setData('description', e.target.value)
                    }
                    maxLength={300}
                />
            </label>
            <label className="grid gap-1 text-sm text-white/70">
                {tr('Сайт')}
                <input
                    className={input}
                    value={form.data.website}
                    onChange={(e) => form.setData('website', e.target.value)}
                    placeholder="https://"
                />
                {errors.website && (
                    <span className="text-xs text-rose-300">
                        {errors.website}
                    </span>
                )}
            </label>
            <label className="grid gap-1 text-sm text-white/70">
                {tr('Адреси повернення (redirect URI), по одній у рядку')}
                <textarea
                    className={cn(input, 'min-h-20 font-mono text-[13px]')}
                    value={form.data.redirect_uris}
                    onChange={(e) =>
                        form.setData('redirect_uris', e.target.value)
                    }
                    placeholder="https://example.com/auth/gamecon/callback"
                />
                {uriError && (
                    <span className="text-xs text-rose-300">{uriError}</span>
                )}
            </label>
            <label className="flex items-start gap-2 text-sm text-white/75">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={!form.data.confidential}
                    onChange={(e) =>
                        form.setData('confidential', !e.target.checked)
                    }
                />
                <span>
                    {tr('Публічний клієнт (SPA чи мобільний застосунок)')}
                    <span className="block text-xs text-white/45">
                        {tr(
                            'Без секретного ключа: захист лише через PKCE. Для сайту з сервером лишайте вимкненим.',
                        )}
                    </span>
                </span>
            </label>
            <fieldset className="grid gap-1.5">
                <legend className="mb-1 text-sm text-white/70">
                    {tr('Права, які застосунок може просити')}
                </legend>
                {scopes.map((s) => (
                    <label
                        key={s.key}
                        className="flex items-center gap-2 text-sm text-white/80"
                    >
                        <input
                            type="checkbox"
                            disabled={s.key === 'profile'}
                            checked={form.data.scopes.includes(s.key)}
                            onChange={(e) =>
                                form.setData(
                                    'scopes',
                                    e.target.checked
                                        ? [...form.data.scopes, s.key]
                                        : form.data.scopes.filter(
                                              (x) => x !== s.key,
                                          ),
                                )
                            }
                        />
                        <code className="font-mono text-xs text-primary">
                            {s.key}
                        </code>
                        <span className="text-white/60">{tr(s.label)}</span>
                    </label>
                ))}
            </fieldset>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-xl px-4 py-2 text-sm text-white/70 hover:text-white"
                >
                    {tr('Скасувати')}
                </button>
                <button
                    type="button"
                    disabled={form.processing}
                    onClick={submit}
                    className="btn-glow rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                    {app ? tr('Зберегти') : tr('Створити')}
                </button>
            </div>
        </section>
    );
}

function AppCard({
    app,
    scopes,
    reveal,
}: {
    app: DevApp;
    scopes: Props['scopes'];
    reveal: Props['reveal'];
}) {
    const [editing, setEditing] = useState(false);
    const [overlay, setOverlay] = useState(false);
    const [personal, setPersonal] = useState<string[]>(['profile']);
    const post = (url: string, data: Record<string, string | string[]> = {}) =>
        router.post(url, data, { preserveScroll: true });
    const rotate = (what: 'secret' | 'bot' | 'public', ask: string) => {
        if (confirm(ask)) post(`/developers/apps/${app.id}/rotate`, { what });
    };

    if (editing)
        return (
            <AppForm
                app={app}
                scopes={scopes}
                onCancel={() => setEditing(false)}
            />
        );

    return (
        <section
            id={`app-${app.id}`}
            className="gc-solid space-y-4 rounded-2xl p-5"
        >
            <div className="flex flex-wrap items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <AppWindow className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-bold text-white">
                        {app.name}
                    </h2>
                    <p className="text-xs text-white/50">
                        {app.confidential
                            ? tr('Конфіденційний клієнт')
                            : tr('Публічний клієнт (PKCE)')}
                        {' · '}
                        {tr('{n} людей підключили', { n: app.users })}
                    </p>
                    {app.blocked && (
                        <p className="mt-1 text-xs text-rose-300">
                            {tr('Заблоковано адміністрацією')}
                            {app.blocked_reason
                                ? `: ${app.blocked_reason}`
                                : ''}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setOverlay((o) => !o)}
                    aria-expanded={overlay}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                    <Layers className="size-4" />
                    {tr('Оверлей')}
                </button>
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
                >
                    {tr('Змінити')}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (
                            confirm(
                                tr(
                                    'Видалити «{name}»? Усі токени й ключі перестануть діяти.',
                                    { name: app.name },
                                ),
                            )
                        )
                            router.delete(`/developers/apps/${app.id}`);
                    }}
                    aria-label={tr('Видалити')}
                    className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"
                >
                    <Trash2 className="size-4" />
                </button>
            </div>

            {overlay && (
                <OverlayEditor
                    appId={app.id}
                    appName={app.name}
                    initial={app.overlay}
                    onClose={() => setOverlay(false)}
                />
            )}

            {reveal && (
                <div className="space-y-2 rounded-2xl bg-amber-500/[0.07] p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                        <KeyRound className="size-4" />
                        {tr('Скопіюйте зараз — більше не покажемо')}
                    </p>
                    {reveal.client_secret && (
                        <KeyLine
                            label={tr('Секретний ключ (client_secret)')}
                            value={reveal.client_secret}
                            secret
                        />
                    )}
                    {reveal.bot_token && (
                        <KeyLine
                            label={tr('Токен бота')}
                            value={reveal.bot_token}
                            secret
                        />
                    )}
                    {reveal.access_token && (
                        <KeyLine
                            label={tr('OAuth-токен доступу (1 год)')}
                            value={reveal.access_token}
                            secret
                        />
                    )}
                    {reveal.refresh_token && (
                        <KeyLine
                            label={tr('Refresh-токен (30 днів)')}
                            value={reveal.refresh_token}
                            secret
                        />
                    )}
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                <KeyLine label={tr('Client ID')} value={app.client_id} />
                <KeyLine
                    label={tr('Публічний ключ (можна в браузері)')}
                    value={app.public_key}
                />
            </div>
            <div className="grid gap-2 text-sm">
                {app.confidential && (
                    <Row
                        icon={KeyRound}
                        title={tr('Секретний ключ')}
                        hint={
                            app.has_secret
                                ? tr('Збережено. Тримайте лише на сервері.')
                                : tr('Ще немає')
                        }
                        action={tr('Новий секрет')}
                        onClick={() =>
                            rotate(
                                'secret',
                                tr(
                                    'Створити новий секрет? Старий перестане діяти одразу.',
                                ),
                            )
                        }
                    />
                )}
                <Row
                    icon={Bot}
                    title={tr('Токен бота')}
                    hint={
                        app.has_bot
                            ? tr('Діє. Запити: Authorization: Bot …')
                            : tr('Для дій від імені застосунку без людини')
                    }
                    action={app.has_bot ? tr('Новий токен') : tr('Створити')}
                    onClick={() =>
                        rotate(
                            'bot',
                            tr(
                                'Створити новий токен бота? Старий перестане діяти.',
                            ),
                        )
                    }
                />
                <Row
                    icon={RotateCw}
                    title={tr('Публічний ключ')}
                    hint={tr('Змініть, якщо ключ потрапив туди, де не треба')}
                    action={tr('Новий ключ')}
                    onClick={() =>
                        rotate('public', tr('Замінити публічний ключ?'))
                    }
                />
            </div>

            <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="size-4 text-primary" />
                    {tr('OAuth-токен на свій акаунт (для перевірки API)')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {app.scopes.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() =>
                                setPersonal((p) =>
                                    p.includes(s)
                                        ? p.filter((x) => x !== s)
                                        : [...p, s],
                                )
                            }
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs',
                                personal.includes(s)
                                    ? 'bg-primary/20 text-white'
                                    : 'bg-white/[0.05] text-white/55',
                            )}
                        >
                            {personal.includes(s) && (
                                <Check className="size-3" />
                            )}
                            {s}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    disabled={personal.length === 0}
                    onClick={() =>
                        post(`/developers/apps/${app.id}/personal-token`, {
                            scopes: personal,
                        })
                    }
                    className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {tr('Видати токен')}
                </button>
            </div>

            <p className="text-xs text-white/45">
                {tr('Адреси повернення')}:{' '}
                <span className="font-mono">
                    {app.redirect_uris.join(', ')}
                </span>
            </p>
        </section>
    );
}

function Row({
    icon: Icon,
    title,
    hint,
    action,
    onClick,
}: {
    icon: typeof Bot;
    title: string;
    hint: string;
    action: string;
    onClick: () => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
            <Icon className="size-4 shrink-0 text-white/55" />
            <div className="min-w-0 flex-1">
                <p className="text-white">{title}</p>
                <p className="truncate text-xs text-white/45">{hint}</p>
            </div>
            <button
                type="button"
                onClick={onClick}
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-white/[0.06]"
            >
                {action}
            </button>
        </div>
    );
}

function OAuthDocs({
    base,
    scopes,
}: {
    base: string;
    scopes: Props['scopes'];
}) {
    return (
        <section className="gc-solid space-y-4 rounded-2xl p-5 text-sm text-white/75">
            <h2 className="font-display text-xl font-bold text-white">
                {tr('Увійти через GameCon (OAuth 2.1)')}
            </h2>
            <p>
                {tr(
                    'Лише код авторизації з PKCE (S256) — для всіх клієнтів. Implicit і password grant не підтримуються. Адреса повернення має точно збігатися з однією зі збережених.',
                )}
            </p>
            <h3 className="font-semibold text-white">
                {tr('1. Відправте людину на сторінку згоди')}
            </h3>
            <Code>{`${base}/oauth/authorize?response_type=code
  &client_id=gc_…
  &redirect_uri=https://example.com/callback
  &scope=profile friends
  &state=випадковий_рядок
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256`}</Code>
            <p>
                {tr(
                    'Після згоди повернемо на redirect_uri з ?code=…&state=…&iss=…. Перевірте, що state збігається.',
                )}
            </p>
            <h3 className="font-semibold text-white">
                {tr('2. Обміняйте код на токени')}
            </h3>
            <Code>{`curl -X POST ${base}/oauth/token \\
  -u "gc_…:gcs_…" \\
  -d grant_type=authorization_code \\
  -d code=… \\
  -d redirect_uri=https://example.com/callback \\
  -d code_verifier=…`}</Code>
            <Code>{`{ "access_token": "gca_…", "token_type": "Bearer",
  "expires_in": 3600, "refresh_token": "gcr_…", "scope": "profile friends" }`}</Code>
            <h3 className="font-semibold text-white">
                {tr('3. Оновлення й відкликання')}
            </h3>
            <Code>{`curl -X POST ${base}/oauth/token -u "gc_…:gcs_…" \\
  -d grant_type=refresh_token -d refresh_token=gcr_…

curl -X POST ${base}/oauth/revoke -u "gc_…:gcs_…" -d token=gca_…`}</Code>
            <p className="text-white/60">
                {tr(
                    'Refresh-токен одноразовий: кожне оновлення видає нову пару. Повторне використання старого відкликає всі токени (захист від крадіжки). Публічні клієнти передають лише client_id без секрету.',
                )}
            </p>
            <p>
                {tr('Метадані сервера (RFC 8414)')}:{' '}
                <a
                    className="font-mono text-primary"
                    href="/.well-known/oauth-authorization-server"
                >
                    /.well-known/oauth-authorization-server
                </a>
            </p>
            <h3 className="font-semibold text-white">{tr('Права (scope)')}</h3>
            <ul className="grid gap-1">
                {scopes.map((s) => (
                    <li key={s.key} className="flex gap-2">
                        <code className="w-28 shrink-0 font-mono text-primary">
                            {s.key}
                        </code>
                        <span>{tr(s.label)}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function ApiDocs({ base, limits }: { base: string; limits: Props['limits'] }) {
    const rows: [string, string, string, string][] = [
        ['GET', '/me', 'profile', 'Хто дав доступ (email — з правом email)'],
        ['GET', '/users/{username}', 'profile', 'Профіль за ніком'],
        ['GET', '/me/friends', 'friends', 'Друзі (курсор next_cursor)'],
        ['GET', '/me/posts', 'posts:read', 'Публікації людини'],
        [
            'POST',
            '/me/posts',
            'posts:write',
            'Нова публікація: body, visibility',
        ],
        ['PUT', '/me/status', 'status', '«Граю в…»: kind, id, note, hours'],
        ['DELETE', '/me/status', 'status', 'Прибрати статус'],
        ['GET', '/me/notifications', 'notifications', 'Кількість непрочитаних'],
    ];

    return (
        <section className="gc-solid space-y-4 rounded-2xl p-5 text-sm text-white/75">
            <h2 className="font-display text-xl font-bold text-white">
                {tr('Публічний API')}
            </h2>
            <p>
                {tr('Адреса')}:{' '}
                <code className="font-mono text-primary">
                    {base}/api/developer/v1
                </code>
                {' · '}
                {tr('заголовок')}{' '}
                <code className="font-mono">Authorization: Bearer gca_…</code>
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-xs text-white/45">
                        <tr>
                            <th className="py-1 pr-3">{tr('Метод')}</th>
                            <th className="py-1 pr-3">{tr('Шлях')}</th>
                            <th className="py-1 pr-3">{tr('Право')}</th>
                            <th className="py-1">{tr('Що робить')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(([m, p, s, d]) => (
                            <tr
                                key={m + p}
                                className="border-t border-white/[0.06]"
                            >
                                <td className="py-1.5 pr-3 font-mono text-xs text-primary">
                                    {m}
                                </td>
                                <td className="py-1.5 pr-3 font-mono text-xs">
                                    {p}
                                </td>
                                <td className="py-1.5 pr-3 font-mono text-xs text-white/55">
                                    {s}
                                </td>
                                <td className="py-1.5">{tr(d)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Code>{`curl ${base}/api/developer/v1/me -H "Authorization: Bearer gca_…"`}</Code>
            <p className="text-white/60">
                {tr(
                    'Ліміт — {n} запитів на хвилину на токен (заголовки X-RateLimit-*). Помилки: 401 invalid_token, 403 insufficient_scope, 429 rate_limited.',
                    { n: limits.user },
                )}
            </p>
        </section>
    );
}

function BotDocs({ base, limits }: { base: string; limits: Props['limits'] }) {
    return (
        <section className="gc-solid space-y-4 rounded-2xl p-5 text-sm text-white/75">
            <h2 className="font-display text-xl font-bold text-white">
                {tr('Ключі застосунку й боти')}
            </h2>
            <ul className="grid gap-2">
                <li>
                    <b className="text-white">Client ID</b> (
                    <code className="font-mono">gc_…</code>) —{' '}
                    {tr('ім’я застосунку в OAuth, не секрет.')}
                </li>
                <li>
                    <b className="text-white">{tr('Публічний ключ')}</b> (
                    <code className="font-mono">gcp_…</code>) —{' '}
                    {tr(
                        'для публічних даних без людини; можна вбудувати в браузер чи віджет.',
                    )}
                </li>
                <li>
                    <b className="text-white">{tr('Секретний ключ')}</b> (
                    <code className="font-mono">gcs_…</code>) —{' '}
                    {tr('лише на вашому сервері, для обміну коду на токени.')}
                </li>
                <li>
                    <b className="text-white">{tr('OAuth-токен')}</b> (
                    <code className="font-mono">gca_…</code>) —{' '}
                    {tr('доступ від імені людини, що дала згоду; живе годину.')}
                </li>
                <li>
                    <b className="text-white">{tr('Токен бота')}</b> (
                    <code className="font-mono">gcb_…</code>) —{' '}
                    {tr('дії від імені самого застосунку; тримайте як пароль.')}
                </li>
            </ul>
            <Code>{`curl ${base}/api/developer/v1/public/app -H "Authorization: Bot gcb_…"
curl ${base}/api/developer/v1/public/users/nick -H "X-GameCon-Key: gcp_…"
curl ${base}/api/developer/v1/public/users/nick/posts -H "X-GameCon-Key: gcp_…"`}</Code>
            <p className="text-white/60">
                {tr('Ліміт ключа застосунку — {n} запитів на хвилину.', {
                    n: limits.app,
                })}
            </p>
            <p className="text-white/60">
                {tr(
                    'Двофакторний вхід на GameCon можна підтверджувати кодами з вбудованого автентифікатора застосунку GameCon (як Google Authenticator).',
                )}
            </p>
        </section>
    );
}

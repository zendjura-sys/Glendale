import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    Copy,
    Download,
    KeyRound,
    Link2,
    Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { tr } from '@/lib/i18n';
import { EngineMark } from './plugins';
import type { CmsPluginCard } from './plugins';

type Props = {
    plugin: CmsPluginCard & {
        steps: string[];
        settings: string;
        installable: boolean;
        install: string | null;
        features: string[];
        redirect: string;
    };
    base: string;
    version: string;
    others: CmsPluginCard[];
};

function copy(value: string) {
    void navigator.clipboard?.writeText(value);
    toast.success(tr('Скопійовано.'));
}

function Line({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid min-w-0 gap-1">
            <span className="text-xs text-white/50">{label}</span>
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                    {value}
                </code>
                <button
                    type="button"
                    onClick={() => copy(value)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
                    aria-label={tr('Копіювати')}
                >
                    <Copy className="size-4" />
                </button>
            </div>
        </div>
    );
}

export default function DeveloperPlugin({
    plugin,
    base,
    version,
    others,
}: Props) {
    const signedIn = Boolean(
        (usePage().props as { auth?: { user?: unknown } }).auth?.user,
    );
    const [site, setSite] = useState('');
    const clean = site.trim().replace(/\/+$/, '');
    const host = clean
        ? /^https?:\/\//.test(clean)
            ? clean
            : `https://${clean}`
        : 'https://ваш-сайт';
    const native = plugin.kind === 'app';
    const redirect = native ? plugin.redirect : host + plugin.redirect;

    return (
        <>
            <Head
                title={tr('{name}: увійти через GameCon', {
                    name: plugin.name,
                })}
            />
            <div className="mx-auto max-w-4xl space-y-5">
                <Link
                    href="/developers/plugins"
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Плагіни й SDK')}
                </Link>

                <header className="gc-solid flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
                    <EngineMark plugin={plugin} size="lg" />
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-2xl font-bold text-white">
                            {plugin.name}
                        </h1>
                        <p className="mt-0.5 text-sm text-white/60">
                            {tr('Увійти через GameCon')} · {tr(plugin.package)}{' '}
                            {version}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            {[plugin.versions, plugin.stack, 'OAuth 2.1'].map(
                                (chip) => (
                                    <span
                                        key={chip}
                                        className="rounded-chip bg-white/[0.07] px-2.5 py-1 text-white/70"
                                    >
                                        {chip}
                                    </span>
                                ),
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 sm:flex-col">
                        <a
                            href={plugin.download}
                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                            <Download className="size-4" />
                            {signedIn
                                ? tr('Завантажити')
                                : tr('Увійти й завантажити')}
                        </a>
                        <Link
                            href="/developers"
                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/[0.07] px-4 text-sm font-medium text-white/85 transition hover:bg-white/[0.11]"
                        >
                            <KeyRound className="size-4" />
                            {tr('Мої застосунки')}
                        </Link>
                    </div>
                </header>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="min-w-0 space-y-5">
                        {plugin.installable && (
                            <section className="gc-solid space-y-3 rounded-2xl p-5">
                                <h2 className="flex items-center gap-2 font-semibold text-white">
                                    <Terminal className="size-4 text-primary" />
                                    {tr('Встановлення командою')}
                                </h2>
                                {plugin.install ? (
                                    <>
                                        <Line
                                            label={tr('Виконайте в терміналі')}
                                            value={plugin.install}
                                        />
                                        <p className="text-xs text-white/45">
                                            {tr(
                                                'Посилання персональне й діє добу. Потрібні curl і python3.',
                                            )}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-white/60">
                                        {tr(
                                            'Увійдіть у GameCon — тут з’явиться команда встановлення з персональним посиланням.',
                                        )}
                                    </p>
                                )}
                            </section>
                        )}

                        <section className="gc-solid space-y-4 rounded-2xl p-5">
                            <h2 className="font-semibold text-white">
                                {tr('Встановлення')}
                            </h2>
                            <ol className="space-y-3">
                                {(plugin.kind === 'cms' ||
                                plugin.kind === 'forum'
                                    ? [
                                          ...plugin.steps.map((s) => tr(s)),
                                          tr(
                                              'Відкрийте налаштування плагіна ({where}) — там показано адресу повернення (callback). Її ж можна зібрати нижче.',
                                              { where: tr(plugin.settings) },
                                          ),
                                          tr(
                                              'Розробникам → Новий застосунок «з секретом»: вставте цю адресу в поле «Адреси повернення» й збережіть.',
                                          ),
                                          tr(
                                              'Скопіюйте Client ID і Client Secret застосунку в налаштування плагіна й збережіть — кнопка «Увійти через GameCon» з’явиться сама.',
                                          ),
                                      ]
                                    : plugin.steps.map((s) => tr(s))
                                ).map((step, i) => (
                                    <li key={step} className="flex gap-3">
                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[13px] font-semibold text-primary">
                                            {i + 1}
                                        </span>
                                        <p className="pt-1 text-sm leading-relaxed text-white/75">
                                            {step}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section className="gc-solid space-y-3 rounded-2xl p-5">
                            <h2 className="flex items-center gap-2 font-semibold text-white">
                                <Link2 className="size-4 text-primary" />
                                {tr('Адреса повернення')}
                            </h2>
                            {!native && (
                                <label className="grid gap-1">
                                    <span className="text-xs text-white/50">
                                        {tr('Адреса вашого сайту')}
                                    </span>
                                    <input
                                        value={site}
                                        onChange={(e) =>
                                            setSite(e.target.value)
                                        }
                                        placeholder="forum.example.com"
                                        inputMode="url"
                                        className="min-h-11 rounded-xl bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-primary/50"
                                    />
                                </label>
                            )}
                            <Line
                                label={tr('Вставте в налаштування застосунку')}
                                value={redirect}
                            />
                            {native && (
                                <p className="text-xs text-white/45">
                                    {tr(
                                        'Нативні застосунки — публічні клієнти: створіть застосунок без секрету. Схему com.example.game замініть своєю; для loopback порт підставляється сам.',
                                    )}
                                </p>
                            )}
                        </section>

                        {!native && (
                            <section className="gc-solid space-y-3 rounded-2xl p-5">
                                <h2 className="font-semibold text-white">
                                    {tr('Функції GameCon на вашому сайті')}
                                </h2>
                                <p className="text-sm text-white/60">
                                    {tr(
                                        'Додайте скрипт у шаблон один раз і розставте атрибути там, де потрібна функція. Працює на будь-якому рушії, навіть без плагіна.',
                                    )}
                                </p>
                                <Line
                                    label={tr(
                                        'Скрипт (у <head> чи перед </body>)',
                                    )}
                                    value={`<script src="${base}/embed.js" async></script>`}
                                />
                                <Line
                                    label={tr('Картка профілю')}
                                    value={
                                        '<div data-gamecon-card="нік"></div>'
                                    }
                                />
                                <Line
                                    label={tr('Значок GameCon біля імені')}
                                    value={
                                        '<span data-gamecon-badge="нік"></span>'
                                    }
                                />
                                <Line
                                    label={tr('Кнопка «Поділитися в GameCon»')}
                                    value={'<span data-gamecon-share></span>'}
                                />
                                <Line
                                    label={tr('Віджет сервера з онлайном')}
                                    value={
                                        '<div data-gamecon-widget="server:slug"></div>'
                                    }
                                />
                                <Line
                                    label={tr(
                                        'Дзвіночок сповіщень (токен із профілю після входу)',
                                    )}
                                    value={
                                        '<span data-gamecon-bell="bell_token"></span>'
                                    }
                                />
                                <p className="text-xs text-white/45">
                                    {tr(
                                        'Дзвіночок потребує права «notifications» у застосунку: після входу userinfo повертає bell_token — збережіть його в профілі користувача.',
                                    )}
                                </p>
                            </section>
                        )}

                        <section className="gc-solid space-y-3 rounded-2xl p-5">
                            <h2 className="font-semibold text-white">
                                {tr('Для ручного налаштування')}
                            </h2>
                            <Line
                                label="Authorization endpoint"
                                value={`${base}/oauth/authorize`}
                            />
                            <Line
                                label="Token endpoint"
                                value={`${base}/oauth/token`}
                            />
                            <Line
                                label="Userinfo endpoint"
                                value={`${base}/api/developer/v1/userinfo`}
                            />
                            <p className="text-xs text-white/45">
                                {tr(
                                    'Права: profile email. Поля профілю: sub, preferred_username, name, email, picture, profile.',
                                )}
                            </p>
                        </section>
                    </div>

                    <aside className="min-w-0 space-y-5">
                        <section className="gc-solid space-y-3 rounded-2xl p-5">
                            <h2 className="font-semibold text-white">
                                {tr('Що вміє')}
                            </h2>
                            <ul className="space-y-2.5">
                                {plugin.features.map((f) => (
                                    <li
                                        key={f}
                                        className="flex gap-2 text-sm text-white/75"
                                    >
                                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                                        {tr(f)}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="gc-solid space-y-2 rounded-2xl p-4">
                            <h2 className="px-1 text-sm font-semibold text-white/80">
                                {tr('Інші варіанти')}
                            </h2>
                            {others.map((o) => (
                                <Link
                                    key={o.key}
                                    href={o.href}
                                    className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/[0.06]"
                                >
                                    <EngineMark plugin={o} size="sm" />
                                    <span className="text-sm text-white/80">
                                        {o.name}
                                    </span>
                                </Link>
                            ))}
                        </section>
                    </aside>
                </div>
            </div>
        </>
    );
}

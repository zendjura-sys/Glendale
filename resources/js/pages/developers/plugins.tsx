import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Download,
    KeyRound,
    Link2,
    LogIn,
    PackageOpen,
    Puzzle,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CmsPluginCard = {
    key: string;
    name: string;
    kind: 'cms' | 'forum' | 'framework' | 'app';
    color: string;
    mark: string;
    logo: string | null;
    /** Фавікон з офіційного сайту рушія (завантажує сервер). */
    favicon: string | null;
    versions: string;
    stack: string;
    package: string;
    href: string;
    download: string;
};

type Props = { plugins: CmsPluginCard[]; version: string };

/** Монограма рушія в його фірмовому кольорі (без чужих логотипів). */
export function EngineMark({
    plugin,
    size = 'md',
}: {
    plugin: Pick<CmsPluginCard, 'color' | 'mark' | 'logo' | 'favicon'>;
    size?: 'sm' | 'md' | 'lg';
}) {
    const box =
        size === 'lg'
            ? 'size-16 rounded-2xl'
            : size === 'sm'
              ? 'size-8 rounded-lg'
              : 'size-12 rounded-xl';
    // Фавікон — на світлій плитці: кольорові значки рушіїв тут читаються найкраще.
    const [broken, setBroken] = useState(false);
    if (plugin.favicon && !broken) {
        return (
            <span
                aria-hidden
                className={cn(
                    'flex shrink-0 items-center justify-center bg-white shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-black/5',
                    box,
                )}
            >
                <img
                    src={plugin.favicon}
                    alt=""
                    loading="lazy"
                    onError={(_: SyntheticEvent) => setBroken(true)}
                    className={
                        size === 'lg'
                            ? 'size-10'
                            : size === 'sm'
                              ? 'size-5'
                              : 'size-8'
                    }
                />
            </span>
        );
    }

    return (
        <span
            aria-hidden
            className={cn(
                'flex shrink-0 items-center justify-center font-display font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]',
                size === 'lg'
                    ? 'size-16 rounded-2xl text-xl'
                    : size === 'sm'
                      ? 'size-8 rounded-lg text-[11px]'
                      : 'size-12 rounded-xl text-[15px]',
            )}
            style={{
                color: '#fff',
                background: `linear-gradient(145deg, ${plugin.color}, color-mix(in oklab, ${plugin.color} 70%, black))`,
            }}
        >
            {plugin.logo ? (
                <img
                    src={plugin.logo}
                    alt=""
                    className={
                        size === 'lg'
                            ? 'size-9'
                            : size === 'sm'
                              ? 'size-[18px]'
                              : 'size-7'
                    }
                />
            ) : (
                plugin.mark
            )}
        </span>
    );
}

const FILTERS = [
    ['all', 'Усі'],
    ['cms', 'CMS'],
    ['forum', 'Форуми'],
    ['framework', 'Фреймворки'],
    ['app', 'Застосунки'],
] as const;

export default function DeveloperPlugins({ plugins, version }: Props) {
    const reduce = useReducedMotion();
    const signedIn = Boolean(
        (usePage().props as { auth?: { user?: unknown } }).auth?.user,
    );
    const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
    const shown = plugins.filter((p) => filter === 'all' || p.kind === filter);

    return (
        <>
            <Head title={tr('Плагіни й SDK')} />
            <div className="mx-auto max-w-5xl space-y-6">
                <Link
                    href="/developers"
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 transition hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Розробникам')}
                </Link>

                <header className="space-y-2">
                    <h1 className="font-display text-3xl font-bold text-white">
                        {tr('Плагіни й SDK')}
                    </h1>
                    <p className="max-w-2xl text-white/60">
                        {tr(
                            '«Увійти через GameCon» на вашому сайті, форумі чи в застосунку: готові плагіни для CMS, пакети для фреймворків і SDK для Android, iOS, Windows, Linux і Flutter.',
                        )}
                    </p>
                </header>

                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        {
                            icon: PackageOpen,
                            title: tr('Встановіть плагін'),
                            text: tr(
                                'Завантажте архів для свого рушія й увімкніть.',
                            ),
                        },
                        {
                            icon: Link2,
                            title: tr('Скопіюйте адресу повернення'),
                            text: tr('Плагін покаже її у своїх налаштуваннях.'),
                        },
                        {
                            icon: KeyRound,
                            title: tr('Створіть застосунок'),
                            text: tr(
                                'У «Розробникам» вставте цю адресу — отримаєте Client ID і Secret.',
                            ),
                        },
                        {
                            icon: LogIn,
                            title: tr('Вставте ключі в плагін'),
                            text: tr(
                                'Кнопка «Увійти через GameCon» з’явиться сама.',
                            ),
                        },
                    ].map((step) => (
                        <div
                            key={step.title}
                            className="gc-solid flex items-start gap-3 rounded-2xl p-4"
                        >
                            <step.icon className="mt-0.5 size-5 shrink-0 text-primary" />
                            <div>
                                <p className="text-sm font-semibold text-white">
                                    {step.title}
                                </p>
                                <p className="mt-0.5 text-[13px] text-white/55">
                                    {step.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <nav className="gc-solid-2 flex max-w-full min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl p-1 text-sm">
                        {FILTERS.map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilter(key)}
                                className={cn(
                                    'shrink-0 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap transition',
                                    filter === key
                                        ? 'bg-primary text-white'
                                        : 'text-white/60 hover:text-white',
                                )}
                            >
                                {tr(label)}
                            </button>
                        ))}
                    </nav>
                    <span className="text-xs text-white/45">
                        {tr('Версія плагінів {v} · від популярних рушіїв', {
                            v: version,
                        })}
                    </span>
                </div>

                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((plugin, i) => (
                        <m.li
                            key={plugin.key}
                            layout={!reduce}
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.25,
                                delay: reduce ? 0 : Math.min(i, 10) * 0.025,
                            }}
                            className="gc-solid group relative flex items-center gap-3 rounded-2xl p-4 transition hover:bg-white/[0.06]"
                        >
                            <EngineMark plugin={plugin} />
                            <Link
                                href={plugin.href}
                                className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-2xl"
                            >
                                <p className="truncate font-semibold text-white">
                                    {plugin.name}
                                </p>
                                <p className="truncate text-[13px] text-white/55">
                                    {tr(plugin.package)} · {plugin.versions}
                                </p>
                            </Link>
                            <a
                                href={plugin.download}
                                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/10 hover:text-white"
                                aria-label={tr('Завантажити для {name}', {
                                    name: plugin.name,
                                })}
                                title={
                                    signedIn
                                        ? tr('Завантажити')
                                        : tr('Увійдіть, щоб завантажити')
                                }
                            >
                                <Download className="size-[18px]" />
                            </a>
                        </m.li>
                    ))}
                </ul>

                <section className="gc-solid flex items-start gap-3 rounded-2xl p-5">
                    <Puzzle className="mt-0.5 size-5 shrink-0 text-primary" />
                    <p className="text-sm text-white/65">
                        {tr(
                            'Немає вашого рушія? Будь-який сайт підключається напряму через OAuth 2.1 — інструкція на вкладці «OAuth 2.1» у розділі «Розробникам».',
                        )}
                        {!signedIn &&
                            ' ' +
                                tr(
                                    'Переглядати можна без входу, а завантажити плагін — після входу в GameCon.',
                                )}
                    </p>
                </section>
                <p className="text-center text-[11px] text-white/35">
                    {tr(
                        'Назви й логотипи рушіїв — товарні знаки їхніх власників і використані лише для позначення сумісності.',
                    )}
                </p>
            </div>
        </>
    );
}

import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Languages,
    Loader2,
    PencilLine,
    Plus,
    RefreshCw,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { useEffect } from 'react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Language = {
    code: string;
    native: string;
    name: string;
    enabled: boolean;
    deepl: boolean;
    stats: { translated: number; manual: number; total: number };
    progress: {
        done: number;
        total: number;
        running: boolean;
        error: string | null;
        finished_at: string | null;
    };
};

type Props = {
    languages: Language[];
    default_locale: string;
    suggested: { code: string; native: string }[];
    deepl: {
        configured: boolean;
        usage: { used: number; limit: number } | null;
    };
    catalog: number;
    content_translation: boolean;
};

const pct = (a: number, b: number) =>
    b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;

/** Адмінка → Мови: мови сайту й застосунку, автопереклад DeepL, ручні правки. */
export default function AdminLanguages({
    languages,
    default_locale,
    suggested,
    deepl,
    catalog,
    content_translation,
}: Props) {
    const form = useForm({ code: '' });
    const running = languages.some((l) => l.progress.running);

    // Поки йде автопереклад — оновлюємо прогрес.
    useEffect(() => {
        if (!running) return;
        const timer = setInterval(
            () =>
                router.reload({
                    only: ['languages'],
                }),
            4000,
        );

        return () => clearInterval(timer);
    }, [running]);

    const add = (codes: string[]) =>
        router.post(
            '/admin/languages',
            { codes },
            {
                preserveScroll: true,
                onSuccess: () => form.reset(),
                onError: (e) => form.setError('code', e.codes ?? ''),
            },
        );

    return (
        <>
            <Head title={tr('Мови — адмінка')} />
            <PageHeader
                title={tr('Мови')}
                description={tr(
                    'Мова визначається автоматично за браузером чи телефоном; людина може вибрати іншу вручну. Нові рядки інтерфейсу перекладаються щоночі.',
                )}
            />

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Рядків інтерфейсу')}
                    value={catalog}
                    icon={Languages}
                />
                <StatCard
                    label={tr('Увімкнено мов')}
                    value={languages.filter((l) => l.enabled).length + 1}
                    icon={Sparkles}
                    delay={50}
                />
                <StatCard
                    label={tr('DeepL за місяць')}
                    value={
                        deepl.usage
                            ? `${pct(deepl.usage.used, deepl.usage.limit)}%`
                            : '—'
                    }
                    hint={
                        deepl.usage
                            ? `${deepl.usage.used.toLocaleString()} / ${deepl.usage.limit.toLocaleString()}`
                            : deepl.configured
                              ? tr('немає даних')
                              : tr('ключ не додано')
                    }
                    icon={RefreshCw}
                    delay={100}
                />
            </div>

            {!deepl.configured && (
                <p className="mb-6 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100">
                    {tr(
                        'Щоб перекладати автоматично, додайте ключ DeepL в Інтеграціях. Без нього переклади можна вписати вручну.',
                    )}{' '}
                    <Link
                        href="/admin/integrations"
                        className="font-semibold underline"
                    >
                        {tr('Інтеграції')}
                    </Link>
                </p>
            )}

            <section className="glass mb-6 flex flex-wrap items-center gap-3 rounded-3xl p-4 sm:p-5">
                <div className="min-w-[min(100%,18rem)] flex-1">
                    <h2 className="font-display text-lg font-semibold text-white">
                        {tr('Кнопка «Перекласти»')}
                    </h2>
                    <p className="text-sm text-white/50">
                        {tr(
                            'Під записами, коментарями й повідомленнями: DeepL перекладає текст мовою інтерфейсу людини. Переклади зберігаються, тож символи витрачаються один раз.',
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() =>
                        router.put(
                            '/admin/languages/settings',
                            { content_translation: !content_translation },
                            { preserveScroll: true },
                        )
                    }
                    className={cn(
                        'h-9 rounded-xl px-3 text-sm font-semibold transition',
                        content_translation
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-white/[0.06] text-white/60 hover:text-white',
                    )}
                >
                    {content_translation ? tr('Увімкнено') : tr('Вимкнено')}
                </button>
            </section>

            <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
                <h2 className="mb-1 font-display text-lg font-semibold text-white">
                    {tr('Додати мову')}
                </h2>
                <p className="mb-3 text-sm text-white/50">
                    {tr(
                        'Код мови: en, de, pt-BR, zh-Hans, ko… Після додавання мова вимкнена — увімкніть її, коли переклад буде готовий.',
                    )}
                </p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (form.data.code.trim()) add([form.data.code.trim()]);
                    }}
                    className="flex flex-wrap gap-2"
                >
                    <input
                        value={form.data.code}
                        onChange={(e) => form.setData('code', e.target.value)}
                        placeholder="pt-BR"
                        className="input-glass h-10 w-40 rounded-xl px-3 text-sm text-white"
                    />
                    <button
                        type="submit"
                        className="btn-glow inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold"
                    >
                        <Plus className="size-4" /> {tr('Додати')}
                    </button>
                    {suggested.length > 0 && (
                        <button
                            type="button"
                            onClick={() => add(suggested.map((s) => s.code))}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.06] px-4 text-sm text-white/80 hover:bg-white/10"
                        >
                            <Sparkles className="size-4" />{' '}
                            {tr('Додати рекомендовані: {list}', {
                                list: suggested.map((s) => s.native).join(', '),
                            })}
                        </button>
                    )}
                </form>
                {form.errors.code && (
                    <p className="mt-2 text-xs text-rose-300">
                        {form.errors.code}
                    </p>
                )}
            </section>

            <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h2 className="flex-1 font-display text-lg font-semibold text-white">
                        {tr('Мови сайту й застосунку')}
                    </h2>
                    <label className="flex items-center gap-2 text-sm text-white/60">
                        {tr('Типова мова')}
                        <select
                            value={default_locale}
                            onChange={(e) =>
                                router.put(
                                    '/admin/languages/settings',
                                    { default_locale: e.target.value },
                                    { preserveScroll: true },
                                )
                            }
                            className="input-glass h-9 rounded-xl px-2 text-sm text-white"
                        >
                            <option value="uk">Українська</option>
                            {languages
                                .filter((l) => l.enabled)
                                .map((l) => (
                                    <option key={l.code} value={l.code}>
                                        {l.native}
                                    </option>
                                ))}
                        </select>
                    </label>
                </div>
                <div className="divide-y divide-white/[0.05]">
                    <div className="flex items-center gap-3 py-3">
                        <span className="w-14 font-mono text-sm text-white/50">
                            uk
                        </span>
                        <span className="flex-1 text-sm font-semibold text-white">
                            Українська{' '}
                            <span className="font-normal text-white/40">
                                · {tr('основна мова')}
                            </span>
                        </span>
                    </div>
                    {languages.map((l) => {
                        const ready = pct(l.stats.translated, l.stats.total);

                        return (
                            <div
                                key={l.code}
                                className="flex flex-wrap items-center gap-3 py-3"
                            >
                                <span className="w-14 font-mono text-sm text-white/50">
                                    {l.code}
                                </span>
                                <div className="min-w-[12rem] flex-1">
                                    <p className="text-sm font-semibold text-white">
                                        {l.native}{' '}
                                        <span className="font-normal text-white/40">
                                            · {l.name}
                                        </span>
                                    </p>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                                        <div
                                            className="h-full rounded-full bg-[#6d7dff] transition-all"
                                            style={{
                                                width: `${l.progress.running ? pct(l.progress.done, l.progress.total) : ready}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-white/45">
                                        {l.progress.running ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Loader2 className="size-3 animate-spin" />
                                                {tr(
                                                    'Перекладаємо: {done} з {total}',
                                                    {
                                                        done: l.progress.done,
                                                        total: l.progress.total,
                                                    },
                                                )}
                                            </span>
                                        ) : (
                                            tr(
                                                'Перекладено {ready}% · вручну {manual}',
                                                {
                                                    ready,
                                                    manual: l.stats.manual,
                                                },
                                            )
                                        )}
                                        {!l.deepl &&
                                            ` · ${tr('DeepL не підтримує — лише вручну')}`}
                                        {l.progress.error &&
                                            !l.progress.running &&
                                            ` · ${l.progress.error}`}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.patch(
                                                `/admin/languages/${l.code}`,
                                                { enabled: !l.enabled },
                                                { preserveScroll: true },
                                            )
                                        }
                                        className={cn(
                                            'h-9 rounded-xl px-3 text-sm font-semibold transition',
                                            l.enabled
                                                ? 'bg-emerald-500/15 text-emerald-200'
                                                : 'bg-white/[0.06] text-white/60 hover:text-white',
                                        )}
                                    >
                                        {l.enabled
                                            ? tr('Увімкнено')
                                            : tr('Вимкнено')}
                                    </button>
                                    {l.deepl && (
                                        <button
                                            type="button"
                                            disabled={
                                                l.progress.running ||
                                                !deepl.configured
                                            }
                                            onClick={() =>
                                                router.post(
                                                    `/admin/languages/${l.code}/translate`,
                                                    {},
                                                    { preserveScroll: true },
                                                )
                                            }
                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/75 hover:bg-white/10 disabled:opacity-40"
                                            title={tr('Перекласти нові рядки')}
                                        >
                                            <RefreshCw className="size-4" />{' '}
                                            {tr('Докласти')}
                                        </button>
                                    )}
                                    <Link
                                        href={`/admin/languages/${l.code}/strings`}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/75 hover:bg-white/10"
                                    >
                                        <PencilLine className="size-4" />{' '}
                                        {tr('Редагувати')}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            confirm(
                                                tr(
                                                    'Видалити мову разом з перекладами?',
                                                ),
                                            ) &&
                                            router.delete(
                                                `/admin/languages/${l.code}`,
                                                { preserveScroll: true },
                                            )
                                        }
                                        className="rounded-lg p-2 text-white/35 hover:text-rose-300"
                                        aria-label={tr('Видалити')}
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </>
    );
}

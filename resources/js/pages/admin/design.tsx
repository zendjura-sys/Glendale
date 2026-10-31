import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Download,
    Eye,
    FileCode2,
    ImagePlus,
    Monitor,
    Palette,
    Smartphone,
    RotateCcw,
    Snowflake,
    Trash2,
    Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Theme = {
    id: number;
    name: string;
    description: string | null;
    author: string | null;
    url: string;
    size: number;
    version: number;
    is_active: boolean;
    uploaded_by: string | null;
    updated_at: string;
};

type Props = {
    themes: Theme[];
    limits: { max_kb: number };
    seasonal: string;
    seasons: string[];
    background: SiteImage | null;
};

type SiteImage = {
    desktop: string | null;
    mobile: string | null;
    default: boolean;
};

// Попередній перегляд — повне завантаження сторінки: стиль підключається в <head> лише при першому відкритті.
const previewUrl = (id: number | 'default') => `/feed?design_preview=${id}`;

const kb = (bytes: number) =>
    `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('uk-UA')} КБ`;

export default function AdminDesign({
    themes,
    limits,
    seasonal,
    seasons,
    background,
}: Props) {
    const active = themes.find((theme) => theme.is_active) ?? null;
    const fileRef = useRef<HTMLInputElement>(null);
    const form = useForm<{
        name: string;
        author: string;
        description: string;
        file: File | null;
        activate: boolean;
    }>({ name: '', author: '', description: '', file: null, activate: false });

    const upload = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/design', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    return (
        <>
            <Head title={tr('Дизайн — Адмін-панель')} />
            <PageHeader
                title={tr('Дизайн')}
                description={tr(
                    'Стилі сайту: CSS-файли, що змінюють кольори, фон і заокруглення поверх стандартного вигляду. Увімкнений стиль бачать усі відвідувачі.',
                )}
                actions={
                    <a
                        href="/admin/design/template"
                        className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                    >
                        <Download className="size-4" />
                        {tr('Шаблон стилю')}
                    </a>
                }
            />

            <BackgroundCard image={background} />

            <SeasonalCard value={seasonal} seasons={seasons} />

            <section className="glass mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-4">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-brand text-white">
                    <Palette className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-white/45">
                        {tr('Зараз на сайті')}
                    </p>
                    <p className="font-display text-base font-bold text-white">
                        {active ? active.name : tr('Стандартний вигляд')}
                    </p>
                </div>
                {active && (
                    <button
                        type="button"
                        onClick={() => {
                            if (
                                confirm(
                                    tr(
                                        'Повернути стандартний вигляд для всіх відвідувачів?',
                                    ),
                                )
                            ) {
                                router.post(
                                    '/admin/design/reset',
                                    {},
                                    { preserveScroll: true },
                                );
                            }
                        }}
                        className="flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                    >
                        <RotateCcw className="size-4" />
                        {tr('Стандартний вигляд')}
                    </button>
                )}
            </section>

            <form
                onSubmit={upload}
                className="glass mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2"
            >
                <h2 className="font-display text-base font-bold text-white sm:col-span-2">
                    {tr('Новий стиль')}
                </h2>
                <div>
                    <Input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder={tr('Назва, наприклад «Зима 2026»')}
                        aria-label={tr('Назва стилю')}
                        className="h-10"
                    />
                    <InputError message={form.errors.name} className="mt-1" />
                </div>
                <Input
                    value={form.data.author}
                    onChange={(e) => form.setData('author', e.target.value)}
                    placeholder={tr('Автор (необов’язково)')}
                    aria-label={tr('Автор стилю')}
                    className="h-10"
                />
                <div className="sm:col-span-2">
                    <Input
                        value={form.data.description}
                        onChange={(e) =>
                            form.setData('description', e.target.value)
                        }
                        placeholder={tr('Короткий опис (необов’язково)')}
                        aria-label={tr('Опис стилю')}
                        className="h-10"
                    />
                    <InputError
                        message={form.errors.description}
                        className="mt-1"
                    />
                </div>
                <div className="sm:col-span-2">
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-3 text-left text-sm text-white/60 transition hover:border-gc-lilac-400/60 hover:text-white"
                    >
                        <FileCode2 className="size-5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                            {form.data.file
                                ? form.data.file.name
                                : tr('Оберіть CSS-файл (до {kb} КБ)', {
                                      kb: limits.max_kb,
                                  })}
                        </span>
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".css,text/css"
                        hidden
                        onChange={(e) =>
                            form.setData('file', e.target.files?.[0] ?? null)
                        }
                    />
                    <InputError message={form.errors.file} className="mt-1" />
                </div>
                <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                        type="checkbox"
                        checked={form.data.activate}
                        onChange={(e) =>
                            form.setData('activate', e.target.checked)
                        }
                        className="size-4 accent-[#6d5dfc]"
                    />
                    {tr('Одразу увімкнути для всіх')}
                </label>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={
                            form.processing ||
                            !form.data.name.trim() ||
                            !form.data.file
                        }
                        className="btn-glow flex h-10 items-center gap-2 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        <Upload className="size-4" />
                        {form.processing
                            ? tr('Завантаження…')
                            : tr('Завантажити стиль')}
                    </button>
                </div>
                <p className="text-xs leading-relaxed text-white/40 sm:col-span-2">
                    {tr(
                        'Почніть із шаблону: у ньому всі змінні теми. Дозволено лише CSS у UTF-8 без @import, без «<» і без зовнішніх адрес — у url() тільки data: або шляхи цього сайту.',
                    )}
                </p>
            </form>

            <div className="grid gap-3">
                <DefaultCard active={active === null} />
                {themes.map((theme) => (
                    <ThemeCard
                        key={theme.id}
                        theme={theme}
                        limit={limits.max_kb}
                    />
                ))}
                {themes.length === 0 && (
                    <div className="glass rounded-2xl px-6 py-10 text-center text-sm text-white/40">
                        {tr(
                            'Завантажених стилів ще немає. Скачайте шаблон, змініть кольори й завантажте файл.',
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

const actionClass =
    'flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40';

function DefaultCard({ active }: { active: boolean }) {
    return (
        <section className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Стандартний вигляд')}
                    </h3>
                    {active && <Pill tone="green">{tr('На сайті')}</Pill>}
                    <Pill>{tr('Вбудований')}</Pill>
                </div>
                <p className="mt-0.5 text-xs text-white/40">
                    {tr('Темна тема GameCon без додаткових стилів.')}
                </p>
            </div>
            <a
                href={previewUrl('default')}
                target="_blank"
                rel="noopener"
                className={actionClass}
            >
                <Eye className="size-4" />
                {tr('Переглянути')}
            </a>
        </section>
    );
}

function ThemeCard({ theme, limit }: { theme: Theme; limit: number }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const newVersion = (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        setError(null);
        router.post(
            `/admin/design/${theme.id}`,
            {
                name: theme.name,
                author: theme.author,
                description: theme.description,
                file,
            },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ?? tr('Помилка завантаження'),
                    ),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <section
            className={cn(
                'glass rounded-2xl p-4',
                theme.is_active && 'ring-1 ring-emerald-400/30',
            )}
        >
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-white">
                            {theme.name}
                        </h3>
                        {theme.is_active && (
                            <Pill tone="green">{tr('На сайті')}</Pill>
                        )}
                        <Pill>v{theme.version}</Pill>
                        <Pill>{kb(theme.size)}</Pill>
                    </div>
                    {theme.description && (
                        <p className="mt-1 text-sm text-white/60">
                            {theme.description}
                        </p>
                    )}
                    <p className="mt-0.5 text-xs text-white/40">
                        {[
                            theme.author &&
                                tr('Автор: {author}', { author: theme.author }),
                            theme.uploaded_by &&
                                tr('Завантажив: {name}', {
                                    name: theme.uploaded_by,
                                }),
                            new Date(theme.updated_at).toLocaleString('uk-UA', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                            }),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1">
                <a
                    href={previewUrl(theme.id)}
                    target="_blank"
                    rel="noopener"
                    className={actionClass}
                >
                    <Eye className="size-4" />
                    {tr('Переглянути')}
                </a>
                {!theme.is_active && (
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                `/admin/design/${theme.id}/activate`,
                                {},
                                { preserveScroll: true },
                            )
                        }
                        className={cn(actionClass, 'text-emerald-200')}
                    >
                        <CheckCircle2 className="size-4" />
                        {tr('Увімкнути для всіх')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className={actionClass}
                >
                    <Upload className="size-4" />
                    {busy ? tr('Завантаження…') : tr('Нова версія')}
                </button>
                <a
                    href={theme.url}
                    target="_blank"
                    rel="noopener"
                    className={actionClass}
                >
                    <FileCode2 className="size-4" />
                    CSS
                </a>
                <button
                    type="button"
                    onClick={() => {
                        if (
                            confirm(
                                theme.is_active
                                    ? tr(
                                          'Стиль «{name}» зараз на сайті. Видалити його й повернути стандартний вигляд?',
                                          { name: theme.name },
                                      )
                                    : tr('Видалити стиль «{name}»?', {
                                          name: theme.name,
                                      }),
                            )
                        ) {
                            router.delete(`/admin/design/${theme.id}`, {
                                preserveScroll: true,
                            });
                        }
                    }}
                    className={cn(actionClass, 'ml-auto hover:text-rose-300')}
                >
                    <Trash2 className="size-4" />
                    {tr('Видалити')}
                </button>
            </div>
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            <input
                ref={fileRef}
                type="file"
                accept=".css,text/css"
                hidden
                aria-label={tr('Нова версія стилю (до {kb} КБ)', { kb: limit })}
                onChange={(e) => {
                    newVersion(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />
        </section>
    );
}

const SEASON_LABELS = (): Record<string, string> => ({
    auto: tr('Автоматично'),
    off: tr('Вимкнено'),
    newyear: tr('Новий рік і Різдво'),
    valentine: tr('День закоханих'),
    easter: tr('Великдень'),
    independence: tr('День Незалежності'),
    halloween: tr('Хелловін'),
});

/** Сезонні прикраси: за датою, вимкнені або потрібний сезон уже зараз. */
function SeasonalCard({
    value,
    seasons,
}: {
    value: string;
    seasons: string[];
}) {
    const labels = SEASON_LABELS();
    const [sending, setSending] = useState<string | null>(null);
    const choose = (next: string) => {
        if (next === value) return;
        setSending(next);
        router.post(
            '/admin/design/seasonal',
            { seasonal: next },
            { preserveScroll: true, onFinish: () => setSending(null) },
        );
    };

    return (
        <section className="glass mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                    <Snowflake className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Святкові прикраси')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Автоматично — за календарем (Київ). Можна вимкнути для всіх або показати сезон уже зараз. Людина може вимкнути прикраси в себе в налаштуваннях.',
                        )}
                    </p>
                </div>
            </div>
            <div
                role="radiogroup"
                aria-label={tr('Святкові прикраси')}
                className="mt-3 flex flex-wrap gap-2"
            >
                {['auto', 'off', ...seasons].map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={value === id}
                        disabled={sending !== null}
                        onClick={() => choose(id)}
                        className={cn(
                            'h-9 rounded-xl px-3 text-sm font-medium transition disabled:opacity-60',
                            value === id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.09] hover:text-white',
                        )}
                    >
                        {labels[id] ?? id}
                    </button>
                ))}
            </div>
        </section>
    );
}

/** Фірмовий фон сайту: окремі картинки для комп'ютера й телефона, вимикач «для всіх». */
function BackgroundCard({ image }: { image: SiteImage | null }) {
    const [sending, setSending] = useState(false);
    const upload = (kind: 'desktop' | 'mobile', file: File | undefined) => {
        if (!file) return;
        setSending(true);
        router.post(
            '/admin/design/background',
            { [kind]: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onFinish: () => setSending(false),
            },
        );
    };
    const remove = (kind: 'desktop' | 'mobile') =>
        router.delete(`/admin/design/background/${kind}`, {
            preserveScroll: true,
        });
    const setDefault = (value: boolean) =>
        router.post(
            '/admin/design/background',
            { default: value },
            { preserveScroll: true },
        );
    const slots = [
        {
            kind: 'desktop' as const,
            icon: Monitor,
            title: tr('Для комп’ютера'),
            hint: tr('Горизонтальна, 16:9, від 1920×1080'),
            url: image?.desktop ?? null,
            ratio: 'aspect-video',
        },
        {
            kind: 'mobile' as const,
            icon: Smartphone,
            title: tr('Для телефона'),
            hint: tr('Вертикальна, 9:19, від 1080×2340'),
            url: image?.mobile ?? null,
            ratio: 'aspect-[9/19] max-h-64',
        },
    ];

    return (
        <section className="glass mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
                    <ImagePlus className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Фон сайту')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Своя картинка за інтерфейсом. На телефоні показується вертикальна, на комп’ютері — горизонтальна; якщо є лише одна, вона буде всюди. JPG, PNG або WebP до 12 МБ.',
                        )}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-4">
                {slots.map((slot) => (
                    <div key={slot.kind} className="flex flex-col gap-2">
                        <label
                            className={cn(
                                'group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] bg-cover bg-center transition hover:border-white/35',
                                slot.ratio,
                                slot.kind === 'desktop' ? 'w-72' : 'w-[7.5rem]',
                                sending && 'pointer-events-none opacity-60',
                            )}
                            style={
                                slot.url
                                    ? { backgroundImage: `url(${slot.url})` }
                                    : undefined
                            }
                        >
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(e) => {
                                    upload(slot.kind, e.target.files?.[0]);
                                    e.target.value = '';
                                }}
                            />
                            <span
                                className={cn(
                                    'flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-center text-xs font-medium text-white/70 transition',
                                    slot.url &&
                                        'bg-black/55 opacity-0 group-hover:opacity-100',
                                )}
                            >
                                <Upload className="size-4" />
                                {slot.url ? tr('Замінити') : tr('Завантажити')}
                            </span>
                        </label>
                        <div className="flex items-start gap-1">
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                                    <slot.icon className="size-4 text-white/50" />
                                    {slot.title}
                                </p>
                                <p className="text-xs text-white/40">
                                    {slot.hint}
                                </p>
                            </div>
                            {slot.url && (
                                <button
                                    type="button"
                                    onClick={() => remove(slot.kind)}
                                    aria-label={tr('Видалити')}
                                    className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/[0.06] hover:text-red-300"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <label
                className={cn(
                    'mt-4 flex min-h-11 items-center gap-3 text-sm text-white',
                    !image && 'pointer-events-none opacity-50',
                )}
            >
                <input
                    type="checkbox"
                    checked={image?.default ?? false}
                    disabled={!image}
                    onChange={(e) => setDefault(e.target.checked)}
                    className="gc-switch"
                />
                {tr('Типовий фон для всіх')}
                <span className="text-xs text-white/40">
                    {tr(
                        'гості й ті, хто не обирав свій; у налаштуваннях він — «Фірмовий»',
                    )}
                </span>
            </label>
        </section>
    );
}

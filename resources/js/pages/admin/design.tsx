import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Download,
    Eye,
    FileCode2,
    ImagePlus,
    LogIn,
    Monitor,
    Palette,
    Smartphone,
    Tablet,
    RotateCcw,
    Snowflake,
    Trash2,
    Upload,
    Video,
    EyeOff,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { xsrfToken } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import {
    DESKTOP_STORES,
    MOBILE_STORES,
    STORES,
} from '@/components/app-promo/store-buttons';
import type { StoreKey } from '@/components/app-promo/store-buttons';
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
    videos: VideoBg[];
    authImages: Record<string, string | null>;
    appLinks: Partial<Record<StoreKey, string>>;
    appFiles: Partial<Record<DirectKey, AppFile>>;
    appFileTypes: Record<DirectKey, string[]>;
};

type DirectKey = 'apk' | 'windows' | 'macos' | 'linux';

type AppFile = {
    name: string;
    size: number;
    sha256: string;
    uploaded_at: string;
    url: string;
};

/** Розмір частини, як на сервері (AppFiles::CHUNK_BYTES). */
const CHUNK_BYTES = 4 * 1024 * 1024;

type VideoBg = {
    id: number;
    title: string;
    mobile: string | null;
    desktop: string | null;
    poster: string | null;
    is_active: boolean;
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
    videos,
    authImages,
    appLinks,
    appFiles,
    appFileTypes,
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
                        className="gc-solid-2 flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white/80 transition hover:bg-[var(--gc-l3)] hover:text-white"
                    >
                        <Download className="size-4" />
                        {tr('Шаблон стилю')}
                    </a>
                }
            />

            <BackgroundCard image={background} />
            <VideosCard videos={videos} />
            <AppLinksCard
                links={appLinks}
                files={appFiles}
                types={appFileTypes}
            />

            <AuthImagesCard images={authImages} />

            <SeasonalCard value={seasonal} seasons={seasons} />

            <section className="gc-solid mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-4">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-500 text-white">
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
                        className="flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white/70 transition hover:bg-[var(--gc-l3)] hover:text-white"
                    >
                        <RotateCcw className="size-4" />
                        {tr('Стандартний вигляд')}
                    </button>
                )}
            </section>

            <form
                onSubmit={upload}
                className="gc-solid mb-5 grid gap-3 rounded-2xl p-4 sm:grid-cols-2"
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
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white/60 transition hover:border-gc-lilac-400/60 hover:text-white"
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
                        className="btn-glow flex h-10 items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
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
                    <div className="gc-solid rounded-2xl px-6 py-10 text-center text-sm text-white/40">
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
    'flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/70 transition hover:bg-[var(--gc-l3)] hover:text-white disabled:opacity-40';

function DefaultCard({ active }: { active: boolean }) {
    return (
        <section className="gc-solid flex flex-wrap items-center gap-3 rounded-2xl p-4">
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
            className={cn('gc-solid rounded-2xl p-4', theme.is_active && ' ')}
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
                    className={cn(actionClass, 'ml-auto hover:text-red-400')}
                >
                    <Trash2 className="size-4" />
                    {tr('Видалити')}
                </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
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
        <section className="gc-solid mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="gc-solid-2 flex size-11 items-center justify-center rounded-2xl text-white">
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
                                : 'gc-solid-2 text-white/70 hover:bg-[var(--gc-l3)] hover:text-white',
                        )}
                    >
                        {labels[id] ?? id}
                    </button>
                ))}
            </div>
        </section>
    );
}

/** Фони входу й реєстрації: сайт (комп’ютер і планшет, телефон) і застосунок (телефон, планшет). */
function AuthImagesCard({ images }: { images: Record<string, string | null> }) {
    const [sending, setSending] = useState(false);
    const upload = (kind: string, file: File | undefined) => {
        if (!file) return;
        setSending(true);
        router.post(
            '/admin/design/auth-images',
            { [kind]: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onFinish: () => setSending(false),
            },
        );
    };
    const remove = (kind: string) =>
        router.delete(`/admin/design/auth-images/${kind}`, {
            preserveScroll: true,
        });
    const slots = [
        {
            kind: 'site_desktop',
            icon: Monitor,
            title: tr('Сайт: комп’ютер і планшет'),
            hint: tr('Горизонтальна, від 1920×1080'),
            ratio: 'aspect-video w-72',
        },
        {
            kind: 'site_mobile',
            icon: Smartphone,
            title: tr('Сайт: телефон'),
            hint: tr('Вертикальна, від 1080×2340'),
            ratio: 'aspect-[9/19] w-[7.5rem]',
        },
        {
            kind: 'app_phone',
            icon: Smartphone,
            title: tr('Застосунок: телефон'),
            hint: tr('Вертикальна, від 1080×2340'),
            ratio: 'aspect-[9/19] w-[7.5rem]',
        },
        {
            kind: 'app_tablet',
            icon: Tablet,
            title: tr('Застосунок: планшет'),
            hint: tr('Горизонтальна 4:3 або 16:10, від 2048×1536'),
            ratio: 'aspect-[4/3] w-56',
        },
    ];

    return (
        <section className="gc-solid mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="gc-solid-2 flex size-11 items-center justify-center rounded-2xl text-white">
                    <LogIn className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Фон входу й реєстрації')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Фото на сторінках входу сайту й застосунку. Без картинки — фірмове тло. Якщо на сайті є лише одна, вона буде і на телефоні, і на комп’ютері. JPG, PNG або WebP до 12 МБ.',
                        )}
                    </p>
                </div>
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-4">
                {slots.map((slot) => {
                    const url = images[slot.kind] ?? null;
                    return (
                        <div key={slot.kind} className="flex flex-col gap-2">
                            <label
                                className={cn(
                                    'group gc-solid-2 relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-cover bg-center transition hover:border-white/35',
                                    slot.ratio,
                                    sending && 'pointer-events-none opacity-60',
                                )}
                                style={
                                    url
                                        ? { backgroundImage: `url(${url})` }
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
                                        url &&
                                            'bg-black/55 opacity-0 group-hover:opacity-100',
                                    )}
                                >
                                    <Upload className="size-4" />
                                    {url ? tr('Замінити') : tr('Завантажити')}
                                </span>
                            </label>
                            <div className="flex max-w-72 items-start gap-1">
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                                        <slot.icon className="size-4 text-white/50" />
                                        {slot.title}
                                    </p>
                                    <p className="text-xs text-white/40">
                                        {slot.hint}
                                    </p>
                                </div>
                                {url && (
                                    <button
                                        type="button"
                                        onClick={() => remove(slot.kind)}
                                        aria-label={tr('Видалити')}
                                        className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-[var(--gc-l3)] hover:text-red-400"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
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
        <section className="gc-solid mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="gc-solid-2 flex size-11 items-center justify-center rounded-2xl text-white">
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
                                'group gc-solid-2 relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-cover bg-center transition hover:border-white/35',
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
                                    className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-[var(--gc-l3)] hover:text-red-400"
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

/**
 * Відеофони для учасників GameCon+: окремий файл для смартфона (вертикальний) і для ПК/планшета.
 * Люди обирають їх у Налаштування → Вигляд на сайті й у застосунку.
 */
function VideosCard({ videos }: { videos: VideoBg[] }) {
    const form = useForm<{
        title: string;
        mobile: File | null;
        desktop: File | null;
        poster: File | null;
    }>({ title: '', mobile: null, desktop: null, poster: null });
    const [key, setKey] = useState(0);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/design/videos', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setKey((k) => k + 1);
            },
        });
    };
    const files = [
        {
            name: 'mobile' as const,
            icon: Smartphone,
            label: tr('Смартфон'),
            hint: tr('Вертикальне 9:16, MP4/WebM'),
            accept: 'video/mp4,video/webm',
        },
        {
            name: 'desktop' as const,
            icon: Monitor,
            label: tr('ПК і планшет'),
            hint: tr('Горизонтальне 16:9, MP4/WebM'),
            accept: 'video/mp4,video/webm',
        },
        {
            name: 'poster' as const,
            icon: ImagePlus,
            label: tr('Обкладинка'),
            hint: tr('Кадр, поки відео вантажиться'),
            accept: 'image/jpeg,image/png,image/webp',
        },
    ];

    return (
        <section className="gc-solid mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="gc-solid-2 flex size-11 items-center justify-center rounded-2xl text-white">
                    <Video className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Відеофони GameCon+')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Учасники GameCon+ обирають їх у налаштуваннях вигляду на сайті й у застосунку. Відео без звуку, коротке й зациклене, до 60 МБ; якщо є лише один файл, він буде всюди.',
                        )}
                    </p>
                </div>
            </div>

            {videos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {videos.map((video) => (
                        <div
                            key={video.id}
                            className={cn(
                                'gc-solid-2 overflow-hidden rounded-xl',
                                !video.is_active && 'opacity-50',
                            )}
                        >
                            <video
                                src={video.desktop ?? video.mobile ?? undefined}
                                poster={video.poster ?? undefined}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                onMouseEnter={(e) =>
                                    void e.currentTarget.play().catch(() => {})
                                }
                                onMouseLeave={(e) => e.currentTarget.pause()}
                                className="aspect-video w-full bg-black object-cover"
                            />
                            <div className="flex items-center gap-1 p-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-white">
                                        {video.title}
                                    </p>
                                    <p className="flex items-center gap-1 text-xs text-white/40">
                                        {video.mobile && (
                                            <Smartphone className="size-3" />
                                        )}
                                        {video.desktop && (
                                            <Monitor className="size-3" />
                                        )}
                                        {!video.is_active && tr('приховано')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/admin/design/videos/${video.id}/toggle`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    aria-label={
                                        video.is_active
                                            ? tr('Приховати')
                                            : tr('Показати')
                                    }
                                    className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-[var(--gc-l3)] hover:text-white"
                                >
                                    {video.is_active ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (
                                            confirm(
                                                tr(
                                                    'Видалити відеофон? У тих, хто його обрав, повернеться звичайний фон.',
                                                ),
                                            )
                                        )
                                            router.delete(
                                                `/admin/design/videos/${video.id}`,
                                                { preserveScroll: true },
                                            );
                                    }}
                                    aria-label={tr('Видалити')}
                                    className="flex size-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-[var(--gc-l3)] hover:text-red-400"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <form
                key={key}
                onSubmit={submit}
                className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
                <div className="flex flex-col gap-1.5">
                    <Input
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                        placeholder={tr('Назва, напр. «Неонове місто»')}
                        maxLength={60}
                    />
                    <InputError message={form.errors.title} />
                </div>
                {files.map((file) => (
                    <label
                        key={file.name}
                        className="gc-solid-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/80 transition hover:text-white"
                    >
                        <file.icon className="size-4 shrink-0 text-white/50" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate">
                                {form.data[file.name]?.name ?? file.label}
                            </span>
                            <span className="block truncate text-xs text-white/40">
                                {form.errors[file.name] ?? file.hint}
                            </span>
                        </span>
                        <input
                            type="file"
                            accept={file.accept}
                            className="sr-only"
                            onChange={(e) =>
                                form.setData(
                                    file.name,
                                    e.target.files?.[0] ?? null,
                                )
                            }
                        />
                    </label>
                ))}
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        !form.data.title.trim() ||
                        (!form.data.mobile && !form.data.desktop)
                    }
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition disabled:opacity-40 sm:col-span-2 lg:col-span-4 lg:justify-self-start"
                >
                    <Upload className="size-4" />
                    {form.progress
                        ? `${form.progress.percentage ?? 0}%`
                        : tr('Додати відеофон')}
                </button>
            </form>
        </section>
    );
}

/**
 * Посилання на застосунок: магазини й пряме завантаження. Порожнє поле — кнопки на сайті не видно;
 * якщо не заповнено жодного, ховається й картка «Офіційний застосунок» у меню.
 */
function AppLinksCard({
    links,
    files,
    types,
}: {
    links: Partial<Record<StoreKey, string>>;
    files: Partial<Record<DirectKey, AppFile>>;
    types: Record<DirectKey, string[]>;
}) {
    const all = [...MOBILE_STORES, ...DESKTOP_STORES];
    const form = useForm<Record<StoreKey, string>>(
        Object.fromEntries(all.map((k) => [k, links[k] ?? ''])) as Record<
            StoreKey,
            string
        >,
    );
    const hints: Partial<Record<StoreKey, string>> = {
        google_play:
            'https://play.google.com/store/apps/details?id=online.gamecon.app',
        app_store: 'https://apps.apple.com/app/…/id…',
        microsoft_store: 'https://apps.microsoft.com/detail/…',
        apk: 'https://gamecon.online/downloads/gamecon.apk',
        windows: 'https://…/GameCon-Setup.exe',
        macos: 'https://…/GameCon.dmg',
        linux: 'https://…/gamecon.deb',
    };
    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/design/app-links', { preserveScroll: true });
    };
    const isDirect = (key: StoreKey): key is DirectKey => key in types;
    const field = (key: StoreKey) => (
        <div key={key} className="grid content-start gap-1.5">
            <label
                htmlFor={`app-${key}`}
                className="flex items-center gap-2 text-sm font-medium text-white/85"
            >
                {STORES[key].mark()}
                {STORES[key].name}
            </label>
            {isDirect(key) && files[key] ? (
                <p className="text-xs text-white/45">
                    {tr(
                        'Використовується завантажений файл; посилання не потрібне.',
                    )}
                </p>
            ) : (
                <Input
                    id={`app-${key}`}
                    type="url"
                    inputMode="url"
                    value={form.data[key]}
                    onChange={(e) => form.setData(key, e.target.value)}
                    placeholder={
                        isDirect(key)
                            ? tr('Посилання або завантажте файл нижче')
                            : (hints[key] ?? 'https://…')
                    }
                    maxLength={500}
                />
            )}
            <InputError message={form.errors[key]} />
            {isDirect(key) && (
                <AppFileUpload
                    platform={key}
                    file={files[key] ?? null}
                    accept={types[key]}
                />
            )}
        </div>
    );

    return (
        <form onSubmit={submit} className="gc-solid mb-5 rounded-2xl p-4">
            <div className="flex items-center gap-3">
                <span className="gc-solid-2 flex size-11 items-center justify-center rounded-2xl text-white">
                    <Smartphone className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold text-white">
                        {tr('Застосунок і магазини')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Посилання для сторінки /app і картки «Офіційний застосунок» у меню. Порожнє поле — кнопки не видно.',
                        )}
                    </p>
                </div>
            </div>
            <p className="mt-4 mb-2 text-xs font-semibold text-white/50">
                {tr('Телефон і планшет')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                {MOBILE_STORES.map(field)}
            </div>
            <p className="mt-5 mb-2 text-xs font-semibold text-white/50">
                {tr('Комп’ютер: магазин і пряме завантаження')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                {DESKTOP_STORES.map(field)}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={form.processing}
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {tr('Зберегти посилання')}
                </button>
                <a
                    href="/app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-sky-400 hover:underline"
                >
                    {tr('Відкрити сторінку застосунку')}
                </a>
            </div>
        </form>
    );
}

/**
 * Файл для прямого завантаження: вантажимо частинами по 4 МБ (до 1 ГБ), сервер складає й перевіряє файл
 * і віддає його на сторінці /app замість посилання. Показує прогрес, розмір, дату й SHA-256.
 */
function AppFileUpload({
    platform,
    file,
    accept,
}: {
    platform: DirectKey;
    file: AppFile | null;
    accept: string[];
}) {
    const input = useRef<HTMLInputElement>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sendChunk = (
        body: FormData,
        onProgress: (loaded: number) => void,
    ): Promise<{ done: boolean }> =>
        new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/admin/design/app-files/${platform}`);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.setRequestHeader('X-XSRF-TOKEN', xsrfToken());
            xhr.upload.onprogress = (e) => onProgress(e.loaded);
            xhr.onload = () => {
                let payload: {
                    done?: boolean;
                    message?: string;
                    errors?: Record<string, string[]>;
                } = {};
                try {
                    payload = JSON.parse(xhr.responseText);
                } catch {
                    // відповідь не JSON (наприклад, 413 від nginx)
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    return resolve({ done: Boolean(payload.done) });
                }
                const first = payload.errors
                    ? Object.values(payload.errors)[0]?.[0]
                    : undefined;
                reject(
                    new Error(
                        first ??
                            payload.message ??
                            tr('Не вдалося завантажити файл.'),
                    ),
                );
            };
            xhr.onerror = () => reject(new Error(tr('Немає з’єднання.')));
            xhr.send(body);
        });

    const upload = async (picked: File) => {
        setError(null);
        setProgress(0);
        const total = Math.max(1, Math.ceil(picked.size / CHUNK_BYTES));
        const id = crypto.randomUUID();
        try {
            for (let i = 0; i < total; i++) {
                const body = new FormData();
                body.append('upload_id', id);
                body.append('index', String(i));
                body.append('total', String(total));
                body.append('name', picked.name);
                body.append(
                    'chunk',
                    picked.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES),
                    'chunk',
                );
                // Одна частина може не дійти через мережу — пробуємо ще двічі.
                for (let attempt = 0; ; attempt++) {
                    try {
                        await sendChunk(body, (loaded) =>
                            setProgress(
                                Math.min(
                                    1,
                                    (i * CHUNK_BYTES + loaded) / picked.size,
                                ),
                            ),
                        );
                        break;
                    } catch (e) {
                        if (
                            attempt >= 2 ||
                            (e as Error).message !== tr('Немає з’єднання.')
                        ) {
                            throw e;
                        }
                    }
                }
            }
            router.reload({ only: ['appFiles', 'appLinks'] });
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setProgress(null);
            if (input.current) input.current.value = '';
        }
    };

    const remove = () => {
        if (!confirm(tr('Видалити файл? Кнопка зникне, якщо немає посилання.')))
            return;
        router.delete(`/admin/design/app-files/${platform}`, {
            preserveScroll: true,
            only: ['appFiles', 'appLinks', 'flash'],
        });
    };

    return (
        <div className="gc-solid-2 mt-1 rounded-xl p-3">
            {file ? (
                <div className="flex items-start gap-2">
                    <Download className="mt-0.5 size-4 shrink-0 text-sky-400" />
                    <div className="min-w-0 flex-1 text-xs">
                        <a
                            href={file.url}
                            className="block font-medium break-all text-white hover:underline"
                        >
                            {file.name}
                        </a>
                        <p className="mt-0.5 text-white/50 tabular-nums">
                            {formatBytes(file.size)}
                            {file.uploaded_at &&
                                ` · ${new Date(file.uploaded_at).toLocaleString()}`}
                        </p>
                        <p
                            className="mt-0.5 font-mono text-[11px] break-all text-white/40"
                            title="SHA-256"
                        >
                            SHA-256 {file.sha256}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={remove}
                        aria-label={tr('Видалити файл')}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-[var(--gc-l3)] hover:text-rose-400"
                    >
                        <Trash2 className="size-4" />
                    </button>
                </div>
            ) : (
                <p className="text-xs text-white/45">
                    {tr('Файл не завантажено. Підходять: {types}, до 1 ГБ.', {
                        types: accept.join(', '),
                    })}
                </p>
            )}
            {progress !== null && (
                <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-sky-500 transition-[width]"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-xs text-white/50 tabular-nums">
                        {tr('Завантаження {percent}%', {
                            percent: Math.round(progress * 100),
                        })}
                    </p>
                </div>
            )}
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
            <input
                ref={input}
                type="file"
                accept={accept.join(',')}
                className="hidden"
                onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) void upload(picked);
                }}
            />
            <button
                type="button"
                disabled={progress !== null}
                onClick={() => input.current?.click()}
                className="mt-2 flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sky-400 transition hover:bg-[var(--gc-l3)] disabled:opacity-50"
            >
                <Upload className="size-4" />
                {file ? tr('Замінити файл') : tr('Завантажити файл')}
            </button>
        </div>
    );
}

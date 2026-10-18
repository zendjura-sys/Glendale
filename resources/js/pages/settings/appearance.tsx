import { Head, useForm, usePage } from '@inertiajs/react';
import {
    Bell,
    Check,
    ChevronDown,
    ChevronUp,
    Eye,
    Languages,
    Moon,
    UsersRound,
    Youtube,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import AppearanceController from '@/actions/App/Http/Controllers/Settings/AppearanceController';
import { PlusBadge } from '@/components/gc/plus';
import { UserAvatar } from '@/components/gc/user-avatar';
import { ModeCard } from '@/components/modes/mode-card';
import { countChanges, PendingBar } from '@/components/settings/pending-bar';
import { SettingsCard } from '@/layouts/settings/layout';
import {
    applyTextSize,
    readTextSize,
    saveTextSize,
    TEXT_SIZES,
    type TextSize,
} from '@/lib/device-prefs';
import {
    BACKGROUNDS,
    setBackgroundPreview,
    youtubeId,
} from '@/lib/backgrounds';
import { tr } from '@/lib/i18n';
import type { NetworkMode } from '@/lib/modes';
import { SKINS } from '@/lib/skins';
import { motionOr, POP, SNAP } from '@/lib/motion';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type {
    SiteBackgroundPreset,
    SiteBackgroundPrefs,
    UserCard,
} from '@/types';

type PaletteOption = { id: string; name: string; colors: string[] };

const BLOCK_LABELS: Record<string, string> = {
    platforms: 'Платформи',
    steam: 'Бібліотека Steam',
    about: 'Про себе',
    achievements: 'Досягнення',
    characters: 'Персонажі RP',
    audio: 'Аудіозаписи',
    friends: 'Друзі',
    photos: 'Фото',
};

type NotifyPrefs = {
    likes: boolean;
    comments: boolean;
    mentions: boolean;
    events: boolean;
    playing: boolean;
    site: boolean;
    email: boolean;
    push: boolean;
};

const NOTIFY_TYPES: { key: keyof NotifyPrefs; label: string }[] = [
    { key: 'likes', label: 'Лайки' },
    { key: 'comments', label: 'Коментарі' },
    { key: 'mentions', label: 'Згадки' },
    { key: 'events', label: 'Події' },
    { key: 'playing', label: 'Друзі в грі' },
];

const NOTIFY_CHANNELS: { key: keyof NotifyPrefs; label: string }[] = [
    { key: 'site', label: 'На сайті' },
    { key: 'email', label: 'Пошта' },
    { key: 'push', label: 'Push' },
];

type Form = {
    palette: string;
    quiet_enabled: boolean;
    quiet_from: string;
    quiet_to: string;
    languages: string[];
    looking_for_group: boolean;
    close_friends: number[];
    show_visitors: boolean;
    profile_blocks: string[];
    notify: NotifyPrefs;
    mute_words: string[];
    hide_spoilers: boolean;
    background: SiteBackgroundPreset;
    background_motion: boolean;
    background_video: string;
    network_mode: string;
    skin: string;
    seasonal: boolean;
};

export default function Appearance({
    palette,
    palettes,
    quiet,
    languages,
    looking_for_group,
    show_visitors,
    profile_blocks,
    languageOptions,
    friends,
    closeFriends,
    notify,
    muteWords,
    hideSpoilers,
    background,
    isPlus,
    modes,
    networkMode,
    moduleNames,
    skin,
    seasonal,
}: {
    palette: string;
    palettes: PaletteOption[];
    quiet: { enabled: boolean; from: string; to: string };
    languages: string[];
    looking_for_group: boolean;
    show_visitors: boolean;
    profile_blocks: string[];
    languageOptions: { code: string; native: string }[];
    friends: UserCard[];
    closeFriends: number[];
    notify: NotifyPrefs;
    muteWords: string[];
    hideSpoilers: boolean;
    background: SiteBackgroundPrefs;
    isPlus: boolean;
    modes: NetworkMode[];
    networkMode: string;
    moduleNames: Record<string, string>;
    skin: string;
    seasonal: boolean;
}) {
    const palettesOn = usePlugin('palettes');
    const quietOn = usePlugin('quiet_hours');
    const notifyOn = usePlugin('notify_switches');
    const mutedOn = usePlugin('muted_words');
    const spoilersOn = usePlugin('spoiler_switch');
    const languagesOn = usePlugin('spoken_languages');
    const visitorsOn = usePlugin('profile_visitors');
    const orderOn = usePlugin('profile_order');
    const groupOn = usePlugin('looking_for_group');
    const form = useForm<Form>({
        palette,
        quiet_enabled: quiet.enabled,
        quiet_from: quiet.from,
        quiet_to: quiet.to,
        languages,
        looking_for_group,
        close_friends: closeFriends,
        show_visitors,
        profile_blocks,
        notify,
        mute_words: muteWords,
        hide_spoilers: hideSpoilers,
        background: background.preset,
        background_motion: background.motion,
        background_video: background.video
            ? `https://youtu.be/${background.video}`
            : '',
        network_mode: networkMode,
        skin,
        seasonal,
    });
    const [phrase, setPhrase] = useState('');
    const reduce = useReducedMotion();
    const user = usePage().props.auth.user;
    const savedSkin = useRef(skin);
    // Збережений стан: від нього рахуються незбережені зміни й до нього повертає «Скасувати».
    const [saved, setSaved] = useState(form.data);
    const [textSize, setTextSize] = useState<TextSize>(readTextSize);
    const [savedText, setSavedText] = useState<TextSize>(readTextSize);
    const changes =
        countChanges(form.data, saved) + (textSize !== savedText ? 1 : 0);

    // Пішли зі сторінки, не зберігши, — розмір тексту повертається до збереженого.
    useEffect(() => () => applyTextSize(readTextSize()), []);

    // Фон сайту змінюється одразу (попередній перегляд); піти без «Зберегти» — повернеться збережений.
    useEffect(() => {
        setBackgroundPreview({
            preset: form.data.background,
            motion: form.data.background_motion,
            video: isPlus ? youtubeId(form.data.background_video) : null,
        });
    }, [
        form.data.background,
        form.data.background_motion,
        form.data.background_video,
        isPlus,
    ]);
    useEffect(() => () => setBackgroundPreview(null), []);
    // Пішли без «Зберегти» — повертається збережений стиль.
    useEffect(
        () => () => {
            document.documentElement.dataset.skin = savedSkin.current;
        },
        [],
    );

    const pickSkin = (id: string) => {
        document.documentElement.dataset.skin = id;
        form.setData((data) => ({
            ...data,
            skin: id,
            // Material іде в парі з «Авророю» (як у задумі стилю); фон можна змінити окремо.
            background:
                id === 'material' && !youtubeId(data.background_video)
                    ? 'aurora'
                    : data.background,
        }));
    };

    const previewText = (size: TextSize) => {
        setTextSize(size);
        applyTextSize(size);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (textSize !== savedText) {
            saveTextSize(textSize);
            setSavedText(textSize);
        }
        if (countChanges(form.data, saved) === 0) return;
        form.submit(AppearanceController.update(), {
            preserveScroll: true,
            onSuccess: () => {
                setSaved(form.data);
                savedSkin.current = form.data.skin;
            },
        });
    };

    const discard = () => {
        form.setData(saved);
        form.clearErrors();
        document.documentElement.dataset.palette = saved.palette;
        document.documentElement.dataset.skin = saved.skin;
        previewText(savedText);
    };

    const pick = (id: string) => {
        form.setData('palette', id);
        document.documentElement.dataset.palette = id;
    };

    const toggleLanguage = (code: string) => {
        const next = form.data.languages.includes(code)
            ? form.data.languages.filter((item) => item !== code)
            : [...form.data.languages, code];
        form.setData('languages', next);
    };

    return (
        <>
            <Head title={tr('Вигляд')} />
            <form id="appearance-form" onSubmit={submit} className="space-y-4">
                {/* Живий попередній перегляд: палітра й розмір тексту змінюються тут одразу. */}
                <div className="liquid-glass overflow-hidden rounded-3xl p-5 sm:p-6">
                    <span aria-hidden className="liquid-glass__glare" />
                    <p className="text-xs text-white/40">
                        {tr('Попередній перегляд — зміни видно одразу')}
                    </p>
                    <div className="mt-4 flex items-start gap-3">
                        {user && <UserAvatar user={user} size="md" />}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">
                                {user?.name ?? 'GameCon'}
                            </p>
                            <p className="mt-1 text-[15px] leading-relaxed text-white/75">
                                {tr(
                                    'Збираємо паті на вечір: хто з нами? Після гри — кіно разом.',
                                )}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground">
                                    {tr('Я в ділі')}
                                </span>
                                <span className="inline-flex h-8 items-center rounded-full border border-white/15 px-3.5 text-xs font-medium text-white/70">
                                    {tr('Пізніше')}
                                </span>
                                <span className="text-xs font-medium text-primary">
                                    {tr('12 відповідей')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <SettingsCard
                    title={tr('Стиль інтерфейсу')}
                    description={tr(
                        'Ті самі розділи й іконки — інша «оболонка». Видно одразу, збережіть, якщо подобається.',
                    )}
                >
                    <div
                        role="radiogroup"
                        aria-label={tr('Стиль інтерфейсу')}
                        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
                    >
                        {SKINS().map((item) => {
                            const active = form.data.skin === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => pickSkin(item.id)}
                                    className="group flex flex-col justify-start text-left"
                                >
                                    <span
                                        className={cn(
                                            'skin-thumb relative block aspect-[4/3] overflow-hidden rounded-2xl ring-1 transition',
                                            `skin-thumb--${item.id}`,
                                            active
                                                ? 'ring-2 ring-primary'
                                                : 'ring-white/10 group-hover:ring-white/30',
                                        )}
                                    >
                                        <span className="skin-thumb__card" />
                                        <span className="skin-thumb__button" />
                                        {active && (
                                            <m.span
                                                initial={
                                                    reduce
                                                        ? false
                                                        : {
                                                              scale: 0.4,
                                                              opacity: 0,
                                                          }
                                                }
                                                animate={{
                                                    scale: 1,
                                                    opacity: 1,
                                                }}
                                                transition={motionOr(
                                                    reduce,
                                                    POP,
                                                )}
                                                className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                            >
                                                <Check className="size-3.5" />
                                            </m.span>
                                        )}
                                    </span>
                                    <span className="mt-2 block text-sm font-medium text-white">
                                        {item.name}
                                    </span>
                                    <span className="block text-xs text-white/45">
                                        {item.hint}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </SettingsCard>

                <SettingsCard
                    title={tr('Режим соцмережі')}
                    description={tr(
                        'Які розділи бачити в меню й стрічці. Нічого не видаляється — змініть будь-коли.',
                    )}
                >
                    <div
                        role="radiogroup"
                        aria-label={tr('Режим соцмережі')}
                        className="grid gap-2.5 sm:grid-cols-2"
                    >
                        {modes.map((mode) => (
                            <ModeCard
                                key={mode.id}
                                mode={mode}
                                compact
                                active={form.data.network_mode === mode.id}
                                onSelect={() =>
                                    form.setData('network_mode', mode.id)
                                }
                                moduleNames={moduleNames}
                                allModules={Object.keys(moduleNames)}
                                layoutId="settings-mode"
                            />
                        ))}
                    </div>
                </SettingsCard>

                <SettingsCard
                    title={tr('Фон')}
                    description={tr(
                        'Жива сцена за інтерфейсом. Видно одразу — збережіть, якщо подобається.',
                    )}
                >
                    <div
                        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                        role="radiogroup"
                        aria-label={tr('Фон')}
                    >
                        {BACKGROUNDS().map((item) => {
                            const active =
                                form.data.background === item.id &&
                                !youtubeId(form.data.background_video);

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    // Вибір сцени замінює відеофон (порожнє поле посилання).
                                    onClick={() =>
                                        form.setData((data) => ({
                                            ...data,
                                            background: item.id,
                                            background_video: '',
                                        }))
                                    }
                                    className="group flex flex-col justify-start text-left"
                                >
                                    <span
                                        className={cn(
                                            'bg-thumb relative block aspect-[16/10] overflow-hidden rounded-2xl ring-1 transition',
                                            `bg-thumb--${item.id}`,
                                            active
                                                ? 'ring-2 ring-primary'
                                                : 'ring-white/10 group-hover:ring-white/30',
                                        )}
                                    >
                                        {active && (
                                            <m.span
                                                initial={
                                                    reduce
                                                        ? false
                                                        : {
                                                              scale: 0.4,
                                                              opacity: 0,
                                                          }
                                                }
                                                animate={{
                                                    scale: 1,
                                                    opacity: 1,
                                                }}
                                                transition={motionOr(
                                                    reduce,
                                                    POP,
                                                )}
                                                className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                            >
                                                <Check className="size-3.5" />
                                            </m.span>
                                        )}
                                    </span>
                                    <span className="mt-2 block text-sm font-medium text-white">
                                        {item.name}
                                    </span>
                                    <span className="block text-xs text-white/45">
                                        {item.hint}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <label className="mt-5 flex min-h-11 items-center gap-3 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={form.data.background_motion}
                            onChange={(e) =>
                                form.setData(
                                    'background_motion',
                                    e.target.checked,
                                )
                            }
                            className="gc-switch"
                        />
                        {tr('Рухомий фон')}
                        <span className="text-xs text-white/40">
                            {tr('вимкніть, щоб сцена стояла нерухомо')}
                        </span>
                    </label>

                    <label className="mt-2 flex min-h-11 items-center gap-3 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={form.data.seasonal}
                            onChange={(e) =>
                                form.setData('seasonal', e.target.checked)
                            }
                            className="gc-switch"
                        />
                        {tr('Святкові прикраси')}
                        <span className="text-xs text-white/40">
                            {tr('сніг на Новий рік, писанки на Великдень…')}
                        </span>
                    </label>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                            <Youtube className="size-4 text-[#ff4e45]" />
                            {tr('Відео з YouTube як фон')}
                            <PlusBadge className="size-4" />
                        </div>
                        <p className="mt-1 text-xs text-white/45">
                            {isPlus
                                ? tr(
                                      'Вставте посилання — відео гратиме без звуку по колу замість сцени. Порожнє поле — повернути сцену.',
                                  )
                                : tr('Власний відеофон — привілей GameCon+.')}
                        </p>
                        <input
                            type="url"
                            inputMode="url"
                            value={form.data.background_video}
                            onChange={(e) =>
                                form.setData('background_video', e.target.value)
                            }
                            disabled={!isPlus && !form.data.background_video}
                            placeholder="https://youtu.be/…"
                            aria-label={tr('Посилання на відео YouTube')}
                            className="input-glass mt-3 h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
                        />
                        {form.errors.background_video && (
                            <p className="mt-2 text-xs text-rose-300">
                                {form.errors.background_video}
                            </p>
                        )}
                        {!isPlus && (
                            <a
                                href="/plus"
                                className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                            >
                                {tr('Дізнатися про GameCon+')}
                            </a>
                        )}
                    </div>
                </SettingsCard>

                <SettingsCard
                    title={tr('Розмір тексту')}
                    description={tr(
                        'Для цього пристрою: на телефоні й комп’ютері можна різний.',
                    )}
                >
                    <div
                        className="grid grid-cols-4 gap-2"
                        role="radiogroup"
                        aria-label={tr('Розмір тексту')}
                    >
                        {TEXT_SIZES.map((size, i) => {
                            const active = textSize === size;

                            return (
                                <button
                                    key={size}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => previewText(size)}
                                    className={cn(
                                        'relative flex h-14 items-center justify-center rounded-2xl transition-colors',
                                        active
                                            ? 'text-white'
                                            : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white',
                                    )}
                                >
                                    {active && (
                                        <m.span
                                            layoutId="text-size-active"
                                            transition={motionOr(reduce, SNAP)}
                                            className="absolute inset-0 rounded-2xl border border-primary/60 bg-primary/10"
                                        />
                                    )}
                                    <span
                                        className="relative font-semibold"
                                        style={{ fontSize: `${13 + i * 3}px` }}
                                    >
                                        Aa
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </SettingsCard>

                {palettesOn && (
                    <SettingsCard
                        title={tr('Палітра')}
                        description={tr(
                            'Колір кнопок, меню і підсвітки. Фон лишається темним.',
                        )}
                    >
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {palettes.map((item) => {
                                const active = form.data.palette === item.id;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => pick(item.id)}
                                        aria-pressed={active}
                                        className={cn(
                                            'flex min-h-11 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                                            active
                                                ? 'border-white/30 bg-white/[0.08]'
                                                : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]',
                                        )}
                                    >
                                        <span
                                            className="flex size-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15"
                                            aria-hidden
                                        >
                                            {item.colors.map((color) => (
                                                <span
                                                    key={color}
                                                    className="h-full flex-1"
                                                    style={{
                                                        background: color,
                                                    }}
                                                />
                                            ))}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-white">
                                                {item.name}
                                            </span>
                                        </span>
                                        {active && (
                                            <m.span
                                                initial={
                                                    reduce
                                                        ? false
                                                        : {
                                                              scale: 0,
                                                              rotate: -45,
                                                          }
                                                }
                                                animate={{
                                                    scale: 1,
                                                    rotate: 0,
                                                }}
                                                transition={motionOr(
                                                    reduce,
                                                    POP,
                                                )}
                                                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary"
                                            >
                                                <Check className="size-3 text-primary-foreground" />
                                            </m.span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </SettingsCard>
                )}

                {quietOn && (
                    <SettingsCard
                        title={tr('Тихі години')}
                        description={tr(
                            'Лайки, коментарі й заявки в друзі не приходять у цей час. Нагадування про події лишаються.',
                        )}
                    >
                        <label className="flex min-h-11 items-center gap-3 text-sm text-white">
                            <input
                                type="checkbox"
                                checked={form.data.quiet_enabled}
                                onChange={(e) =>
                                    form.setData(
                                        'quiet_enabled',
                                        e.target.checked,
                                    )
                                }
                                className="gc-switch"
                            />
                            <Moon className="size-4 text-white/50" />
                            {tr('Не турбувати вночі')}
                        </label>
                        <div className="mt-3 flex flex-wrap gap-3">
                            <label className="text-xs text-white/50">
                                {tr('Від')}
                                <input
                                    type="time"
                                    value={form.data.quiet_from}
                                    onChange={(e) =>
                                        form.setData(
                                            'quiet_from',
                                            e.target.value,
                                        )
                                    }
                                    className="input-glass mt-1 block h-11 rounded-xl px-3 text-sm text-white"
                                />
                            </label>
                            <label className="text-xs text-white/50">
                                {tr('До')}
                                <input
                                    type="time"
                                    value={form.data.quiet_to}
                                    onChange={(e) =>
                                        form.setData('quiet_to', e.target.value)
                                    }
                                    className="input-glass mt-1 block h-11 rounded-xl px-3 text-sm text-white"
                                />
                            </label>
                        </div>
                    </SettingsCard>
                )}

                {notifyOn && (
                    <SettingsCard
                        title={tr('Сповіщення')}
                        description={tr(
                            'Лайки, коментарі, згадки, події й друзі в грі. Сайт, пошта і push вмикаються окремо.',
                        )}
                    >
                        <div className="grid gap-2 sm:grid-cols-2">
                            {NOTIFY_TYPES.map((item) => (
                                <label
                                    key={item.key}
                                    className="flex min-h-11 items-center gap-3 text-sm text-white"
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.data.notify[item.key]}
                                        onChange={(e) =>
                                            form.setData('notify', {
                                                ...form.data.notify,
                                                [item.key]: e.target.checked,
                                            })
                                        }
                                        className="gc-switch"
                                    />
                                    {tr(item.label)}
                                </label>
                            ))}
                        </div>
                        <p className="mt-4 mb-2 flex items-center gap-2 text-xs text-white/45">
                            <Bell className="size-3.5" />
                            {tr('Куди надсилати')}
                        </p>
                        <div className="flex flex-wrap gap-4">
                            {NOTIFY_CHANNELS.map((item) => (
                                <label
                                    key={item.key}
                                    className="flex min-h-11 items-center gap-3 text-sm text-white"
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.data.notify[item.key]}
                                        onChange={(e) =>
                                            form.setData('notify', {
                                                ...form.data.notify,
                                                [item.key]: e.target.checked,
                                            })
                                        }
                                        className="gc-switch"
                                    />
                                    {tr(item.label)}
                                </label>
                            ))}
                        </div>
                    </SettingsCard>
                )}

                {(mutedOn || spoilersOn) && (
                    <SettingsCard
                        title={tr('Заглушені слова')}
                        description={tr(
                            'Записи з цими словами зникають зі стрічки, а сповіщення про них не приходять.',
                        )}
                    >
                        {spoilersOn && (
                            <label className="mb-3 flex min-h-11 items-center gap-3 text-sm text-white">
                                <input
                                    type="checkbox"
                                    checked={form.data.hide_spoilers}
                                    onChange={(event) =>
                                        form.setData(
                                            'hide_spoilers',
                                            event.target.checked,
                                        )
                                    }
                                    className="gc-switch"
                                />
                                {tr('Ховати спойлери на всьому сайті')}
                            </label>
                        )}
                        {mutedOn && (
                            <>
                                <div className="flex gap-2">
                                    <input
                                        value={phrase}
                                        onChange={(event) =>
                                            setPhrase(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter') {
                                                return;
                                            }
                                            event.preventDefault();
                                            const next = phrase.trim();
                                            if (
                                                !next ||
                                                form.data.mute_words.includes(
                                                    next,
                                                ) ||
                                                form.data.mute_words.length >=
                                                    20
                                            ) {
                                                return;
                                            }
                                            form.setData('mute_words', [
                                                ...form.data.mute_words,
                                                next,
                                            ]);
                                            setPhrase('');
                                        }}
                                        maxLength={40}
                                        placeholder={tr('Слово або фраза')}
                                        className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3 text-sm text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = phrase.trim();
                                            if (
                                                !next ||
                                                form.data.mute_words.includes(
                                                    next,
                                                ) ||
                                                form.data.mute_words.length >=
                                                    20
                                            ) {
                                                return;
                                            }
                                            form.setData('mute_words', [
                                                ...form.data.mute_words,
                                                next,
                                            ]);
                                            setPhrase('');
                                        }}
                                        className="rounded-xl bg-white/10 px-4 text-sm font-medium text-white"
                                    >
                                        {tr('Додати')}
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {form.data.mute_words.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() =>
                                                form.setData(
                                                    'mute_words',
                                                    form.data.mute_words.filter(
                                                        (word) => word !== item,
                                                    ),
                                                )
                                            }
                                            className="min-h-11 rounded-full bg-white/[0.06] px-3 text-sm text-white/80"
                                        >
                                            {item} ×
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </SettingsCard>
                )}

                {(groupOn || visitorsOn || languagesOn) && (
                    <SettingsCard
                        title={tr('Як тебе бачать')}
                        description={tr(
                            'Мови спілкування і прапорець для тих, хто шукає групу.',
                        )}
                    >
                        {groupOn && (
                            <label className="flex min-h-11 items-center gap-3 text-sm text-white">
                                <input
                                    type="checkbox"
                                    checked={form.data.looking_for_group}
                                    onChange={(e) =>
                                        form.setData(
                                            'looking_for_group',
                                            e.target.checked,
                                        )
                                    }
                                    className="gc-switch"
                                />
                                <UsersRound className="size-4 text-white/50" />
                                {tr('Шукаю групу')}
                            </label>
                        )}
                        {visitorsOn && (
                            <label className="mt-2 flex min-h-11 items-center gap-3 text-sm text-white">
                                <input
                                    type="checkbox"
                                    checked={form.data.show_visitors}
                                    onChange={(e) =>
                                        form.setData(
                                            'show_visitors',
                                            e.target.checked,
                                        )
                                    }
                                    className="gc-switch"
                                />
                                <Eye className="size-4 text-white/50" />
                                {tr('Хто заходив')}
                            </label>
                        )}
                        {languagesOn && (
                            <>
                                <p className="mt-4 mb-2 flex items-center gap-2 text-xs text-white/45">
                                    <Languages className="size-3.5" />
                                    {tr('Мови, якими говорю')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {languageOptions.map((language) => {
                                        const on = form.data.languages.includes(
                                            language.code,
                                        );

                                        return (
                                            <button
                                                key={language.code}
                                                type="button"
                                                onClick={() =>
                                                    toggleLanguage(
                                                        language.code,
                                                    )
                                                }
                                                aria-pressed={on}
                                                className={cn(
                                                    'min-h-11 rounded-full px-3 text-sm',
                                                    on
                                                        ? 'bg-white text-gc-ink'
                                                        : 'bg-white/[0.06] text-white/75',
                                                )}
                                            >
                                                {language.native}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </SettingsCard>
                )}

                <SettingsCard
                    title={tr('Близькі')}
                    description={tr(
                        'Лише вони бачать історії з позначкою «Близьким».',
                    )}
                >
                    <div className="flex flex-wrap gap-2">
                        {friends.length === 0 && (
                            <p className="text-sm text-white/45">
                                {tr('Спершу додайте друзів.')}
                            </p>
                        )}
                        {friends.map((friend) => {
                            const on = form.data.close_friends.includes(
                                friend.id,
                            );

                            return (
                                <button
                                    key={friend.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                        form.setData(
                                            'close_friends',
                                            on
                                                ? form.data.close_friends.filter(
                                                      (id) => id !== friend.id,
                                                  )
                                                : [
                                                      ...form.data
                                                          .close_friends,
                                                      friend.id,
                                                  ].slice(0, 30),
                                        )
                                    }
                                    className={cn(
                                        'min-h-11 rounded-full px-3 text-sm',
                                        on
                                            ? 'bg-white text-gc-ink'
                                            : 'bg-white/[0.06] text-white/75',
                                    )}
                                >
                                    {friend.first_name}
                                </button>
                            );
                        })}
                    </div>
                </SettingsCard>

                {orderOn && (
                    <SettingsCard
                        title={tr('Порядок блоків')}
                        description={tr('Як блоки стоять на вашій сторінці.')}
                    >
                        <div className="space-y-2">
                            {form.data.profile_blocks.map((key, index) => (
                                <div
                                    key={key}
                                    className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/[0.04] px-3"
                                >
                                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                                        {tr(BLOCK_LABELS[key] ?? key)}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={tr('Вище')}
                                        disabled={index === 0}
                                        onClick={() => {
                                            const next = [
                                                ...form.data.profile_blocks,
                                            ];
                                            [next[index - 1], next[index]] = [
                                                next[index],
                                                next[index - 1],
                                            ];
                                            form.setData(
                                                'profile_blocks',
                                                next,
                                            );
                                        }}
                                        className="inline-flex size-9 items-center justify-center rounded-xl text-white/70 disabled:opacity-30"
                                    >
                                        <ChevronUp className="size-4" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={tr('Нижче')}
                                        disabled={
                                            index ===
                                            form.data.profile_blocks.length - 1
                                        }
                                        onClick={() => {
                                            const next = [
                                                ...form.data.profile_blocks,
                                            ];
                                            [next[index + 1], next[index]] = [
                                                next[index],
                                                next[index + 1],
                                            ];
                                            form.setData(
                                                'profile_blocks',
                                                next,
                                            );
                                        }}
                                        className="inline-flex size-9 items-center justify-center rounded-xl text-white/70 disabled:opacity-30"
                                    >
                                        <ChevronDown className="size-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </SettingsCard>
                )}
            </form>
            <PendingBar
                count={changes}
                processing={form.processing}
                onDiscard={discard}
                form="appearance-form"
            />
        </>
    );
}

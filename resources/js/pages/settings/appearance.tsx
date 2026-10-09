import { Head, useForm } from '@inertiajs/react';
import { Bell, Check, ChevronDown, ChevronUp, Eye, Languages, Moon, UsersRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import AppearanceController from '@/actions/App/Http/Controllers/Settings/AppearanceController';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type PaletteOption = { id: string; name: string; colors: string[] };

const BLOCK_LABELS: Record<string, string> = {
    platforms: 'Платформи',
    steam: 'Бібліотека Steam',
    about: 'Про себе',
    achievements: 'Досягнення',
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
    });
    const [phrase, setPhrase] = useState('');

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.submit(AppearanceController.update(), { preserveScroll: true });
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
            <form onSubmit={submit} className="space-y-4">
                {palettesOn && <SettingsCard
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
                                                style={{ background: color }}
                                            />
                                        ))}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-white">
                                            {item.name}
                                        </span>
                                    </span>
                                    {active && (
                                        <Check className="size-4 shrink-0 text-white" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </SettingsCard>}

                {quietOn && <SettingsCard
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
                                form.setData('quiet_enabled', e.target.checked)
                            }
                            className="size-4 accent-gc-lilac-400"
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
                                    form.setData('quiet_from', e.target.value)
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
                </SettingsCard>}

                {notifyOn && <SettingsCard
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
                                    className="size-4 accent-gc-lilac-400"
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
                                    className="size-4 accent-gc-lilac-400"
                                />
                                {tr(item.label)}
                            </label>
                        ))}
                    </div>
                </SettingsCard>}

                {(mutedOn || spoilersOn) && <SettingsCard
                    title={tr('Заглушені слова')}
                    description={tr(
                        'Записи з цими словами зникають зі стрічки, а сповіщення про них не приходять.',
                    )}
                >
                    {spoilersOn && <label className="mb-3 flex min-h-11 items-center gap-3 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={form.data.hide_spoilers}
                            onChange={(event) =>
                                form.setData('hide_spoilers', event.target.checked)
                            }
                            className="size-4 accent-gc-lilac-400"
                        />
                        {tr('Ховати спойлери на всьому сайті')}
                    </label>}
                    {mutedOn && <>
                    <div className="flex gap-2">
                        <input
                            value={phrase}
                            onChange={(event) => setPhrase(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter') {
                                    return;
                                }
                                event.preventDefault();
                                const next = phrase.trim();
                                if (
                                    !next ||
                                    form.data.mute_words.includes(next) ||
                                    form.data.mute_words.length >= 20
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
                                    form.data.mute_words.includes(next) ||
                                    form.data.mute_words.length >= 20
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
                    </>}
                </SettingsCard>}

                {(groupOn || visitorsOn || languagesOn) && <SettingsCard
                    title={tr('Як тебе бачать')}
                    description={tr(
                        'Мови спілкування і прапорець для тих, хто шукає групу.',
                    )}
                >
                    {groupOn && <label className="flex min-h-11 items-center gap-3 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={form.data.looking_for_group}
                            onChange={(e) =>
                                form.setData(
                                    'looking_for_group',
                                    e.target.checked,
                                )
                            }
                            className="size-4 accent-gc-lilac-400"
                        />
                        <UsersRound className="size-4 text-white/50" />
                        {tr('Шукаю групу')}
                    </label>}
                    {visitorsOn && <label className="mt-2 flex min-h-11 items-center gap-3 text-sm text-white">
                        <input
                            type="checkbox"
                            checked={form.data.show_visitors}
                            onChange={(e) =>
                                form.setData('show_visitors', e.target.checked)
                            }
                            className="size-4 accent-gc-lilac-400"
                        />
                        <Eye className="size-4 text-white/50" />
                        {tr('Хто заходив')}
                    </label>}
                    {languagesOn && <>
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
                                    onClick={() => toggleLanguage(language.code)}
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
                    </>}
                </SettingsCard>}

                <SettingsCard
                    title={tr('Близькі')}
                    description={tr('Лише вони бачать історії з позначкою «Близьким».')}
                >
                    <div className="flex flex-wrap gap-2">
                        {friends.length === 0 && (
                            <p className="text-sm text-white/45">{tr('Спершу додайте друзів.')}</p>
                        )}
                        {friends.map((friend) => {
                            const on = form.data.close_friends.includes(friend.id);

                            return (
                                <button
                                    key={friend.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() =>
                                        form.setData(
                                            'close_friends',
                                            on
                                                ? form.data.close_friends.filter((id) => id !== friend.id)
                                                : [...form.data.close_friends, friend.id].slice(0, 30),
                                        )
                                    }
                                    className={cn(
                                        'min-h-11 rounded-full px-3 text-sm',
                                        on ? 'bg-white text-gc-ink' : 'bg-white/[0.06] text-white/75',
                                    )}
                                >
                                    {friend.first_name}
                                </button>
                            );
                        })}
                    </div>
                </SettingsCard>

                {orderOn && <SettingsCard
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
                                        const next = [...form.data.profile_blocks];
                                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                        form.setData('profile_blocks', next);
                                    }}
                                    className="inline-flex size-9 items-center justify-center rounded-xl text-white/70 disabled:opacity-30"
                                >
                                    <ChevronUp className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={tr('Нижче')}
                                    disabled={index === form.data.profile_blocks.length - 1}
                                    onClick={() => {
                                        const next = [...form.data.profile_blocks];
                                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                        form.setData('profile_blocks', next);
                                    }}
                                    className="inline-flex size-9 items-center justify-center rounded-xl text-white/70 disabled:opacity-30"
                                >
                                    <ChevronDown className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </SettingsCard>}

                <Button
                    type="submit"
                    disabled={form.processing}
                    className="h-11 rounded-xl bg-gradient-brand px-5 text-white"
                >
                    {tr('Зберегти')}
                </Button>
            </form>
        </>
    );
}

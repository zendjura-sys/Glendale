import { Head, useForm } from '@inertiajs/react';
import { Check, ChevronDown, ChevronUp, Eye, Languages, Moon, UsersRound } from 'lucide-react';
import type { FormEvent } from 'react';
import AppearanceController from '@/actions/App/Http/Controllers/Settings/AppearanceController';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';
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
}) {
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
    });

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
                </SettingsCard>

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
                </SettingsCard>

                <SettingsCard
                    title={tr('Як тебе бачать')}
                    description={tr(
                        'Мови спілкування і прапорець для тих, хто шукає групу.',
                    )}
                >
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
                            className="size-4 accent-gc-lilac-400"
                        />
                        <UsersRound className="size-4 text-white/50" />
                        {tr('Шукаю групу')}
                    </label>
                    <label className="mt-2 flex min-h-11 items-center gap-3 text-sm text-white">
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
                    </label>
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
                </SettingsCard>

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
                </SettingsCard>

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

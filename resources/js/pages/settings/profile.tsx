import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AtSign, Globe, Lock, Mail, MapPin, MessageCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { ConnectedAccounts } from '@/components/auth/connected-accounts';
import { PlayingSettingsCard } from '@/components/gc/playing';
import DeleteUser from '@/components/delete-user';
import { ListeningSwitch } from '@/components/music/listening-switch';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
    SettingsCard,
    SettingsRow,
    SettingsSwitch,
} from '@/layouts/settings/layout';
import { usePlayer } from '@/lib/player';
import { cn, floatingAboveNav } from '@/lib/utils';
import { send } from '@/routes/verification';
import type { SocialConnection } from '@/types/auth';
import { StreamSettings } from '@/components/streams/stream';
import type { StreamInfo } from '@/components/streams/stream';
import { tr } from '@/lib/i18n';
import { listWords } from '@/lib/modes';
import { useFeature } from '@/lib/plugins';

type ProfileForm = {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    status: string;
    about: string;
    city: string;
    country: string;
    birthday: string;
    gender: string;
    website: string;
    is_private: boolean;
    message_privacy: string;
    email_social: boolean;
};

type Props = {
    mustVerifyEmail: boolean;
    status?: string;
    profile: { [K in keyof ProfileForm]: ProfileForm[K] | null };
    connections: SocialConnection[];
    countries: { code: string; name: string }[];
    stream: StreamInfo | null;
};

const fieldClass =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30';

export default function Profile({
    mustVerifyEmail,
    status,
    profile,
    connections,
    countries,
    stream,
}: Props) {
    const { auth, modules } = usePage().props;
    const playing = usePlayer().current !== null;
    const playingOn = useFeature('playing');
    const form = useForm<ProfileForm>({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        username: profile.username ?? '',
        email: profile.email ?? '',
        status: profile.status ?? '',
        about: profile.about ?? '',
        city: profile.city ?? '',
        country: profile.country ?? '',
        birthday: profile.birthday ?? '',
        gender: profile.gender ?? '',
        website: profile.website ?? '',
        is_private: !!profile.is_private,
        message_privacy: profile.message_privacy ?? 'everyone',
        email_social: profile.email_social !== false,
    });
    const { data, setData, errors, processing } = form;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.submit(ProfileController.update(), {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };

    return (
        <>
            <Head title={tr('Налаштування профілю')} />

            <form onSubmit={submit} className="space-y-7">
                <SettingsCard
                    list
                    title={tr('Основне')}
                    description={tr('Так вас бачать інші учасники')}
                >
                    <SettingsRow label={tr("Ім'я")} htmlFor="first_name" stack>
                        <div className="grid w-full gap-1">
                            <Input
                                id="first_name"
                                value={data.first_name}
                                onChange={(e) =>
                                    setData('first_name', e.target.value)
                                }
                                required
                                autoComplete="given-name"
                            />
                            <InputError message={errors.first_name} />
                        </div>
                    </SettingsRow>
                    <SettingsRow
                        label={tr('Прізвище')}
                        htmlFor="last_name"
                        stack
                    >
                        <div className="grid w-full gap-1">
                            <Input
                                id="last_name"
                                value={data.last_name}
                                onChange={(e) =>
                                    setData('last_name', e.target.value)
                                }
                                autoComplete="family-name"
                            />
                            <InputError message={errors.last_name} />
                        </div>
                    </SettingsRow>
                    <SettingsRow
                        label={tr('Адреса сторінки')}
                        hint={tr(
                            'Латиниця, цифри, крапка та підкреслення. 3–32 символи.',
                        )}
                        htmlFor="username"
                        stack
                    >
                        <div className="grid w-full gap-1">
                            <div className="input-glass flex h-11 items-center rounded-xl pl-3.5 text-sm">
                                <span className="shrink-0 text-white/35">
                                    gamecon.online/
                                </span>
                                <input
                                    id="username"
                                    value={data.username}
                                    onChange={(e) =>
                                        setData(
                                            'username',
                                            e.target.value.toLowerCase(),
                                        )
                                    }
                                    className="h-full w-0 min-w-0 flex-1 bg-transparent pr-3 text-white outline-none"
                                    required
                                    maxLength={32}
                                />
                                <AtSign className="mr-3 size-4 shrink-0 text-white/25" />
                            </div>
                            <InputError message={errors.username} />
                        </div>
                    </SettingsRow>
                    <SettingsRow
                        label={tr('Короткий статус')}
                        hint={`${data.status.length}/140`}
                        htmlFor="status"
                        stack
                    >
                        <div className="grid w-full gap-1">
                            <Input
                                id="status"
                                value={data.status}
                                onChange={(e) =>
                                    setData('status', e.target.value)
                                }
                                maxLength={140}
                                placeholder={tr('Що у вас нового?')}
                            />
                            <InputError message={errors.status} />
                        </div>
                    </SettingsRow>
                    <div className="gc-row grid gap-2 py-3">
                        <label
                            htmlFor="about"
                            className="text-[15px] text-white"
                        >
                            {tr('Про себе')}
                        </label>
                        <textarea
                            id="about"
                            value={data.about}
                            onChange={(e) => setData('about', e.target.value)}
                            rows={4}
                            maxLength={2000}
                            placeholder={tr('Розкажіть про {what}', {
                                what: listWords([
                                    tr('свої захоплення'),
                                    modules.includes('games') &&
                                        tr('улюблені ігри'),
                                    modules.includes('cinema') && tr('фільми'),
                                    modules.includes('music') && tr('музику'),
                                ]),
                            })}
                            className={cn(
                                fieldClass,
                                'resize-y py-3 leading-relaxed',
                            )}
                        />
                        <InputError message={errors.about} />
                    </div>
                </SettingsCard>

                <SettingsCard
                    title={tr('Стрім')}
                    description={tr(
                        'Канал Twitch або YouTube: коли ви в ефірі, у профілі з’явиться LIVE і плеєр.',
                    )}
                >
                    <StreamSettings stream={stream} />
                </SettingsCard>

                <SettingsCard list title={tr('Особиста інформація')}>
                    <SettingsRow label={tr('Місто')} htmlFor="city" stack>
                        <div className="grid w-full gap-1">
                            <div className="relative">
                                <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                                <Input
                                    id="city"
                                    value={data.city}
                                    onChange={(e) =>
                                        setData('city', e.target.value)
                                    }
                                    className="pl-10"
                                    placeholder={tr('Київ')}
                                />
                            </div>
                            <InputError message={errors.city} />
                        </div>
                    </SettingsRow>
                    <SettingsRow label={tr('Країна')} htmlFor="country" stack>
                        <div className="grid w-full gap-1">
                            <select
                                id="country"
                                value={data.country}
                                onChange={(e) =>
                                    setData('country', e.target.value)
                                }
                                className={cn(fieldClass, 'h-11')}
                            >
                                <option value="">{tr('Не вказано')}</option>
                                {countries.map((item) => (
                                    <option key={item.code} value={item.code}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.country} />
                        </div>
                    </SettingsRow>
                    <SettingsRow
                        label={tr('Дата народження')}
                        htmlFor="birthday"
                        stack
                    >
                        <div className="grid w-full gap-1">
                            <Input
                                id="birthday"
                                type="date"
                                value={data.birthday}
                                onChange={(e) =>
                                    setData('birthday', e.target.value)
                                }
                                className="[color-scheme:dark]"
                            />
                            <InputError message={errors.birthday} />
                        </div>
                    </SettingsRow>
                    <SettingsRow label={tr('Стать')} htmlFor="gender" stack>
                        <div className="grid w-full gap-1">
                            <select
                                id="gender"
                                value={data.gender}
                                onChange={(e) =>
                                    setData('gender', e.target.value)
                                }
                                className={cn(
                                    fieldClass,
                                    'h-11 [color-scheme:dark]',
                                )}
                            >
                                <option value="">{tr('Не вказано')}</option>
                                <option value="male">{tr('Чоловіча')}</option>
                                <option value="female">{tr('Жіноча')}</option>
                            </select>
                            <InputError message={errors.gender} />
                        </div>
                    </SettingsRow>
                    <SettingsRow label={tr('Вебсайт')} htmlFor="website" stack>
                        <div className="grid w-full gap-1">
                            <div className="relative">
                                <Globe className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/30" />
                                <Input
                                    id="website"
                                    type="url"
                                    value={data.website}
                                    onChange={(e) =>
                                        setData('website', e.target.value)
                                    }
                                    className="pl-10"
                                    placeholder="https://"
                                />
                            </div>
                            <InputError message={errors.website} />
                        </div>
                    </SettingsRow>
                </SettingsCard>

                <SettingsCard list title={tr('Акаунт і приватність')}>
                    <SettingsRow
                        label={tr('Електронна пошта')}
                        htmlFor="email"
                        stack
                        hint={
                            mustVerifyEmail &&
                            auth.user.email_verified_at === null && (
                                <span className="text-amber-200/80">
                                    {tr('Пошту не підтверджено.')}{' '}
                                    <Link
                                        href={send()}
                                        as="button"
                                        className="text-primary underline underline-offset-4"
                                    >
                                        {tr('Надіслати лист ще раз')}
                                    </Link>
                                    {status === 'verification-link-sent' && (
                                        <span className="ml-1 text-emerald-300">
                                            {tr('Посилання надіслано.')}
                                        </span>
                                    )}
                                </span>
                            )
                        }
                    >
                        <div className="grid w-full gap-1">
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) =>
                                    setData('email', e.target.value)
                                }
                                required
                                autoComplete="username"
                            />
                            <InputError message={errors.email} />
                        </div>
                    </SettingsRow>
                    <SettingsSwitch
                        icon={<Lock />}
                        label={tr('Закритий профіль')}
                        hint={tr(
                            'Записи, друзів і фото бачитимуть лише ваші друзі.',
                        )}
                        checked={data.is_private}
                        onChange={(on) => setData('is_private', on)}
                    />
                    <SettingsSwitch
                        icon={<Mail />}
                        label={tr('Листи про активність')}
                        hint={tr(
                            'Друзі, коментарі, спільноти й сім’ї — на пошту. Службові листи (підтвердження, пароль) приходять завжди.',
                        )}
                        checked={data.email_social}
                        onChange={(on) => setData('email_social', on)}
                    />
                    <SettingsRow
                        icon={<MessageCircle />}
                        label={tr('Хто може писати мені')}
                        hint={tr('Особисті повідомлення від інших учасників')}
                    >
                        <div className="flex rounded-lg bg-white/[0.06] p-0.5 text-sm">
                            {[
                                { value: 'everyone', label: tr('Усі') },
                                {
                                    value: 'friends',
                                    label: tr('Лише друзі'),
                                },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                        setData('message_privacy', option.value)
                                    }
                                    aria-pressed={
                                        data.message_privacy === option.value
                                    }
                                    className={cn(
                                        'rounded-md px-3 py-1.5 font-medium transition',
                                        data.message_privacy === option.value
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-white/55 hover:text-white',
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </SettingsRow>
                </SettingsCard>

                <div
                    className={cn(
                        'glass-strong sticky z-10 flex items-center justify-end gap-3 rounded-xl p-3',
                        floatingAboveNav(playing),
                    )}
                >
                    {form.recentlySuccessful && (
                        <span className="text-sm text-emerald-300">
                            {tr('Збережено')}
                        </span>
                    )}
                    <Button
                        disabled={processing || !form.isDirty}
                        data-test="update-profile-button"
                    >
                        {processing && <Spinner />}
                        {tr('Зберегти зміни')}
                    </Button>
                </div>
            </form>

            <div className="mt-7">
                <SettingsCard list title={tr('Приватність')}>
                    <ListeningSwitch />
                </SettingsCard>
            </div>

            {playingOn && <PlayingSettingsCard />}

            <div className="mt-5">
                <ConnectedAccounts connections={connections} />
            </div>

            <DeleteUser />
        </>
    );
}

import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AtSign, Globe, Lock, Mail, MapPin, MessageCircle } from 'lucide-react';
import type { FormEvent } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { ConnectedAccounts } from '@/components/auth/connected-accounts';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { SettingsCard } from '@/layouts/settings/layout';
import { usePlayer } from '@/lib/player';
import { cn, floatingAboveNav } from '@/lib/utils';
import { send } from '@/routes/verification';
import type { SocialConnection } from '@/types/auth';
import { tr } from '@/lib/i18n';

type ProfileForm = {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    status: string;
    about: string;
    city: string;
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
};

const fieldClass =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30';

export default function Profile({
    mustVerifyEmail,
    status,
    profile,
    connections,
}: Props) {
    const { auth } = usePage().props;
    const playing = usePlayer().current !== null;
    const form = useForm<ProfileForm>({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        username: profile.username ?? '',
        email: profile.email ?? '',
        status: profile.status ?? '',
        about: profile.about ?? '',
        city: profile.city ?? '',
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

            <form onSubmit={submit} className="space-y-5">
                <SettingsCard
                    title={tr('Основне')}
                    description={tr('Так вас бачать інші учасники')}
                >
                    <div className="grid gap-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="first_name">{tr("Ім'я")}</Label>
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
                            <div className="grid gap-2">
                                <Label htmlFor="last_name">
                                    {tr('Прізвище')}
                                </Label>
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
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="username">
                                {tr('Адреса сторінки')}
                            </Label>
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
                                    className="h-full min-w-0 flex-1 bg-transparent pr-3 text-white outline-none"
                                    required
                                    maxLength={32}
                                />
                                <AtSign className="mr-3 size-4 text-white/25" />
                            </div>
                            <p className="text-[11px] text-white/35">
                                {tr(
                                    'Латиниця, цифри, крапка та підкреслення. 3–32 символи.',
                                )}
                            </p>
                            <InputError message={errors.username} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="status">{tr('Статус')}</Label>
                            <Input
                                id="status"
                                value={data.status}
                                onChange={(e) =>
                                    setData('status', e.target.value)
                                }
                                maxLength={140}
                                placeholder={tr('Що у вас нового?')}
                            />
                            <div className="flex justify-between">
                                <InputError message={errors.status} />
                                <span className="ml-auto text-[11px] text-white/30">
                                    {data.status.length}/140
                                </span>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="about">{tr('Про себе')}</Label>
                            <textarea
                                id="about"
                                value={data.about}
                                onChange={(e) =>
                                    setData('about', e.target.value)
                                }
                                rows={4}
                                maxLength={2000}
                                placeholder={tr(
                                    'Розкажіть про свої захоплення, улюблені ігри та фільми',
                                )}
                                className={cn(
                                    fieldClass,
                                    'resize-y py-3 leading-relaxed',
                                )}
                            />
                            <InputError message={errors.about} />
                        </div>
                    </div>
                </SettingsCard>

                <SettingsCard title={tr('Особиста інформація')}>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="city">{tr('Місто')}</Label>
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
                        <div className="grid gap-2">
                            <Label htmlFor="birthday">
                                {tr('Дата народження')}
                            </Label>
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
                        <div className="grid gap-2">
                            <Label htmlFor="gender">{tr('Стать')}</Label>
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
                        <div className="grid gap-2">
                            <Label htmlFor="website">{tr('Вебсайт')}</Label>
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
                    </div>
                </SettingsCard>

                <SettingsCard title={tr('Акаунт і приватність')}>
                    <div className="grid gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="email">
                                {tr('Електронна пошта')}
                            </Label>
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

                            {mustVerifyEmail &&
                                auth.user.email_verified_at === null && (
                                    <p className="text-xs text-amber-200/80">
                                        {tr('Пошту не підтверджено.')}{' '}
                                        <Link
                                            href={send()}
                                            as="button"
                                            className="text-[#9aa8ff] underline underline-offset-4"
                                        >
                                            {tr('Надіслати лист ще раз')}
                                        </Link>
                                        {status ===
                                            'verification-link-sent' && (
                                            <span className="ml-1 text-emerald-300">
                                                {tr('Посилання надіслано.')}
                                            </span>
                                        )}
                                    </p>
                                )}
                        </div>

                        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-white/15">
                            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                                <Lock className="size-[18px] text-[#a58bff]" />
                            </span>
                            <span className="flex-1">
                                <span className="block text-sm font-semibold text-white">
                                    {tr('Закритий профіль')}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                                    {tr(
                                        'Записи, друзів і фото бачитимуть лише ваші друзі.',
                                    )}
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={data.is_private}
                                onChange={(e) =>
                                    setData('is_private', e.target.checked)
                                }
                                className="peer sr-only"
                            />
                            <span className="relative mt-2 h-6 w-11 shrink-0 rounded-full bg-white/10 transition peer-checked:bg-gradient-brand after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
                        </label>

                        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-white/15">
                            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                                <Mail className="size-[18px] text-[#a58bff]" />
                            </span>
                            <span className="flex-1">
                                <span className="block text-sm font-semibold text-white">
                                    {tr('Листи про активність')}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                                    {tr(
                                        'Друзі, коментарі, спільноти й сім’ї — на пошту. Службові листи (підтвердження, пароль) приходять завжди.',
                                    )}
                                </span>
                            </span>
                            <input
                                type="checkbox"
                                checked={data.email_social}
                                onChange={(e) =>
                                    setData('email_social', e.target.checked)
                                }
                                className="peer sr-only"
                            />
                            <span className="relative mt-2 h-6 w-11 shrink-0 rounded-full bg-white/10 transition peer-checked:bg-gradient-brand after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
                        </label>

                        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
                                <MessageCircle className="size-[18px] text-[#a58bff]" />
                            </span>
                            <span className="min-w-[160px] flex-1">
                                <span className="block text-sm font-semibold text-white">
                                    {tr('Хто може писати мені')}
                                </span>
                                <span className="mt-0.5 block text-xs text-white/45">
                                    {tr(
                                        'Особисті повідомлення від інших учасників',
                                    )}
                                </span>
                            </span>
                            <div className="glass flex rounded-xl p-1 text-sm">
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
                                            setData(
                                                'message_privacy',
                                                option.value,
                                            )
                                        }
                                        className={cn(
                                            'rounded-lg px-3 py-1.5 font-medium transition',
                                            data.message_privacy ===
                                                option.value
                                                ? 'bg-gradient-brand text-white'
                                                : 'text-white/55 hover:text-white',
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SettingsCard>

                <div
                    className={cn(
                        'glass-strong sticky z-10 flex items-center justify-end gap-3 rounded-2xl p-3',
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

            <div className="mt-5">
                <ConnectedAccounts connections={connections} />
            </div>

            <DeleteUser />
        </>
    );
}

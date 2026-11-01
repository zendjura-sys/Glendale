import { Form, Head, usePage } from '@inertiajs/react';
import { Mail } from 'lucide-react';
import {
    AuthField,
    AuthSubmit,
    AuthSwitch,
} from '@/components/auth/auth-field';
import { AppLoginButton } from '@/components/auth/app-login';
import { SocialLogin } from '@/components/auth/social-login';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import { tr } from '@/lib/i18n';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    const registrationOpen = usePage().props.site?.registration_open !== false;
    return (
        <>
            <Head title={tr('Вхід')} />

            {status && (
                <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    {status}
                </div>
            )}

            <div className="mb-6 grid gap-2.5">
                <AppLoginButton />
                <SocialLogin mode="login" />
            </div>

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-1.5">
                                <AuthField
                                    icon={Mail}
                                    label={tr('Електронна пошта')}
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                />
                                <InputError message={errors.email} />
                                {errors.email && (
                                    <TextLink
                                        href="/appeal"
                                        className="text-xs"
                                    >
                                        {tr('Акаунт заблоковано? Оскаржити')}
                                    </TextLink>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="password" className="sr-only">
                                    {tr('Пароль')}
                                </Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder={tr('Пароль')}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label
                                    htmlFor="remember"
                                    className="text-sm text-white/70"
                                >
                                    {tr("Запам'ятати мене")}
                                </Label>
                                {canResetPassword && (
                                    <TextLink
                                        href={request()}
                                        className="ml-auto text-xs text-white/70"
                                        tabIndex={5}
                                    >
                                        {tr('Забули пароль?')}
                                    </TextLink>
                                )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
                                <AuthSubmit
                                    tabIndex={4}
                                    disabled={processing}
                                    data-test="login-button"
                                >
                                    {processing && <Spinner />}
                                    {tr('Увійти')}
                                </AuthSubmit>
                                {registrationOpen && (
                                    <AuthSwitch href="/register">
                                        {tr('Немає акаунта? Зареєструватися')}
                                    </AuthSwitch>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: tr('Вхід'),
    description: tr('Увійдіть, щоб продовжити спілкування з друзями'),
};

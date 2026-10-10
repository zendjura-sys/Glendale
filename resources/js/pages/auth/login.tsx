import { Form, Head, usePage } from '@inertiajs/react';
import { SocialLogin } from '@/components/auth/social-login';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import { tr } from '@/lib/i18n';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    const { site } = usePage().props;

    return (
        <>
            <Head title={tr('Вхід')} />

            {status && (
                <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                    {status}
                </div>
            )}

            <div className="mb-2.5 empty:hidden">
                <SocialLogin
                    mode="login"
                    divider={
                        typeof window === 'undefined' ||
                        !window.PublicKeyCredential
                    }
                />
            </div>

            <PasskeyVerify />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="email">
                                    {tr('Електронна пошта')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="you@gamecon.online"
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

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">
                                        {tr('Пароль')}
                                    </Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-xs"
                                            tabIndex={5}
                                        >
                                            {tr('Забули пароль?')}
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
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
                                    className="text-sm text-white/60"
                                >
                                    {tr("Запам'ятати мене")}
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                size="lg"
                                className="mt-1 w-full"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                {tr('Увійти')}
                            </Button>
                        </div>

                        {site?.registration_open !== false && (
                            <div className="text-center text-sm text-white/45">
                                {tr('Ще немає акаунта?')}{' '}
                                <TextLink href={register()} tabIndex={5}>
                                    {tr('Зареєструватися')}
                                </TextLink>
                            </div>
                        )}
                    </>
                )}
            </Form>
        </>
    );
}

Login.layout = {
    title: tr('З поверненням!'),
    description: tr('Увійдіть, щоб продовжити спілкування з друзями'),
};

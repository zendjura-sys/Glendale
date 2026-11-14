import { Form, Head } from '@inertiajs/react';
import { Mail, User } from 'lucide-react';
import {
    AuthField,
    AuthSubmit,
    AuthSwitch,
} from '@/components/auth/auth-field';
import { SocialLogin } from '@/components/auth/social-login';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/register';
import { tr } from '@/lib/i18n';

type Props = {
    passwordRules: string;
};

export default function Register({ passwordRules }: Props) {
    return (
        <>
            <Head title={tr('Реєстрація')} />
            <div className="mb-6 empty:hidden">
                <SocialLogin mode="register" />
            </div>
            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        {/* Пастка для ботів: людям не видно, боти заповнюють — таку реєстрацію сервер відхиляє. */}
                        <input
                            type="text"
                            name="website"
                            tabIndex={-1}
                            autoComplete="off"
                            aria-hidden
                            className="pointer-events-none absolute -left-[9999px] size-px opacity-0"
                        />
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <AuthField
                                        icon={User}
                                        label={tr("Ім'я")}
                                        id="first_name"
                                        name="first_name"
                                        required
                                        autoFocus
                                        tabIndex={1}
                                        autoComplete="given-name"
                                    />
                                    <InputError message={errors.first_name} />
                                </div>
                                <div className="grid gap-1.5">
                                    <AuthField
                                        icon={User}
                                        label={tr('Прізвище')}
                                        id="last_name"
                                        name="last_name"
                                        required
                                        tabIndex={2}
                                        autoComplete="family-name"
                                    />
                                    <InputError message={errors.last_name} />
                                </div>
                            </div>

                            <div className="grid gap-1.5">
                                <AuthField
                                    icon={Mail}
                                    label={tr('Електронна пошта')}
                                    id="email"
                                    type="email"
                                    required
                                    tabIndex={3}
                                    autoComplete="email"
                                    name="email"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="password" className="sr-only">
                                    {tr('Пароль')}
                                </Label>
                                <PasswordInput
                                    id="password"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder={tr(
                                        'Пароль (мінімум 8 символів)',
                                    )}
                                    passwordrules={passwordRules}
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-1.5">
                                <Label
                                    htmlFor="password_confirmation"
                                    className="sr-only"
                                >
                                    {tr('Повторіть пароль')}
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    required
                                    tabIndex={5}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder={tr('Повторіть пароль')}
                                    passwordrules={passwordRules}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <div className="mt-3 flex flex-col items-center gap-4">
                                <AuthSubmit
                                    tabIndex={6}
                                    disabled={processing}
                                    data-test="register-user-button"
                                >
                                    {processing && <Spinner />}
                                    {tr('Створити акаунт')}
                                </AuthSubmit>
                                <AuthSwitch href="/login">
                                    {tr('Уже є акаунт? Увійти')}
                                </AuthSwitch>
                            </div>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: tr('Реєстрація'),
    description: tr(
        'Створи акаунт за хвилину — і знаходь друзів, команду й сервер',
    ),
};

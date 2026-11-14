import { Form, Head } from '@inertiajs/react';
import { useRef } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';
import { SettingsCard, SettingsRow } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';

// oxfmt-ignore
type Props = {
    passwordRules: string;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <>
            <Head title={tr('Безпека')} />

            <h1 className="sr-only">{tr('Безпека')}</h1>

            <SettingsCard
                list
                title={tr('Зміна пароля')}
                description={tr('Використовуйте довгий унікальний пароль')}
            >
                <Form
                    {...SecurityController.update.form()}
                    options={{
                        preserveScroll: true,
                    }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                    onError={(errors) => {
                        if (errors.password) {
                            passwordInput.current?.focus();
                        }

                        if (errors.current_password) {
                            currentPasswordInput.current?.focus();
                        }
                    }}
                >
                    {({ errors, processing }) => (
                        <>
                            <SettingsRow
                                label={tr('Поточний пароль')}
                                htmlFor="current_password"
                                stack
                            >
                                <div className="grid w-full gap-1">
                                    <PasswordInput
                                        id="current_password"
                                        ref={currentPasswordInput}
                                        name="current_password"
                                        className="block w-full"
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                    />
                                    <InputError
                                        message={errors.current_password}
                                    />
                                </div>
                            </SettingsRow>
                            <SettingsRow
                                label={tr('Новий пароль')}
                                htmlFor="password"
                                stack
                            >
                                <div className="grid w-full gap-1">
                                    <PasswordInput
                                        id="password"
                                        ref={passwordInput}
                                        name="password"
                                        className="block w-full"
                                        autoComplete="new-password"
                                        placeholder={tr('Мінімум 8 символів')}
                                        passwordrules={props.passwordRules}
                                    />
                                    <InputError message={errors.password} />
                                </div>
                            </SettingsRow>
                            <SettingsRow
                                label={tr('Повторіть пароль')}
                                htmlFor="password_confirmation"
                                stack
                            >
                                <div className="grid w-full gap-1">
                                    <PasswordInput
                                        id="password_confirmation"
                                        name="password_confirmation"
                                        className="block w-full"
                                        autoComplete="new-password"
                                        placeholder="••••••••"
                                        passwordrules={props.passwordRules}
                                    />
                                    <InputError
                                        message={errors.password_confirmation}
                                    />
                                </div>
                            </SettingsRow>
                            <div className="gc-row flex justify-end py-3">
                                <Button
                                    disabled={processing}
                                    data-test="update-password-button"
                                >
                                    {tr('Оновити пароль')}
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </SettingsCard>

            <ManageTwoFactor
                canManageTwoFactor={props.canManageTwoFactor}
                requiresConfirmation={props.requiresConfirmation}
                twoFactorEnabled={props.twoFactorEnabled}
            />

            <ManagePasskeys
                canManagePasskeys={props.canManagePasskeys}
                passkeys={props.passkeys}
            />
        </>
    );
}

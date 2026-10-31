import { Form } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SettingsCard } from '@/layouts/settings/layout';
import TwoFactorRecoveryCodes from '@/components/two-factor-recovery-codes';
import TwoFactorSetupModal from '@/components/two-factor-setup-modal';
import { Button } from '@/components/ui/button';
import { useTwoFactorAuth } from '@/hooks/use-two-factor-auth';
import { disable, enable } from '@/routes/two-factor';
import { tr } from '@/lib/i18n';

export type Props = {
    canManageTwoFactor?: boolean;
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
};

export default function ManageTwoFactor(props: Props) {
    const requiresConfirmation = props.requiresConfirmation ?? false;
    const twoFactorEnabled = props.twoFactorEnabled ?? false;

    const {
        qrCodeSvg,
        hasSetupData,
        manualSetupKey,
        clearSetupData,
        clearTwoFactorAuthData,
        fetchSetupData,
        recoveryCodesList,
        fetchRecoveryCodes,
        errors,
    } = useTwoFactorAuth();
    const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
    const prevTwoFactorEnabled = useRef(twoFactorEnabled);

    useEffect(() => {
        if (prevTwoFactorEnabled.current && !twoFactorEnabled) {
            clearTwoFactorAuthData();
        }

        prevTwoFactorEnabled.current = twoFactorEnabled;
    }, [twoFactorEnabled, clearTwoFactorAuthData]);

    if (!(props.canManageTwoFactor ?? false)) {
        return null;
    }

    return (
        <SettingsCard
            title={tr('Двофакторна автентифікація')}
            description={tr('Додатковий захист входу кодом із телефона')}
        >
            <div className="space-y-6">
                {twoFactorEnabled ? (
                    <div className="flex flex-col items-start justify-start space-y-4">
                        <p className="text-sm text-white/50">
                            {tr(
                                'Під час входу ми запитаємо одноразовий код із застосунку-автентифікатора.',
                            )}
                        </p>

                        <div className="relative inline">
                            <Form {...disable.form()}>
                                {({ processing }) => (
                                    <Button
                                        variant="destructive"
                                        type="submit"
                                        disabled={processing}
                                    >
                                        {tr('Вимкнути 2FA')}
                                    </Button>
                                )}
                            </Form>
                        </div>

                        <TwoFactorRecoveryCodes
                            recoveryCodesList={recoveryCodesList}
                            fetchRecoveryCodes={fetchRecoveryCodes}
                            errors={errors}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-start justify-start space-y-4">
                        <p className="text-sm text-white/50">
                            {tr(
                                'Після ввімкнення під час входу потрібен буде код із Google Authenticator, 1Password або іншого TOTP-застосунку.',
                            )}
                        </p>

                        <div>
                            {hasSetupData ? (
                                <Button onClick={() => setShowSetupModal(true)}>
                                    <ShieldCheck />
                                    {tr('Продовжити налаштування')}
                                </Button>
                            ) : (
                                <Form
                                    {...enable.form()}
                                    onSuccess={() => setShowSetupModal(true)}
                                >
                                    {({ processing }) => (
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {tr('Увімкнути 2FA')}
                                        </Button>
                                    )}
                                </Form>
                            )}
                        </div>
                    </div>
                )}

                <TwoFactorSetupModal
                    isOpen={showSetupModal}
                    onClose={() => setShowSetupModal(false)}
                    requiresConfirmation={requiresConfirmation}
                    twoFactorEnabled={twoFactorEnabled}
                    qrCodeSvg={qrCodeSvg}
                    manualSetupKey={manualSetupKey}
                    clearSetupData={clearSetupData}
                    fetchSetupData={fetchSetupData}
                    errors={errors}
                />
            </div>
        </SettingsCard>
    );
}

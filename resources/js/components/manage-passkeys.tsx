import { router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { destroy } from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyRegistrationController';
import { SettingsCard } from '@/layouts/settings/layout';
import PasskeyItem from '@/components/passkey-item';
import PasskeyRegistration from '@/components/passkey-register';
import type { Passkey } from '@/types/auth';
import { tr } from '@/lib/i18n';

export type Props = {
    canManagePasskeys?: boolean;
    passkeys?: Passkey[];
};

const EmptyState = () => {
    return (
        <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05]">
                <KeyRound className="h-7 w-7 text-white/45" />
            </div>
            <p className="font-medium">{tr('Ключів ще немає')}</p>
            <p className="mt-1 text-sm text-white/45">
                {tr('Додайте ключ, щоб входити без пароля')}
            </p>
        </div>
    );
};

export default function ManagePasskeys(props: Props) {
    const passkeys = props.passkeys ?? [];

    const handleDelete = (id: number, onError: () => void) => {
        router.delete(destroy.url(id), {
            preserveScroll: true,
            onError,
        });
    };

    const handleRegisterSuccess = () => {
        router.reload();
    };

    if (!(props.canManagePasskeys ?? false)) {
        return null;
    }

    return (
        <SettingsCard
            title={tr('Ключі доступу')}
            description={tr(
                'Вхід без пароля — відбитком пальця, Face ID або ключем безпеки',
            )}
        >
            <div className="space-y-6">
                <div className="overflow-hidden rounded-xl border border-[var(--gc-hairline)]">
                    {passkeys.length > 0 ? (
                        passkeys.map((passkey) => (
                            <PasskeyItem
                                key={passkey.id}
                                passkey={passkey}
                                onDelete={handleDelete}
                            />
                        ))
                    ) : (
                        <EmptyState />
                    )}
                </div>

                <PasskeyRegistration onSuccess={handleRegisterSuccess} />
            </div>
        </SettingsCard>
    );
}

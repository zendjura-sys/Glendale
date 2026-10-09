// Components
import { Form, Head } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';
import { send } from '@/routes/verification';
import { tr } from '@/lib/i18n';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title={tr('Підтвердження пошти')} />

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-center text-sm font-medium text-emerald-300">
                    {tr('Нове посилання надіслано на вашу пошту.')}
                </div>
            )}

            <Form {...send.form()} className="space-y-6 text-center">
                {({ processing }) => (
                    <>
                        <Button disabled={processing} variant="secondary">
                            {processing && <Spinner />}
                            {tr('Надіслати лист ще раз')}
                        </Button>

                        <TextLink
                            href={logout()}
                            className="mx-auto block text-sm"
                        >
                            {tr('Вийти')}
                        </TextLink>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: tr('Підтвердіть пошту'),
    description: tr(
        'Ми надіслали лист із посиланням. Перейдіть за ним, щоб активувати акаунт.',
    ),
};

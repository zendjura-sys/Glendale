import { Form, Head } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/routes';
import { tr } from '@/lib/i18n';

export default function Appeal() {
    return (
        <>
            <Head title={tr('Оскарження блокування')} />

            <Form action="/appeal" method="post" className="space-y-6">
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="email">
                                {tr('Електронна пошта')}
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                required
                                autoComplete="email"
                                autoFocus
                            />
                            <InputError message={errors.email} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">{tr('Пароль')}</Label>
                            <Input
                                id="password"
                                type="password"
                                name="password"
                                required
                                autoComplete="current-password"
                            />
                            <InputError message={errors.password} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="body">
                                {tr('Чому рішення варто переглянути')}
                            </Label>
                            <textarea
                                id="body"
                                name="body"
                                required
                                minLength={10}
                                maxLength={2000}
                                rows={5}
                                className="input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                            />
                            <InputError message={errors.body} />
                        </div>
                        <Button className="w-full" disabled={processing}>
                            {processing && (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            )}
                            {tr('Надіслати оскарження')}
                        </Button>
                        <div className="space-x-1 text-center text-sm text-white/45">
                            <span>{tr('Або повернутися до')}</span>
                            <TextLink href={login()}>{tr('входу')}</TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Appeal.layout = {
    title: tr('Оскарження блокування'),
    description: tr(
        'Модератори переглянуть рішення. Підтвердьте, що це ваш акаунт.',
    ),
};

import { Head } from '@inertiajs/react';
import { Smartphone } from 'lucide-react';
import { useEffect } from 'react';
import { PlayStoreLink } from '@/components/gc/play-store';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';

type Props = {
    id: string;
    deepLink: string;
};

/**
 * Сторінка, яку кодує QR «Увійти через застосунок»: на телефоні пробуємо відкрити застосунок,
 * інакше — кнопка й посилання на Google Play.
 */
export default function AppLogin({ deepLink }: Props) {
    useEffect(() => {
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.location.href = deepLink;
        }
    }, [deepLink]);

    return (
        <>
            <Head title={tr('Вхід через застосунок')} />
            <div className="grid gap-4">
                <Button asChild size="lg" className="w-full">
                    <a href={deepLink}>
                        <Smartphone />
                        {tr('Відкрити в застосунку')}
                    </a>
                </Button>
                <p className="text-center text-sm text-white/55">
                    {tr(
                        'Ще немає застосунку? Установіть його й відскануйте код знову.',
                    )}
                </p>
                <div className="flex justify-center">
                    <PlayStoreLink />
                </div>
            </div>
        </>
    );
}

AppLogin.layout = {
    title: tr('Відкрийте цей код у застосунку GameCon'),
    description: tr('Підтвердьте вхід у браузері одним дотиком у застосунку.'),
};

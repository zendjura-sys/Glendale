import { Check, CircleAlert, Info, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { tr } from '@/lib/i18n';

/** Скільки тост лишається на екрані (стільки ж іде смужка внизу тосту). */
const DURATION = 4500;
const WIDE = '(min-width: 1024px)';

function useWide(): boolean {
    const [wide, setWide] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(WIDE).matches,
    );

    useEffect(() => {
        const media = window.matchMedia(WIDE);
        const update = () => setWide(media.matches);
        media.addEventListener('change', update);

        return () => media.removeEventListener('change', update);
    }, []);

    return wide;
}

/**
 * Тости — угорі під шапкою (на ПК праворуч, на телефоні по центру), щоб не перекривати нижнє меню.
 * Іконка в кольорі типу (успіх, помилка, попередження, інформація), текст, хрестик і смужка часу,
 * що завмирає, поки курсор над тостами. Нові — зверху. Вигляд — `.gc-toast` в app.css.
 */
function Toaster({ ...props }: ToasterProps) {
    useFlashToast();
    const wide = useWide();

    return (
        <Sonner
            className="toaster group"
            position={wide ? 'top-right' : 'top-center'}
            offset={{ top: 'calc(env(safe-area-inset-top) + 68px)', right: 20 }}
            mobileOffset={{
                top: 'calc(env(safe-area-inset-top) + 64px)',
                left: 12,
                right: 12,
            }}
            visibleToasts={4}
            gap={10}
            duration={DURATION}
            closeButton
            containerAriaLabel={tr('Сповіщення')}
            style={
                {
                    '--gc-toast-duration': `${DURATION}ms`,
                } as React.CSSProperties
            }
            icons={{
                success: <Check />,
                error: <X />,
                warning: <CircleAlert data-mark />,
                info: <Info data-mark />,
                loading: <LoaderCircle className="animate-spin" />,
                close: <X />,
            }}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast: 'gc-toast',
                    icon: 'gc-toast__icon',
                    content: 'gc-toast__content',
                    title: 'gc-toast__title',
                    description: 'gc-toast__description',
                    closeButton: 'gc-toast__close',
                    actionButton: 'gc-toast__action',
                    cancelButton: 'gc-toast__cancel',
                },
            }}
            {...props}
        />
    );
}

export { Toaster };

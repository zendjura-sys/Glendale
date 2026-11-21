import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const flash = (event as CustomEvent).detail?.flash;
            const data = flash?.toast as FlashToast | undefined;

            if (!data) {
                return;
            }

            // Багаторядкове повідомлення (напр. перевірка джерел) — перший рядок заголовком, решта списком.
            const [title, ...rest] = data.message.split('\n');
            if (rest.length > 0) {
                toast[data.type](title, {
                    description: rest.join('\n'),
                    duration: 15_000,
                    classNames: { description: 'whitespace-pre-line' },
                });
                return;
            }

            toast[data.type](data.message);
        });
    }, []);
}

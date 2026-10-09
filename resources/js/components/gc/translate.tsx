import { usePage } from '@inertiajs/react';
import { Languages, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Kind = 'post' | 'comment' | 'message';

/** Стан «Перекласти / Показати оригінал» для тексту користувача. */
export function useContentTranslation(type: Kind, id: number) {
    const { site } = usePage().props;
    const [text, setText] = useState<string | null>(null);
    const [shown, setShown] = useState(false);
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        if (shown) {
            setShown(false);

            return;
        }
        if (text !== null) {
            setShown(true);

            return;
        }
        setLoading(true);
        try {
            const result = await api<{
                translation: string;
                same: boolean;
            }>('POST', '/translate', { type, id });
            if (result.same) {
                toast(tr('Текст уже вашою мовою.'));
            } else {
                setText(result.translation);
                setShown(true);
            }
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return {
        enabled: site.translate,
        text: shown ? text : null,
        shown,
        loading,
        toggle,
    };
}

/** Кнопка під текстом. */
export function TranslateToggle({
    state,
    className,
}: {
    state: ReturnType<typeof useContentTranslation>;
    className?: string;
}) {
    if (!state.enabled) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={state.toggle}
            disabled={state.loading}
            className={cn(
                'inline-flex items-center gap-1 text-xs font-medium text-white/45 transition hover:text-white',
                className,
            )}
        >
            {state.loading ? (
                <Loader2 className="size-3.5 animate-spin" />
            ) : (
                <Languages className="size-3.5" />
            )}
            {state.shown ? tr('Показати оригінал') : tr('Перекласти')}
        </button>
    );
}

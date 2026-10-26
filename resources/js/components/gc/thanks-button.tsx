import { HeartHandshake } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** «Дякую» під гідом чи коментарем: подяка йде в профіль автора як показник корисності. */
export function ThanksButton({
    kind,
    id,
    thanked: initial,
    count: initialCount,
    className,
}: {
    kind: 'guide' | 'comment';
    id: number;
    thanked: boolean;
    count?: number;
    className?: string;
}) {
    const [thanked, setThanked] = useState(initial);
    const [count, setCount] = useState(initialCount);
    const [busy, setBusy] = useState(false);

    return (
        <button
            type="button"
            disabled={busy}
            aria-pressed={thanked}
            onClick={async () => {
                setBusy(true);
                try {
                    const res = await api<{ thanked: boolean; count: number }>(
                        'POST',
                        '/thanks',
                        { kind, id },
                    );
                    setThanked(res.thanked);
                    setCount(res.count);
                } catch (e) {
                    toast.error(
                        e instanceof Error ? e.message : tr('Не вдалося'),
                    );
                } finally {
                    setBusy(false);
                }
            }}
            className={cn(
                'inline-flex items-center gap-1 font-medium transition disabled:opacity-60',
                thanked ? 'text-emerald-300' : 'hover:text-white',
                className,
            )}
        >
            <HeartHandshake className="size-3.5" />
            {thanked ? tr('Подякували') : tr('Дякую')}
            {count !== undefined && count > 0 && (
                <span className="tabular-nums">· {count}</span>
            )}
        </button>
    );
}

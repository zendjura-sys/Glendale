import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Mode = 'improve' | 'fix' | 'shorter' | 'friendly' | 'formal' | 'en' | 'uk';

/**
 * ШІ-редактор у полі повідомлення: переписує набраний текст, людина бачить результат
 * у полі й сама вирішує, чи надсилати.
 */
export function AiWriter({
    text,
    onResult,
}: {
    text: string;
    onResult: (text: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const modes: { mode: Mode; label: string }[] = [
        { mode: 'improve', label: tr('Покращити текст') },
        { mode: 'fix', label: tr('Виправити помилки') },
        { mode: 'shorter', label: tr('Скоротити') },
        { mode: 'friendly', label: tr('Дружніше') },
        { mode: 'formal', label: tr('Офіційніше') },
    ];
    const run = (mode: Mode) => {
        setBusy(true);
        void api<{ text: string }>('POST', '/ai/rewrite', { text, mode })
            .then((result) => onResult(result.text))
            .catch((error: unknown) =>
                toast.error(
                    error instanceof ApiError
                        ? error.message
                        : tr('ШІ не зміг обробити текст.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={busy || text.trim() === ''}
                className={cn(
                    'mb-1 flex size-9 items-center justify-center rounded-full text-white/50 transition outline-none hover:text-gc-lilac-300 disabled:opacity-40',
                    busy && 'text-gc-lilac-300',
                )}
                aria-label={tr('ШІ-редактор')}
                title={tr('ШІ-редактор')}
            >
                {busy ? (
                    <Loader2 className="size-5 animate-spin" />
                ) : (
                    <Sparkles className="size-5" />
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuLabel className="text-xs text-white/45">
                    {tr('ШІ-редактор')}
                </DropdownMenuLabel>
                {modes.map((item) => (
                    <DropdownMenuItem
                        key={item.mode}
                        onSelect={() => run(item.mode)}
                    >
                        {item.label}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => run('en')}>
                    {tr('Перекласти англійською')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('uk')}>
                    {tr('Перекласти українською')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

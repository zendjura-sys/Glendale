import { Sparkles } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Compatibility = {
    score: number;
    reasons: (
        | { type: 'games'; count: number; names: string[] }
        | { type: 'music'; names: string[] }
        | { type: 'communities'; count: number }
        | { type: 'time' | 'platform' | 'language' }
    )[];
};

function reasonText(reason: Compatibility['reasons'][number]) {
    switch (reason.type) {
        case 'games':
            return tr('Спільні ігри: {names}', {
                names:
                    reason.names.join(', ') +
                    (reason.count > reason.names.length
                        ? ` +${reason.count - reason.names.length}`
                        : ''),
            });
        case 'music':
            return tr('Слухаєте одне й те саме: {names}', {
                names: reason.names.join(', '),
            });
        case 'communities':
            return tr('Спільних спільнот: {count}', { count: reason.count });
        case 'time':
            return tr('Граєте в той самий час');
        case 'platform':
            return tr('Та сама платформа');
        default:
            return tr('Спільна мова');
    }
}

/** «Сумісність N%» на сторінці людини; натиснути — з чого складається. */
export function CompatibilityChip({ data }: { data: Compatibility }) {
    const tone =
        data.score >= 70
            ? 'bg-emerald-500/15 text-emerald-200'
            : data.score >= 40
              ? 'bg-sky-500/15 text-sky-200'
              : 'bg-white/[0.06] text-white/65';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition hover:brightness-125',
                        tone,
                    )}
                >
                    <Sparkles className="size-3.5" />
                    {tr('Сумісність {score}%', { score: data.score })}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-4">
                <p className="font-display text-sm font-semibold text-white">
                    {tr('Сумісність {score}%', { score: data.score })}
                </p>
                {data.reasons.length === 0 ? (
                    <p className="mt-2 text-sm text-white/55">
                        {tr('Поки мало спільного — пограйте разом.')}
                    </p>
                ) : (
                    <ul className="mt-2 space-y-1.5 text-sm text-white/70">
                        {data.reasons.map((reason) => (
                            <li key={reason.type} className="flex gap-2">
                                <span className="mt-2 size-1 shrink-0 rounded-full bg-white/40" />
                                {reasonText(reason)}
                            </li>
                        ))}
                    </ul>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

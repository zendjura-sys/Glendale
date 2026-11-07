import { ALERT_TYPES, resolveAlertColors } from '@/lib/alerts-config';
import type { AlertScaleCode, AlertTypeCode } from '@/lib/alerts-config';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

/**
 * Плашка тривоги: іконка Lucide й коротка назва в кольорах типу (для AIR — за масштабом).
 * Скляна підкладка з відтінком типу; `iconOnly` — вторинний бейдж поруч із головним.
 */
export function AlertBadge({
    type,
    scale,
    iconOnly = false,
    full = false,
    className,
}: {
    type: AlertTypeCode;
    scale?: AlertScaleCode | null;
    iconOnly?: boolean;
    /** Повна назва замість короткої. */
    full?: boolean;
    className?: string;
}) {
    const meta = ALERT_TYPES[type];
    const colors = resolveAlertColors(type, type === 'AIR' ? scale : null);
    const Icon = meta.icon;

    return (
        <span
            title={meta.label()}
            className={cn(
                'gc-alert-text inline-flex shrink-0 items-center gap-1 rounded-chip border font-semibold',
                iconOnly ? 'size-6 justify-center' : 'h-6 px-2 text-[11px]',
                className,
            )}
            style={
                {
                    background: colors.fill,
                    borderColor: colors.border,
                    '--a-text': colors.text,
                    '--a-hex': colors.hex,
                } as CSSProperties
            }
        >
            <Icon className="size-3.5" aria-hidden />
            {iconOnly ? (
                <span className="sr-only">{meta.label()}</span>
            ) : full ? (
                meta.label()
            ) : (
                meta.short()
            )}
        </span>
    );
}

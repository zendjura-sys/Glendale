import { cn } from '@/lib/utils';

/** Знак GameCon — неонова «G» у заокругленому квадраті (той самий, що у фавіконі й застосунку). */
export function LogoMark({ className }: { className?: string }) {
    return (
        <img
            src="/images/brand/logo-mark.png"
            alt=""
            width={36}
            height={36}
            draggable={false}
            className={cn(
                'inline-block size-9 shrink-0 drop-shadow-[0_6px_18px_rgb(0_150_255/0.35)] select-none',
                className,
            )}
        />
    );
}

export function Logo({
    className,
    compact = false,
}: {
    className?: string;
    compact?: boolean;
}) {
    return (
        <span className={cn('inline-flex items-center gap-2.5', className)}>
            <LogoMark />
            {!compact && (
                <span className="font-display text-[19px] font-bold tracking-tight text-white">
                    Game<span className="text-primary">Con</span>
                </span>
            )}
        </span>
    );
}

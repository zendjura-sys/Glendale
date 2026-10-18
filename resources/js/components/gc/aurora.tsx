import { cn } from '@/lib/utils';

/**
 * Анімований фон: кольорові «плями» під розмиттям, сітка й шум. Кольори плям — змінні
 * --aurora-1…4 (стиль «GameCon» задає неоновий синій і крижаний варіанти).
 */
export function Aurora({
    className,
    intense = false,
}: {
    className?: string;
    intense?: boolean;
}) {
    return (
        <div
            aria-hidden
            className={cn(
                'noise gc-aurora pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background',
                className,
            )}
        >
            <div className="grid-lines absolute inset-0 opacity-70" />
            <div
                className={cn(
                    'absolute -top-[30%] -left-[15%] h-[75vmax] w-[75vmax] animate-aurora rounded-full blur-[120px]',
                    intense ? 'opacity-55' : 'opacity-30',
                )}
                style={{
                    background:
                        'radial-gradient(circle at 30% 30%, var(--aurora-1, #3b6dff) 0%, transparent 60%)',
                }}
            />
            <div
                className={cn(
                    'absolute -top-[20%] right-[-25%] h-[70vmax] w-[70vmax] animate-aurora rounded-full blur-[130px] [animation-delay:-7s]',
                    intense ? 'opacity-50' : 'opacity-25',
                )}
                style={{
                    background:
                        'radial-gradient(circle at 60% 40%, var(--aurora-2, #9b4dff) 0%, transparent 60%)',
                }}
            />
            <div
                className={cn(
                    'absolute bottom-[-35%] left-[20%] h-[60vmax] w-[60vmax] animate-aurora rounded-full blur-[140px] [animation-delay:-13s]',
                    intense ? 'opacity-40' : 'opacity-[0.18]',
                )}
                style={{
                    background:
                        'radial-gradient(circle at 50% 50%, var(--aurora-3, #e04fd0) 0%, transparent 60%)',
                }}
            />
            <div
                className="absolute top-[40%] left-[-10%] h-[40vmax] w-[40vmax] animate-aurora rounded-full opacity-[0.12] blur-[120px] [animation-delay:-4s]"
                style={{
                    background:
                        'radial-gradient(circle, var(--aurora-4, #38e1ff) 0%, transparent 60%)',
                }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--background)_100%)]" />
        </div>
    );
}

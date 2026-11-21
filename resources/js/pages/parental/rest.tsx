import { Head, Link } from '@inertiajs/react';
import { Moon } from 'lucide-react';
import { tr } from '@/lib/i18n';

/** Нічна пауза батьківського контролю (№227). */
export default function ParentalRest({ until }: { until: string | null }) {
    return (
        <>
            <Head title={tr('Час відпочити')} />
            <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--gc-page)] px-6 text-center">
                <Moon className="size-12 text-[var(--gc-accent)]" aria-hidden />
                <h1 className="font-display text-3xl font-bold text-[var(--gc-text)]">
                    {tr('Час відпочити')}
                </h1>
                <p className="max-w-sm text-[15px] text-[var(--gc-text-2)]">
                    {until
                        ? tr(
                              'GameCon відкриється о {time}. Так домовились із батьками.',
                              { time: until },
                          )
                        : tr('Так домовились із батьками.')}
                </p>
                <Link
                    href="/settings/parental"
                    className="text-sm text-[var(--gc-accent)] hover:underline"
                >
                    {tr('Батьківський контроль')}
                </Link>
            </main>
        </>
    );
}

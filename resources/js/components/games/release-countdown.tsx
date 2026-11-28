import { Rocket } from 'lucide-react';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';

/** Відлік до виходу гри (лише для майбутніх релізів): «Вихід через 12 днів». */
export function ReleaseCountdown({ date }: { date: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round(
        (new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000,
    );
    if (days < 0) return null;

    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-chip bg-primary/25 px-2.5 py-0.5 text-xs font-semibold text-white"
            title={tr('Додайте гру в бажане — сповістимо в день виходу.')}
        >
            <Rocket className="size-3.5" />
            {days === 0
                ? tr('Виходить сьогодні')
                : tr('Вихід через {n}', {
                      n: `${days} ${plural(days, ['день', 'дні', 'днів'])}`,
                  })}
        </span>
    );
}

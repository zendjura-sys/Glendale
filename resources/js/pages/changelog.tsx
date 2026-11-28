import { Head } from '@inertiajs/react';
import { Sparkles } from 'lucide-react';
import { CHANGELOG } from '@/components/gc/site-extras';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';

/** Журнал змін (№285): усі оновлення сайту й застосунку — від нових до старих. */
export default function Changelog() {
    const entries = CHANGELOG();

    return (
        <>
            <Head title={tr('Що нового')} />
            <div className="mx-auto max-w-2xl space-y-3.5">
                <header className="gc-solid rounded-2xl p-5">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <Sparkles className="size-6 text-[var(--gc-accent)]" />
                        {tr('Що нового')}
                    </h1>
                    <p className="mt-1 text-sm text-white/60">
                        {tr('Оновлення GameCon — від нових до старих.')}
                    </p>
                </header>
                {entries.map((entry) => (
                    <section
                        key={entry.version}
                        className="gc-solid rounded-2xl p-5"
                        aria-labelledby={`v-${entry.version}`}
                    >
                        <h2
                            id={`v-${entry.version}`}
                            className="flex items-baseline justify-between gap-3 font-display text-lg font-semibold text-white"
                        >
                            {formatDate(entry.date)}
                            <span className="text-xs font-medium text-white/45 tabular-nums">
                                {entry.version}
                            </span>
                        </h2>
                        <ul className="mt-3 space-y-2">
                            {entry.items.map((item) => (
                                <li
                                    key={item}
                                    className="flex gap-2.5 text-[15px] leading-relaxed text-white/80"
                                >
                                    <span
                                        aria-hidden
                                        className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[var(--gc-accent)]"
                                    />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </>
    );
}

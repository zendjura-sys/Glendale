import { Head } from '@inertiajs/react';
import { BellRing, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SettingsCard } from '@/layouts/settings/layout';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

/** Налаштування → «Слова»: сповіщення про нові публічні записи з обраними словами. */
export default function KeywordAlertsSettings({
    keywords,
    max,
}: {
    keywords: string[];
    max: number;
}) {
    const [list, setList] = useState(keywords);
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);

    const add = async () => {
        if (value.trim().length < 3 || busy) return;
        setBusy(true);
        try {
            const result = await api<{ keywords: string[] }>(
                'POST',
                '/settings/keyword-alerts',
                { keyword: value },
            );
            setList(result.keywords);
            setValue('');
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : tr('Не вдалося'),
            );
        } finally {
            setBusy(false);
        }
    };
    const remove = async (keyword: string) => {
        const result = await api<{ keywords: string[] }>(
            'DELETE',
            '/settings/keyword-alerts',
            { keyword },
        );
        setList(result.keywords);
    };

    return (
        <>
            <Head title={tr('Сповіщення за словами')} />
            <SettingsCard
                title={tr('Сповіщення за словами')}
                description={tr(
                    'Назва гри, нік стрімера, тема — і ви дізнаєтеся про нові публічні записи з цим словом. Не частіше разу на годину за одним словом.',
                )}
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                    className="flex gap-2"
                >
                    <input
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        maxLength={40}
                        disabled={list.length >= max}
                        placeholder={tr('Наприклад: cs2, патч, турнір')}
                        className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={
                            busy ||
                            value.trim().length < 3 ||
                            list.length >= max
                        }
                        className="btn-glow inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-40"
                    >
                        <Plus className="size-4" />
                        {tr('Додати')}
                    </button>
                </form>
                {list.length === 0 ? (
                    <p className="mt-4 flex items-center gap-2 text-sm text-white/45">
                        <BellRing className="size-4" />
                        {tr('Поки що ви не стежите за жодним словом.')}
                    </p>
                ) : (
                    <ul className="mt-4 flex flex-wrap gap-2">
                        {list.map((keyword) => (
                            <li
                                key={keyword}
                                className="inline-flex h-9 items-center gap-1 rounded-full bg-white/[0.07] pr-1 pl-3.5 text-sm text-white"
                            >
                                {keyword}
                                <button
                                    type="button"
                                    onClick={() => remove(keyword)}
                                    aria-label={tr('Прибрати')}
                                    className="flex size-7 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-3 text-xs text-white/35">
                    {tr('{n} з {max}', { n: list.length, max })}
                </p>
            </SettingsCard>
        </>
    );
}

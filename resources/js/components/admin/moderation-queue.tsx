import {
    AlertTriangle,
    Gavel,
    ImageIcon,
    MessageSquareWarning,
    UserX,
} from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type QueueItem = {
    kind: 'report' | 'person' | 'appeal' | 'image';
    id: number;
    title: string;
    reason: string;
    score: number;
    level: 'critical' | 'high' | 'medium' | 'low';
    created_at: string;
};

const ICONS = {
    report: MessageSquareWarning,
    person: UserX,
    appeal: Gavel,
    image: ImageIcon,
};

function levelLabel(level: QueueItem['level']): string {
    return {
        critical: tr('Терміново'),
        high: tr('Високий'),
        medium: tr('Середній'),
        low: tr('Звичайний'),
    }[level];
}

function kindLabel(kind: QueueItem['kind']): string {
    return {
        report: tr('Скарга на повідомлення'),
        person: tr('Скарга на людину'),
        appeal: tr('Оскарження'),
        image: tr('Зображення'),
    }[kind];
}

const LEVEL_CLASS: Record<QueueItem['level'], string> = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-amber-400/15 text-amber-300',
    medium: 'bg-sky-400/15 text-sky-400',
    low: 'gc-solid-2 text-white/55',
};

/** Спільна черга модерації: усе, що чекає рішення, в порядку важливості. */
export function ModerationQueue({ items }: { items: QueueItem[] }) {
    if (items.length === 0) return null;

    const jump = (item: QueueItem) => {
        const node = document.getElementById(`mod-${item.kind}-${item.id}`);
        node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node?.classList.add('ring-2', '');
        window.setTimeout(() => node?.classList.remove('ring-2', ''), 1600);
    };

    return (
        <section className="gc-solid mb-6 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <AlertTriangle className="size-4 text-amber-300" />
                {tr('Черга за пріоритетом')}
            </h2>
            <p className="mb-3 text-xs text-white/45">
                {tr(
                    'Безпека дітей, оцінка ШІ, довірені скаржники, кількість скарг і час очікування. Беріть зверху вниз.',
                )}
            </p>
            <ol className="space-y-1.5">
                {items.map((item) => {
                    const Icon = ICONS[item.kind];

                    return (
                        <li key={`${item.kind}-${item.id}`}>
                            <button
                                type="button"
                                onClick={() => jump(item)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--gc-l3)]"
                            >
                                <span
                                    className={cn(
                                        'w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold',
                                        LEVEL_CLASS[item.level],
                                    )}
                                >
                                    {levelLabel(item.level)}
                                </span>
                                <Icon className="size-4 shrink-0 text-white/45" />
                                <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                                    <span className="text-white/45">
                                        {kindLabel(item.kind)} ·{' '}
                                    </span>
                                    {item.title}
                                    {item.reason && (
                                        <span className="text-white/45">
                                            {' '}
                                            — {item.reason}
                                        </span>
                                    )}
                                </span>
                                <span className="shrink-0 text-xs text-white/35 tabular-nums">
                                    {item.score}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}

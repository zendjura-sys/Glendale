import { tr } from '@/lib/i18n';

export type HeatmapData = {
    grid: number[][];
    max: number;
    peak: { day: number; hour: number } | null;
    total: number;
};

const DAYS = [
    tr('Пн'),
    tr('Вт'),
    tr('Ср'),
    tr('Чт'),
    tr('Пт'),
    tr('Сб'),
    tr('Нд'),
];

const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/**
 * Теплова карта: коли люди найактивніші (дні × години за Києвом, 4 тижні).
 * Один відтінок акценту: чим насиченіша клітинка, тим більше дій.
 */
export function ActivityHeatmap({ data }: { data: HeatmapData }) {
    if (data.total === 0) {
        return (
            <p className="text-sm text-white/45">
                {tr('Даних поки замало — карта з’явиться з першою активністю.')}
            </p>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[560px] grid-cols-[28px_repeat(24,minmax(0,1fr))] gap-[3px]">
                    <span />
                    {Array.from({ length: 24 }, (_, hour) => (
                        <span
                            key={hour}
                            className="text-center text-[10px] text-white/35 tabular-nums"
                        >
                            {hour % 3 === 0 ? hour : ''}
                        </span>
                    ))}
                    {data.grid.map((hours, day) => (
                        <div key={day} className="contents">
                            <span className="self-center text-[11px] text-white/45">
                                {DAYS[day]}
                            </span>
                            {hours.map((count, hour) => {
                                const level =
                                    data.max > 0
                                        ? Math.sqrt(count / data.max)
                                        : 0;

                                return (
                                    <span
                                        key={hour}
                                        title={tr('{day}, {hour}: {n} дій', {
                                            day: DAYS[day],
                                            hour: hh(hour),
                                            n: count,
                                        })}
                                        className="aspect-square rounded-[4px] bg-white/[0.04]"
                                        style={
                                            count > 0
                                                ? {
                                                      backgroundColor: `rgb(47 123 255 / ${(0.12 + level * 0.88).toFixed(2)})`,
                                                  }
                                                : undefined
                                        }
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            {data.peak && (
                <p className="mt-3 text-xs text-white/50">
                    {tr('Пік: {day} о {hour} — найкращий час для анонсів.', {
                        day: DAYS[data.peak.day],
                        hour: hh(data.peak.hour),
                    })}
                </p>
            )}
        </div>
    );
}

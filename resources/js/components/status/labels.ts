import { tr } from '@/lib/i18n';

export type HealthStatus = 'operational' | 'degraded' | 'down';

export type Incident = {
    id: number;
    title: string;
    severity: 'minor' | 'major';
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    updates: { status: string; message: string; at: string }[];
    started_at: string;
    resolved_at: string | null;
};

export type Component = {
    key: string;
    status: HealthStatus;
    latency_ms: number | null;
};

/** Назви складників і станів сторінки статусу (функції — щоб підписи йшли за мовою). */
export function componentLabel(key: string): string {
    return (
        {
            site: tr('Сайт і застосунок'),
            database: tr('База даних'),
            cache: tr('Кеш'),
            queue: tr('Фонові задачі й сповіщення'),
            storage: tr('Файли й медіа'),
        }[key] ?? key
    );
}

export function healthLabel(status: HealthStatus): string {
    return {
        operational: tr('Працює'),
        degraded: tr('Із затримками'),
        down: tr('Не працює'),
    }[status];
}

export function overallLabel(status: HealthStatus): string {
    return {
        operational: tr('Усе працює'),
        degraded: tr('Частина функцій працює повільніше'),
        down: tr('Збій — ми вже працюємо над ним'),
    }[status];
}

export function incidentStatusLabel(status: string): string {
    return (
        {
            investigating: tr('З’ясовуємо'),
            identified: tr('Причину знайдено'),
            monitoring: tr('Спостерігаємо'),
            resolved: tr('Вирішено'),
        }[status] ?? status
    );
}

export const healthDot: Record<HealthStatus, string> = {
    operational: 'bg-emerald-400',
    degraded: 'bg-amber-300',
    down: 'bg-red-400',
};

import { tr } from '@/lib/i18n';

/** Кольори обкладинки події за темою сезонних прикрас. */
export const EVENT_THEMES: Record<string, string[]> = {
    none: ['#4f46e5', '#0ea5e9'],
    newyear: ['#0c4a6e', '#38bdf8', '#e0f2fe'],
    valentine: ['#9f1239', '#fb7185'],
    easter: ['#4d7c0f', '#facc15'],
    independence: ['#0057b7', '#ffd700'],
    halloween: ['#431407', '#f97316', '#7e22ce'],
};

export function eventColors(theme: string): string[] {
    return EVENT_THEMES[theme] ?? EVENT_THEMES.none;
}

/** Назва метрики завдання: «Напишіть {n} записів» тощо. */
export function metricLabel(metric: string, n: number): string {
    switch (metric) {
        case 'posts':
            return tr('Опублікуйте записи: {n}', { n });
        case 'comments':
            return tr('Залиште коментарі: {n}', { n });
        case 'moments':
            return tr('Додайте моменти: {n}', { n });
        case 'plays':
            return tr('Прослухайте треки: {n}', { n });
        case 'photos':
            return tr('Завантажте фото: {n}', { n });
        case 'reviews':
            return tr('Напишіть огляди ігор: {n}', { n });
        default:
            return metric;
    }
}

/** Як звучить спільна мета: «записів від усіх». */
export function metricNoun(metric: string): string {
    switch (metric) {
        case 'posts':
            return tr('записів');
        case 'comments':
            return tr('коментарів');
        case 'moments':
            return tr('моментів');
        case 'plays':
            return tr('прослуховувань');
        case 'photos':
            return tr('фото');
        case 'reviews':
            return tr('оглядів');
        default:
            return metric;
    }
}

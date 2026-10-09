/**
 * Переклад інтерфейсу. Джерело — українська: сам текст і є ключем (`tr('Друзі')`).
 * Словник мови сервер віддає окремим скриптом (/i18n/{locale}.js) ще до модулів застосунку,
 * тому `tr()` працює й у константах модулів. Зміна мови — повне перезавантаження сторінки.
 */
type Dictionary = Record<string, string>;

type Boot = { locale: string; dict: Dictionary };

const boot: Boot = (typeof window !== 'undefined' &&
    (window as unknown as { __I18N__?: Boot }).__I18N__) || {
    locale: 'uk',
    dict: {},
};

/** Поточна мова (BCP 47: «uk», «en», «pt-BR») — і для Intl-форматів дат і чисел. */
export const LOCALE = boot.locale;

const dict = boot.dict;

/**
 * Переклад рядка. Параметри — у фігурних дужках: tr('Іде: {count}', { count: 3 }).
 */
export function tr(
    source: string,
    params?: Record<string, string | number | null | undefined>,
): string {
    const text = dict[source] ?? source;

    if (!params) {
        return text;
    }

    return text.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in params ? String(params[key] ?? '') : match,
    );
}

const rules = new Intl.PluralRules(LOCALE);

/**
 * Множина за правилами мови: форми — українські «один / кілька / багато»,
 * переклад зберігає ті самі три форми через «|».
 */
export function pluralForm(
    count: number,
    forms: readonly [string, string, string],
): string {
    const translated = dict[forms.join('|')]?.split('|');
    const [one, few, many] =
        translated?.length === 3
            ? (translated as [string, string, string])
            : forms;

    if (LOCALE === 'uk' || !translated) {
        const mod10 = count % 10;
        const mod100 = count % 100;

        if (mod10 === 1 && mod100 !== 11) {
            return one;
        }

        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
            return few;
        }

        return many;
    }

    switch (rules.select(count)) {
        case 'one':
            return one;
        case 'few':
        case 'two':
            return few;
        default:
            return many;
    }
}

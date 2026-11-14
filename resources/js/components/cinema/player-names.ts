import { tr } from '@/lib/i18n';

/**
 * Нейтральні підписи вбудованих плеєрів — однакові на сайті, в адмінці й у застосунку
 * (сервер: MovieSource::PROVIDERS). Назви постачальників людям не показуємо.
 */
export function playerName(provider: string): string {
    switch (provider) {
        case 'kodik':
            return tr('Плеєр 1');
        case 'videoseed':
            return tr('Плеєр 2');
        case 'flixcdn':
            return tr('Плеєр 3');
        case 'custom':
            return tr('Власний плеєр');
        default:
            return provider;
    }
}

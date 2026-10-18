import { tr } from '@/lib/i18n';

/** Стилі інтерфейсу (як App\Support\Skins на сервері). Підписи — для гравців, без термінів. */
export function SKINS(): { id: string; name: string; hint: string }[] {
    return [
        {
            id: 'gamecon',
            name: 'GameCon',
            hint: tr('Звична соцмережа, матове скло, світла й темна тема'),
        },
        {
            id: 'flat',
            name: tr('Плаский'),
            hint: tr('Чисто, спокійно, нічого зайвого'),
        },
        {
            id: 'hero',
            name: 'Hero',
            hint: tr('Прозоре скло, як у вітринах кіберміста'),
        },
        {
            id: 'material',
            name: 'Material',
            hint: tr('М’які кнопки й північне сяйво за склом'),
        },
        {
            id: 'flex',
            name: 'Flex',
            hint: tr('Скло, що переливається, як рідкий метал'),
        },
    ];
}

/** Теми сайту (App\\Support\\Skins::THEMES). */
export function THEMES(): {
    id: 'dark' | 'light' | 'system';
    name: string;
    hint: string;
}[] {
    return [
        {
            id: 'dark',
            name: tr('Неоновий синій'),
            hint: tr('Темна, з неоновим світлом'),
        },
        {
            id: 'light',
            name: tr('Крижана Арктика'),
            hint: tr('Світла, холодна й прозора'),
        },
        {
            id: 'system',
            name: tr('Як на пристрої'),
            hint: tr('Вдень світла, вночі темна — як у системі'),
        },
    ];
}

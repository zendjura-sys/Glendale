import { tr } from '@/lib/i18n';

/** Стилі інтерфейсу (як App\Support\Skins на сервері). Підписи — для гравців, без термінів. */
export function SKINS(): { id: string; name: string; hint: string }[] {
    return [
        {
            id: 'flat',
            name: tr('Основний'),
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

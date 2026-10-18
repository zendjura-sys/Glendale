import { tr } from '@/lib/i18n';

/** Стилі інтерфейсу (як App\Support\Skins на сервері). */
export function SKINS(): { id: string; name: string; hint: string }[] {
    return [
        {
            id: 'flat',
            name: tr('Основний'),
            hint: tr('Пласкі поверхні, як в Apple'),
        },
        { id: 'hero', name: 'Hero', hint: tr('HeroUI + glassmorphism') },
        {
            id: 'material',
            name: 'Material',
            hint: tr('Material 3 + аврора й матове скло'),
        },
        { id: 'flex', name: 'Flex', hint: tr('Flex UI + liquid glass') },
    ];
}

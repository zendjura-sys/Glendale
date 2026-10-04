import type { CommunityRole } from '@/types';
import { tr } from '@/lib/i18n';

export const roleLabels: Record<CommunityRole, string> = {
    owner: tr('Власник'),
    admin: tr('Адміністратор'),
    editor: tr('Редактор'),
    member: tr('Учасник'),
};

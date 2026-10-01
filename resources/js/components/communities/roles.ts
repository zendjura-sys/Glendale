import type { CommunityRole } from '@/types';

export const roleLabels: Record<CommunityRole, string> = {
    owner: 'Власник',
    admin: 'Адміністратор',
    editor: 'Редактор',
    member: 'Учасник',
};

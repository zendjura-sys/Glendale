import { Discussions } from '@/components/Discussions';
import { Crown } from 'lucide-react';
import { useState } from 'react';
import { Loading, PageHeader, Tabs, useSite } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { FamilyBank } from './Bank';
import { FamilyDiscipline, FamilyEvents, FamilyRating, FamilyWarehouse } from './Activity';
import { FamilyAudit, FamilyCharter, FamilyHistory, FamilyRelations, FamilyShifts, FamilyWiki } from './Info';
import { FamilyMembers } from './Members';
import { FamilyOverview } from './Overview';
import { FamilyQueue, FamilyReports } from './Reports';
import { FamilySettings } from './Settings';
import type { FamilyShell } from './types';

type TabId = 'overview' | 'talk' | 'reports' | 'queue' | 'members' | 'bank' | 'events' | 'rating' | 'discipline' | 'warehouse' | 'shifts' | 'charter' | 'wiki' | 'relations' | 'history' | 'audit' | 'settings';

/**
 * Сім’я в програмі — повністю, як на сайті: огляд, звіти з доказами, перевірка, склад і заявки,
 * банк (виведення, депозити, ручні операції), події, рейтинг, дисципліна, склад речей, зміни,
 * статут, вікі, союзи й війни, історія, журнал дій і налаштування. Права — з сервера (can).
 */
export function FamilyPage({ slug, initialTab }: { slug: string; initialTab?: string }) {
    const [tab, setTab] = useState<TabId>((initialTab as TabId) || 'overview');
    const shell = useSite<FamilyShell>(`/f/${slug}`);
    const d = shell.data;
    if (!d) return <Loading error={shell.error} />;
    const { family, can, badges } = d;
    const tabs: { id: TabId; label: string; badge?: number | null; show: boolean }[] = [
        { id: 'overview', label: 'Огляд', show: true },
        { id: 'reports', label: 'Мої звіти', badge: badges.my_pending, show: !!d.me },
        { id: 'queue', label: 'Перевірка', badge: badges.queue, show: !!can['reports.review'] || !!can['treasury.manage'] },
        { id: 'members', label: 'Склад', badge: badges.applications, show: true },
        { id: 'bank', label: 'Банк', show: !!d.me },
        { id: 'events', label: 'Події', show: family.sections.events },
        { id: 'rating', label: 'Рейтинг', show: family.sections.rating },
        { id: 'discipline', label: 'Дисципліна', show: !!d.me },
        { id: 'warehouse', label: 'Склад речей', badge: badges.alerts, show: family.sections.warehouse && !!d.me },
        { id: 'shifts', label: 'Зміни', show: family.sections.shifts && !!d.me },
        { id: 'charter', label: 'Статут', show: true },
        { id: 'wiki', label: 'Вікі', show: !!d.me },
        { id: 'relations', label: 'Союзи й війни', show: true },
        { id: 'history', label: 'Історія', show: true },
        { id: 'talk', label: 'Обговорення', show: true },
        { id: 'audit', label: 'Журнал', show: !!can['audit.view'] },
        { id: 'settings', label: 'Налаштування', show: !!can['settings.manage'] },
    ];
    const props = { slug, shell: d, reloadShell: shell.reload };
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title={
                    <span className="flex items-center gap-2">
                        {family.tag && <span className="text-neon-violet">[{family.tag}]</span>} {family.name}
                    </span>
                }
                subtitle={[d.me ? `${d.me.rank_title} · ${d.me.display}` : null, family.server?.name, `${family.members_count} учасників`, family.status_label].filter(Boolean).join(' · ')}
                image={family.logo_url ? <Avatar user={{ name: family.name, avatar_url: family.logo_url }} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon-violet/20"><Crown size={18} /></span>}
            />
            <Tabs tabs={tabs.filter((t) => t.show)} value={tab} onChange={setTab} />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {tab === 'overview' && <FamilyOverview {...props} />}
                {tab === 'reports' && <FamilyReports {...props} />}
                {tab === 'queue' && <FamilyQueue {...props} />}
                {tab === 'members' && <FamilyMembers {...props} />}
                {tab === 'bank' && <FamilyBank {...props} />}
                {tab === 'events' && <FamilyEvents {...props} />}
                {tab === 'rating' && <FamilyRating {...props} />}
                {tab === 'discipline' && <FamilyDiscipline {...props} />}
                {tab === 'warehouse' && <FamilyWarehouse {...props} />}
                {tab === 'shifts' && <FamilyShifts {...props} />}
                {tab === 'charter' && <FamilyCharter {...props} />}
                {tab === 'wiki' && <FamilyWiki {...props} />}
                {tab === 'relations' && <FamilyRelations {...props} />}
                {tab === 'history' && <FamilyHistory {...props} />}
                {tab === 'talk' && <Discussions subject={{ type: 'family', id: family.id }} />}
                {tab === 'audit' && <FamilyAudit {...props} />}
                {tab === 'settings' && <FamilySettings {...props} />}
            </div>
        </div>
    );
}

export type FamilyTabProps = { slug: string; shell: FamilyShell; reloadShell: () => Promise<void> };

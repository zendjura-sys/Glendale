import { Flame, MessageSquare } from 'lucide-react';
import { Card, PageHeader } from '@/components/kit';
import { Discussions } from '@/components/Discussions';
import { useLive } from '@/lib/api';

type Top = { discussions: { data: { id: number; title: string; replies_count: number; likes_count: number; category_label: string }[] } };

/** «Обговорення»: загальний розділ програми — теми ліворуч, найкращі й правила праворуч. */
export function DiscussionsPage() {
    const top = useLive<Top>('/api/v1/discussions/list?sort=top', 120_000);
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Обговорення" subtitle="Кіно, серіали, аніме, ігри, музика, техніка й усе інше" />
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_320px] gap-5 max-[1100px]:grid-cols-1">
                    <Discussions />
                    <aside className="space-y-4 max-[1100px]:hidden">
                        <Card title={<span className="flex items-center gap-2"><Flame size={15} className="text-orange-400" /> Найкращі теми</span>}>
                            {(top.data?.discussions.data ?? []).slice(0, 6).map((d, i) => (
                                <div key={d.id} className="flex gap-2.5 py-1.5 text-sm">
                                    <span className="w-4 text-white/35">{i + 1}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">{d.title}</span>
                                        <span className="text-xs text-white/40">{d.category_label} · ♥ {d.likes_count} · {d.replies_count} відп.</span>
                                    </span>
                                </div>
                            ))}
                            {top.data?.discussions.data.length === 0 && <p className="text-sm text-white/45">Поки порожньо.</p>}
                        </Card>
                        <Card title={<span className="flex items-center gap-2"><MessageSquare size={15} className="text-neon-cyan" /> Як тут заведено</span>}>
                            <ul className="space-y-1.5 text-sm text-white/65">
                                <li>• Обирайте розділ — так тему знайдуть ті, кому цікаво.</li>
                                <li>• Сюжетні подробиці — з позначкою «Спойлер».</li>
                                <li>• Відповідайте на конкретне повідомлення, щоб не губилась нитка.</li>
                                <li>• Теми про гру, фільм чи сервер можна створити й на їхній сторінці.</li>
                            </ul>
                        </Card>
                    </aside>
                </div>
            </div>
        </div>
    );
}

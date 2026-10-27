import { Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RowSkeleton } from '@/components/gc/skeletons';
import { AchievementProgress } from '@/components/profile/steam-achievements';
import type { AchievementGame } from '@/components/profile/steam-achievements';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

/** «Мої досягнення» в грі зі Steam — лише якщо профіль Steam прив’язано й у грі є досягнення. */
export function MyGameAchievements({ slug }: { slug: string }) {
    const [data, setData] = useState<AchievementGame | null | undefined>();

    useEffect(() => {
        let alive = true;
        api<{ data: AchievementGame | null }>(
            'GET',
            `/games/${slug}/achievements`,
        )
            .then((r) => alive && setData(r.data))
            .catch(() => alive && setData(null));

        return () => {
            alive = false;
        };
    }, [slug]);

    if (data === null) return null;

    return (
        <section className="glass mt-4 rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-white">
                <Trophy className="size-4 text-amber-300" />
                {tr('Мої досягнення')}
            </h2>
            {data === undefined ? (
                <RowSkeleton avatar="none" />
            ) : (
                <AchievementProgress data={data} />
            )}
        </section>
    );
}

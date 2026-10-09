import { Head, Link, router } from '@inertiajs/react';
import { tr } from '@/lib/i18n';
import { timeAgo } from '@/lib/format';

type Draft = {
    id: number;
    body: string | null;
    created_at: string;
    publish_at: string | null;
};

export default function Drafts({ drafts }: { drafts: Draft[] }) {
    return (
        <>
            <Head title={tr('Чернетки')} />
            <section className="mx-auto max-w-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="font-display text-2xl font-bold text-white">
                        {tr('Чернетки')}
                    </h1>
                    <Link
                        href="/feed"
                        className="text-sm text-white/50 hover:text-white"
                    >
                        {tr('До стрічки')}
                    </Link>
                </div>
                {drafts.length === 0 && (
                    <p className="glass rounded-3xl p-6 text-sm text-white/50">
                        {tr('Збережених чернеток немає.')}
                    </p>
                )}
                {drafts.map((draft) => (
                    <article
                        key={draft.id}
                        className="glass space-y-3 rounded-3xl p-5"
                    >
                        <p className="text-sm whitespace-pre-line text-white/80">
                            {draft.body || tr('Без тексту')}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <span>
                                {draft.publish_at
                                    ? tr('Заплановано')
                                    : timeAgo(draft.created_at)}
                            </span>
                            <button
                                type="button"
                                className="btn-glow ml-auto h-9 rounded-xl px-3 text-sm font-semibold"
                                onClick={() =>
                                    router.post(`/posts/${draft.id}/publish`)
                                }
                            >
                                {tr('Опублікувати')}
                            </button>
                            <button
                                type="button"
                                className="h-9 rounded-xl px-3 text-sm text-rose-200 hover:text-rose-100"
                                onClick={() =>
                                    router.delete(`/posts/${draft.id}`)
                                }
                            >
                                {tr('Видалити')}
                            </button>
                        </div>
                    </article>
                ))}
            </section>
        </>
    );
}

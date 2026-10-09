import { Head, Link } from '@inertiajs/react';
import { Star } from 'lucide-react';
import { EmptyState } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';

type Item = {
    id: number;
    body: string | null;
    preview: string;
    author: string | null;
    created_at: string;
    href: string;
};

export default function SavedMessages({ items }: { items: Item[] }) {
    return (
        <>
            <Head title={tr('Обрані')} />
            <div className="mx-auto w-full max-w-xl space-y-4">
                <h1 className="font-display text-2xl font-bold text-white">{tr('Обрані повідомлення')}</h1>
                {items.length === 0 ? (
                    <EmptyState
                        icon={Star}
                        title={tr('Обраних ще немає')}
                        text={tr('Зірочка на повідомленні збереже його тут.')}
                    />
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className="glass block rounded-3xl p-4 transition hover:border-white/15"
                            >
                                <span className="block text-xs text-white/40">
                                    {item.author ?? tr('Повідомлення')} · {formatDate(item.created_at, false)}
                                </span>
                                <span className="mt-1 block text-sm text-white">{item.body || item.preview}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

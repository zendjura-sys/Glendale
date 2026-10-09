import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Check, RotateCcw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Item = { source: string; value: string | null; manual: boolean };

type Props = {
    language: { code: string; native: string; name: string };
    items: Item[];
    total: number;
    page: number;
    pages: number;
    filters: { q: string; filter: 'all' | 'missing' | 'manual' };
};

/** Редактор перекладів: ручна правка не перезаписується автоперекладом. */
export default function LanguageStrings({
    language,
    items,
    total,
    page,
    pages,
    filters,
}: Props) {
    const [q, setQ] = useState(filters.q);
    const url = `/admin/languages/${language.code}/strings`;
    const visit = (patch: Partial<Props['filters'] & { page: number }>) =>
        router.get(
            url,
            { ...filters, q, page: 1, ...patch },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <>
            <Head title={tr('Переклади — {name}', { name: language.native })} />
            <Link
                href="/admin/languages"
                className="mb-3 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
            >
                <ArrowLeft className="size-4" /> {tr('Мови')}
            </Link>
            <PageHeader
                title={`${language.native} · ${language.code}`}
                description={tr(
                    'Виправлений вручну переклад позначається й не перезаписується автоперекладом. Порожнє поле — повернути автопереклад.',
                )}
            />
            <div className="mb-4 flex flex-wrap gap-2">
                <label className="input-glass flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/40" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Пошук у тексті чи перекладі')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white focus:outline-none"
                    />
                </label>
                {(
                    [
                        ['all', tr('Усі')],
                        ['missing', tr('Без перекладу')],
                        ['manual', tr('Виправлені вручну')],
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => visit({ filter: key })}
                        className={cn(
                            'h-10 rounded-xl px-3 text-sm',
                            filters.filter === key
                                ? 'bg-gradient-brand text-white'
                                : 'bg-white/[0.04] text-white/60 hover:text-white',
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <p className="mb-2 text-xs text-white/40">
                {tr('Знайдено: {total}', { total })}
            </p>
            <div className="space-y-2">
                {items.map((item) => (
                    <StringRow key={item.source} item={item} url={url} />
                ))}
            </div>
            {pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/60">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => visit({ page: page - 1 })}
                        className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] disabled:opacity-30"
                    >
                        ←
                    </button>
                    {page} / {pages}
                    <button
                        type="button"
                        disabled={page >= pages}
                        onClick={() => visit({ page: page + 1 })}
                        className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] disabled:opacity-30"
                    >
                        →
                    </button>
                </div>
            )}
        </>
    );
}

function StringRow({ item, url }: { item: Item; url: string }) {
    const [value, setValue] = useState(item.value ?? '');
    useEffect(() => setValue(item.value ?? ''), [item.value]);
    const save = (next: string) =>
        router.put(
            url,
            { source: item.source, value: next },
            { preserveScroll: true, preserveState: true },
        );

    return (
        <div className="glass rounded-2xl p-3">
            <p className="text-sm whitespace-pre-line text-white/70">
                {item.source}
            </p>
            <div className="mt-2 flex items-start gap-2">
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={Math.min(
                        4,
                        Math.max(1, Math.ceil(value.length / 70)),
                    )}
                    placeholder={tr('Без перекладу — показується українською')}
                    className={cn(
                        'input-glass min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-white',
                        item.manual && 'ring-1 ring-amber-400/40',
                    )}
                />
                <button
                    type="button"
                    disabled={value === (item.value ?? '')}
                    onClick={() => save(value)}
                    className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-200 disabled:opacity-30"
                    aria-label={tr('Зберегти')}
                >
                    <Check className="size-4" />
                </button>
                {item.manual && (
                    <button
                        type="button"
                        onClick={() => save('')}
                        className="rounded-xl bg-white/[0.06] p-2.5 text-white/60 hover:text-white"
                        aria-label={tr('Повернути автопереклад')}
                        title={tr('Повернути автопереклад')}
                    >
                        <RotateCcw className="size-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

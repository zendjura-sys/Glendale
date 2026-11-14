import { Head, router, useForm } from '@inertiajs/react';
import { FileUp, ListPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Row = {
    movie_id: number;
    slug: string;
    title: string;
    poster: string | null;
    status: 'planned' | 'watching' | 'watched' | 'on_hold' | 'dropped';
    rating: number | null;
    episodes: number;
    current: string | null;
};

type Props = {
    preview: {
        matched: Row[];
        unmatched: number;
        total: number;
        missing?: string[];
    } | null;
    source: 'shikimori' | 'mal' | 'anixart' | null;
};

function statusLabel(s: string): string {
    switch (s) {
        case 'planned':
            return tr('В планах');
        case 'watching':
            return tr('Дивлюся');
        case 'watched':
            return tr('Переглянуто');
        case 'on_hold':
            return tr('Відкладено');
        default:
            return tr('Кинуто');
    }
}

export default function AnimeImport({ preview }: Props) {
    const [source, setSource] = useState<'shikimori' | 'mal' | 'anixart'>(
        'shikimori',
    );
    const form = useForm<{
        source: string;
        nickname: string;
        file: File | null;
    }>({
        source: 'shikimori',
        nickname: '',
        file: null,
    });
    const [picked, setPicked] = useState<Set<number>>(
        () =>
            new Set(
                (preview?.matched ?? [])
                    .filter((r) => !r.current)
                    .map((r) => r.movie_id),
            ),
    );
    const [busy, setBusy] = useState(false);
    // Новий перегляд — знову відмічаємо все, чого ще немає у списках.
    useEffect(() => {
        setPicked(
            new Set(
                (preview?.matched ?? [])
                    .filter((r) => !r.current)
                    .map((r) => r.movie_id),
            ),
        );
    }, [preview]);

    return (
        <>
            <Head title={tr('Імпорт списків аніме')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <section className="gc-solid space-y-4 rounded-2xl p-5">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <ListPlus className="size-6 text-sky-400" />
                        {tr('Імпорт списків аніме')}
                    </h1>
                    <p className="text-sm text-white/60">
                        {tr(
                            'Перенесіть свої списки з Shikimori, MyAnimeList або Anixart: «Дивлюся», «Переглянуто», «В планах» і оцінки. Тайтли, які вже є у ваших списках, не змінюються.',
                        )}
                    </p>
                    <div className="flex gap-2">
                        {(['shikimori', 'mal', 'anixart'] as const).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => {
                                    setSource(s);
                                    form.setData('source', s);
                                }}
                                className={cn(
                                    'flex-1 rounded-xl px-3 py-2 text-sm font-semibold',
                                    source === s
                                        ? 'bg-primary text-white'
                                        : 'bg-white/5 text-white/70',
                                )}
                            >
                                {s === 'shikimori'
                                    ? 'Shikimori'
                                    : s === 'mal'
                                      ? 'MyAnimeList'
                                      : 'Anixart'}
                            </button>
                        ))}
                    </div>
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.post('/cinema/import/preview', {
                                forceFormData: true,
                            });
                        }}
                    >
                        {source === 'shikimori' ? (
                            <>
                                <Input
                                    placeholder={tr('Нік на Shikimori')}
                                    value={form.data.nickname}
                                    onChange={(e) =>
                                        form.setData('nickname', e.target.value)
                                    }
                                />
                                <InputError message={form.errors.nickname} />
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-white/50">
                                    {source === 'mal'
                                        ? tr(
                                              'На MyAnimeList: Профіль → Export Lists → Export My List — і завантажте отриманий файл (.xml або .xml.gz).',
                                          )
                                        : tr(
                                              'В Anixart: Профіль → Налаштування → Експорт закладок — і завантажте отриманий файл .csv. Тайтли знайдемо за назвами.',
                                          )}
                                </p>
                                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm text-white/70 hover:bg-white/5">
                                    <FileUp className="size-4" />
                                    {form.data.file?.name ??
                                        tr('Обрати файл експорту')}
                                    <input
                                        type="file"
                                        accept={
                                            source === 'mal'
                                                ? '.xml,.gz,application/xml,application/gzip'
                                                : '.csv,text/csv'
                                        }
                                        className="hidden"
                                        onChange={(e) =>
                                            form.setData(
                                                'file',
                                                e.target.files?.[0] ?? null,
                                            )
                                        }
                                    />
                                </label>
                                <InputError message={form.errors.file} />
                            </>
                        )}
                        <Button type="submit" disabled={form.processing}>
                            {tr('Знайти тайтли')}
                        </Button>
                    </form>
                </section>

                {preview && (
                    <section className="space-y-3">
                        <p className="text-sm text-white/70">
                            {tr(
                                'У списку: {t} · знайдено в каталозі: {n} · поки немає: {u}',
                                {
                                    t: preview.total,
                                    n: preview.matched.length,
                                    u: preview.unmatched,
                                },
                            )}
                        </p>
                        <ul className="space-y-2">
                            {preview.matched.map((r) => (
                                <li
                                    key={r.movie_id}
                                    className={cn(
                                        'gc-solid flex items-center gap-3 rounded-xl p-2.5',
                                        r.current && 'opacity-60',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        disabled={!!r.current}
                                        checked={picked.has(r.movie_id)}
                                        onChange={(e) =>
                                            setPicked((set) => {
                                                const next = new Set(set);
                                                if (e.target.checked)
                                                    next.add(r.movie_id);
                                                else next.delete(r.movie_id);

                                                return next;
                                            })
                                        }
                                    />
                                    {r.poster ? (
                                        <img
                                            src={r.poster}
                                            alt=""
                                            className="h-14 w-10 shrink-0 rounded-md object-cover"
                                        />
                                    ) : (
                                        <span className="h-14 w-10 shrink-0 rounded-md bg-white/10" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-white">
                                            {r.title}
                                        </div>
                                        <div className="text-xs text-white/50">
                                            {statusLabel(r.status)}
                                            {r.rating
                                                ? ` · ${tr('оцінка {n}', { n: r.rating })}`
                                                : ''}
                                            {r.current &&
                                                ` · ${tr('вже у списку')}`}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {(preview.missing?.length ?? 0) > 0 && (
                            <div className="gc-solid space-y-2 rounded-xl p-4">
                                <div className="text-sm font-semibold text-white">
                                    {tr('Немає в каталозі')}
                                </div>
                                <p className="text-xs text-white/55">
                                    {preview.missing!.slice(0, 12).join(' · ')}
                                    {preview.missing!.length > 12 && ' …'}
                                </p>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                        router.post(
                                            '/cinema/import/requests',
                                            { titles: preview.missing },
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    {tr('Попросити додати ({n})', {
                                        n: preview.missing!.length,
                                    })}
                                </Button>
                            </div>
                        )}
                        <div className="sticky bottom-4 flex justify-end">
                            <Button
                                disabled={picked.size === 0 || busy}
                                onClick={() => {
                                    setBusy(true);
                                    router.post(
                                        '/cinema/import',
                                        { movies: [...picked] },
                                        { onFinish: () => setBusy(false) },
                                    );
                                }}
                            >
                                {tr('Додати в мої списки ({n})', {
                                    n: picked.size,
                                })}
                            </Button>
                        </div>
                    </section>
                )}
            </div>
        </>
    );
}

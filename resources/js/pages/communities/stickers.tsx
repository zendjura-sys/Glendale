import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, Sticker, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

type StickerItem = { id: number; url: string; emoji: string | null };

/** Набір стікерів спільноти: учасники бачать, керівники додають і прибирають. */
export default function CommunityStickers({
    community,
    pack,
    can_manage,
    limit,
}: {
    community: { slug: string; name: string };
    pack: { id: number; name: string; stickers: StickerItem[] } | null;
    can_manage: boolean;
    limit: number;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const stickers = pack?.stickers ?? [];

    const upload = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setBusy(true);
        router.post(
            `/c/${community.slug}/stickers`,
            { stickers: Array.from(files) },
            {
                forceFormData: true,
                preserveScroll: true,
                onFinish: () => {
                    setBusy(false);
                    if (input.current) input.current.value = '';
                },
            },
        );
    };

    return (
        <>
            <Head title={tr('Стікери · {name}', { name: community.name })} />
            <div className="mx-auto max-w-3xl space-y-4">
                <Link
                    href={`/c/${community.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
                >
                    <ChevronLeft className="size-4" />
                    {community.name}
                </Link>
                <header className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <h1 className="font-display text-2xl font-bold text-white">
                            {tr('Стікери спільноти')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Учасники надсилають їх у будь-якому чаті — набір з’являється в панелі стікерів.',
                            )}
                        </p>
                    </div>
                    {can_manage && (
                        <>
                            <input
                                ref={input}
                                type="file"
                                accept="image/png,image/webp,image/gif"
                                multiple
                                hidden
                                onChange={(e) => upload(e.target.files)}
                            />
                            <button
                                type="button"
                                disabled={busy || stickers.length >= limit}
                                onClick={() => input.current?.click()}
                                className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                <Upload className="size-4" />
                                {tr('Додати стікери')}
                            </button>
                        </>
                    )}
                </header>
                {can_manage && (
                    <p className="text-xs text-white/40">
                        {tr(
                            'PNG, WebP чи GIF до 512×512 px, до {limit} стікерів у наборі. Зараз: {count}.',
                            { limit, count: stickers.length },
                        )}
                    </p>
                )}
                {stickers.length === 0 ? (
                    <EmptyState
                        icon={Sticker}
                        title={tr('Набору ще немає')}
                        text={
                            can_manage
                                ? tr(
                                      'Завантажте перші стікери — і їх зможуть надсилати всі учасники.',
                                  )
                                : tr(
                                      'Керівники спільноти ще не додали стікерів.',
                                  )
                        }
                    />
                ) : (
                    <div className="gc-solid grid grid-cols-4 gap-3 rounded-2xl p-4 sm:grid-cols-6">
                        {stickers.map((sticker) => (
                            <div key={sticker.id} className="group relative">
                                <img
                                    src={sticker.url}
                                    alt={sticker.emoji ?? ''}
                                    className="aspect-square w-full object-contain"
                                    loading="lazy"
                                />
                                {can_manage && (
                                    <button
                                        type="button"
                                        aria-label={tr('Видалити')}
                                        onClick={() => {
                                            if (
                                                confirm(
                                                    tr(
                                                        'Прибрати стікер з набору?',
                                                    ),
                                                )
                                            ) {
                                                router.delete(
                                                    `/c/${community.slug}/stickers/${sticker.id}`,
                                                    { preserveScroll: true },
                                                );
                                            }
                                        }}
                                        className="absolute top-0 right-0 rounded-lg bg-black/60 p-1 text-white/80 opacity-0 transition group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

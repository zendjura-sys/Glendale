import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ImagePlus,
    Plus,
    Send,
    Smile,
    Sticker as StickerIcon,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StickerItem } from '@/types';
import { tr } from '@/lib/i18n';

type AdminPack = {
    id: number;
    slug: string;
    name: string;
    author: string | null;
    is_active: boolean;
    position: number;
    stickers: StickerItem[];
};

type Props = {
    packs: AdminPack[];
    stats: { packs: number; stickers: number; sent: number };
    limits: { per_pack: number };
};

export default function AdminStickers({ packs, stats, limits }: Props) {
    const form = useForm({ name: '', author: '' });

    const create = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/stickers', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title={tr('Стікери — Адмін-панель')} />
            <PageHeader
                title={tr('Стікери')}
                description={tr(
                    'Набори стікерів для месенджера. Вимкнені набори зникають з панелі, але вже надіслані стікери лишаються в чатах.',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Наборів')}
                    value={stats.packs}
                    icon={Smile}
                />
                <StatCard
                    label={tr('Стікерів')}
                    value={stats.stickers}
                    icon={StickerIcon}
                    tone="from-gc-pink to-gc-purple"
                    delay={60}
                />
                <StatCard
                    label={tr('Надіслано в чатах')}
                    value={stats.sent}
                    icon={Send}
                    tone="from-gc-mint to-gc-cyan"
                    delay={120}
                />
            </div>

            <form
                onSubmit={create}
                className="glass mb-5 flex flex-wrap items-start gap-2 rounded-2xl p-3"
            >
                <div className="min-w-[200px] flex-1">
                    <Input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder={tr('Назва нового набору')}
                        className="h-10"
                    />
                    <InputError message={form.errors.name} className="mt-1" />
                </div>
                <Input
                    value={form.data.author}
                    onChange={(e) => form.setData('author', e.target.value)}
                    placeholder={tr('Автор (необов’язково)')}
                    className="h-10 w-full sm:w-56"
                />
                <button
                    type="submit"
                    disabled={form.processing || !form.data.name.trim()}
                    className="btn-glow flex h-10 items-center gap-2 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus className="size-4" /> {tr('Створити набір')}
                </button>
            </form>

            <div className="grid gap-4">
                {packs.map((pack, index) => (
                    <PackCard
                        key={pack.id}
                        pack={pack}
                        first={index === 0}
                        last={index === packs.length - 1}
                        limit={limits.per_pack}
                    />
                ))}
                {packs.length === 0 && (
                    <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                        {tr(
                            'Наборів ще немає. Створіть перший і завантажте PNG, WebP або GIF до 1 МБ.',
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function PackCard({
    pack,
    first,
    last,
    limit,
}: {
    pack: AdminPack;
    first: boolean;
    last: boolean;
    limit: number;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [emoji, setEmoji] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const patch = (data: { move?: 'up' | 'down'; is_active?: boolean }) =>
        router.patch(`/admin/stickers/${pack.id}`, data, {
            preserveScroll: true,
        });

    const upload = (files: FileList | null) => {
        if (!files?.length) return;
        setUploading(true);
        setError(null);
        router.post(
            `/admin/stickers/${pack.id}/items`,
            { stickers: Array.from(files), emoji: emoji || null },
            {
                forceFormData: true,
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ?? tr('Помилка завантаження'),
                    ),
                onFinish: () => setUploading(false),
            },
        );
    };

    const iconButton =
        'flex size-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30';

    return (
        <section
            className={cn(
                'glass rounded-3xl p-4 sm:p-5',
                !pack.is_active && 'opacity-70',
            )}
        >
            <header className="mb-4 flex flex-wrap items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.05] p-1.5">
                    {pack.stickers[0] ? (
                        <img
                            src={pack.stickers[0].url}
                            alt=""
                            className="size-full object-contain"
                        />
                    ) : (
                        <StickerIcon className="size-5 text-white/30" />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-bold text-white">
                            {pack.name}
                        </h2>
                        <Pill tone={pack.is_active ? 'green' : 'default'}>
                            {pack.is_active ? tr('Активний') : tr('Вимкнено')}
                        </Pill>
                        <Pill>
                            {pack.stickers.length} / {limit}
                        </Pill>
                    </div>
                    <p className="mt-0.5 text-xs text-white/40">
                        {pack.author
                            ? tr('Автор: {author}', { author: pack.author })
                            : pack.slug}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className={iconButton}
                        disabled={first}
                        onClick={() => patch({ move: 'up' })}
                        title={tr('Вище')}
                    >
                        <ArrowUp className="size-4" />
                    </button>
                    <button
                        type="button"
                        className={iconButton}
                        disabled={last}
                        onClick={() => patch({ move: 'down' })}
                        title={tr('Нижче')}
                    >
                        <ArrowDown className="size-4" />
                    </button>
                    <span className="mx-1.5">
                        <Toggle
                            checked={pack.is_active}
                            onChange={(value) => patch({ is_active: value })}
                            label={tr('Активний')}
                        />
                    </span>
                    <button
                        type="button"
                        className={cn(iconButton, 'hover:text-rose-300')}
                        onClick={() => {
                            if (
                                confirm(
                                    tr('Видалити набір «{name}»?', {
                                        name: pack.name,
                                    }),
                                )
                            ) {
                                router.delete(`/admin/stickers/${pack.id}`, {
                                    preserveScroll: true,
                                });
                            }
                        }}
                        title={tr('Видалити набір')}
                    >
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                {pack.stickers.map((sticker) => (
                    <div
                        key={sticker.id}
                        className="group relative aspect-square rounded-2xl bg-white/[0.03] p-1.5 ring-1 ring-white/[0.05]"
                    >
                        <img
                            src={sticker.url}
                            alt={sticker.emoji ?? ''}
                            loading="lazy"
                            className="size-full object-contain"
                        />
                        {sticker.emoji && (
                            <span className="absolute bottom-1 left-1.5 text-xs">
                                {sticker.emoji}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() =>
                                router.delete(
                                    `/admin/stickers/${pack.id}/items/${sticker.id}`,
                                    { preserveScroll: true },
                                )
                            }
                            className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-rose-200 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                            title={tr('Видалити')}
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || pack.stickers.length >= limit}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 text-xs text-white/45 transition hover:border-[#8b7dff]/60 hover:text-white disabled:opacity-40"
                >
                    <ImagePlus className="size-5" />
                    {uploading ? tr('Завантаження…') : tr('Додати')}
                </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/40">
                <span>{tr('Емодзі для нових стікерів:')}</span>
                <input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
                    placeholder="😎"
                    className="input-glass h-8 w-16 rounded-lg px-2 text-center text-sm text-white"
                />
                <span>
                    {tr('PNG, WebP або GIF · до 1 МБ · до 1024×1024 px')}
                </span>
            </div>
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

            <input
                ref={fileRef}
                type="file"
                accept="image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => {
                    upload(e.target.files);
                    e.target.value = '';
                }}
            />
        </section>
    );
}

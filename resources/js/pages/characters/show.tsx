import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Briefcase,
    Cake,
    Crown,
    ImagePlus,
    Pencil,
    Star,
    Trash2,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
    CharacterPortrait,
    CharacterRow,
    STATUS_LABELS,
    STATUS_TONE,
} from '@/components/characters/character-card';
import type { CharacterCardData } from '@/components/characters/character-card';
import { ServerIcon } from '@/components/servers/server-icon';
import { Lightbox } from '@/components/gc/media-grid';
import { formatDate, plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    character: CharacterCardData & {
        story: string | null;
        photos: string[];
        created_at: string;
    };
    others: CharacterCardData[];
    can_edit: boolean;
    photo_limit: number;
};

export default function CharacterShow({
    character,
    others,
    can_edit,
    photo_limit,
}: Props) {
    const input = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [open, setOpen] = useState<number | null>(null);

    const upload = (file: File) =>
        router.post(
            `/characters/${character.id}/photos`,
            { photo: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setUploading(true),
                onFinish: () => setUploading(false),
            },
        );

    return (
        <>
            <Head title={character.name} />
            <div className="mx-auto max-w-4xl space-y-5">
                <Link
                    href={`/${character.player.username}`}
                    className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {character.player.name}
                </Link>

                <section className="glass overflow-hidden rounded-3xl">
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
                        <CharacterPortrait
                            character={character}
                            className="aspect-[4/5] w-44 shrink-0 self-center rounded-2xl text-6xl sm:w-56 sm:self-start"
                        />
                        <div className="min-w-0 flex-1 space-y-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-display text-2xl font-bold break-words text-white sm:text-3xl">
                                        {character.name}
                                    </h1>
                                    {character.is_main && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                                            <Star className="size-3.5 fill-amber-300" />
                                            {tr('Головний')}
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            'rounded-full px-2.5 py-1 text-xs font-medium',
                                            STATUS_TONE[character.status],
                                        )}
                                    >
                                        {STATUS_LABELS()[character.status]}
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/60">
                                    {character.age !== null && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Cake className="size-4 text-white/40" />
                                            {character.age}{' '}
                                            {plural(character.age, [
                                                'рік',
                                                'роки',
                                                'років',
                                            ])}
                                        </span>
                                    )}
                                    {character.occupation && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Briefcase className="size-4 text-white/40" />
                                            {character.occupation}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Link
                                    href={`/servers/${character.server.slug}`}
                                    className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white transition hover:bg-white/10"
                                >
                                    <ServerIcon
                                        name={character.server.name}
                                        icon={character.server.icon}
                                        className="size-6"
                                    />
                                    <span className="truncate">
                                        {character.server.name}
                                    </span>
                                </Link>
                                {character.family && (
                                    <Link
                                        href={`/f/${character.family.slug}`}
                                        className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white transition hover:bg-white/10"
                                    >
                                        <Crown className="size-4 text-amber-300" />
                                        <span className="truncate">
                                            [{character.family.tag}]{' '}
                                            {character.family.name}
                                        </span>
                                    </Link>
                                )}
                            </div>

                            {character.bio && (
                                <p className="text-sm leading-relaxed whitespace-pre-line text-white/75">
                                    {character.bio}
                                </p>
                            )}

                            {can_edit && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Link
                                        href={`/characters/${character.id}/edit`}
                                        className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                                    >
                                        <Pencil className="size-4" />
                                        {tr('Редагувати')}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    tr(
                                                        'Видалити персонажа разом з фото?',
                                                    ),
                                                )
                                            ) {
                                                router.delete(
                                                    `/characters/${character.id}`,
                                                );
                                            }
                                        }}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-400/10"
                                    >
                                        <Trash2 className="size-4" />
                                        {tr('Видалити')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {character.story && (
                    <section className="glass rounded-3xl p-5 sm:p-6">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Історія')}
                        </h2>
                        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-white/80">
                            {character.story}
                        </p>
                    </section>
                )}

                {(character.photos.length > 0 || can_edit) && (
                    <section className="glass rounded-3xl p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="font-display text-lg font-bold text-white">
                                {tr('Фото')}
                            </h2>
                            {can_edit &&
                                character.photos.length < photo_limit && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={uploading}
                                            onClick={() =>
                                                input.current?.click()
                                            }
                                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                                        >
                                            <ImagePlus className="size-4" />
                                            {uploading
                                                ? tr('Завантажуємо…')
                                                : tr('Додати фото')}
                                        </button>
                                        <input
                                            ref={input}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0];
                                                if (file) upload(file);
                                                event.target.value = '';
                                            }}
                                        />
                                    </>
                                )}
                        </div>
                        {character.photos.length === 0 ? (
                            <p className="mt-3 text-sm text-white/45">
                                {tr(
                                    'Скриншоти з гри: персонаж, авто, дім — до 6 фото.',
                                )}
                            </p>
                        ) : (
                            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {character.photos.map((url, index) => (
                                    <div
                                        key={url}
                                        className="group relative overflow-hidden rounded-2xl"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setOpen(index)}
                                            className="block w-full"
                                        >
                                            <img
                                                src={url}
                                                alt=""
                                                loading="lazy"
                                                className="aspect-video w-full object-cover"
                                            />
                                        </button>
                                        {can_edit && (
                                            <button
                                                type="button"
                                                aria-label={tr('Прибрати фото')}
                                                onClick={() =>
                                                    router.delete(
                                                        `/characters/${character.id}/photos/${index}`,
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {others.length > 0 && (
                    <section className="glass rounded-3xl p-5">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Інші персонажі гравця')}
                        </h2>
                        <div className="mt-3 grid gap-1 sm:grid-cols-2">
                            {others.map((other) => (
                                <CharacterRow
                                    key={other.id}
                                    character={other}
                                />
                            ))}
                        </div>
                    </section>
                )}

                <p className="text-center text-xs text-white/35">
                    {tr('Створено {date}', {
                        date: formatDate(character.created_at),
                    })}
                </p>
            </div>
            {open !== null && (
                <Lightbox
                    items={character.photos.map((url, id) => ({
                        id,
                        type: 'image' as const,
                        url,
                        width: null,
                        height: null,
                    }))}
                    index={open}
                    onClose={() => setOpen(null)}
                />
            )}
        </>
    );
}

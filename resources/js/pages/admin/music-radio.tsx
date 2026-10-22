import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    ImagePlus,
    Pencil,
    Plus,
    Radio,
    RadioTower,
    Activity,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Station = {
    id: number;
    name: string;
    slug: string;
    tagline: string | null;
    stream_url: string;
    homepage: string | null;
    logo_url: string | null;
    /** Логотип за зовнішньою адресою (не файл на нашому диску). */
    logo_external: boolean;
    genre: string | null;
    country: string | null;
    is_active: boolean;
    position: number;
};

type Props = {
    stations: Station[];
    genres: string[];
    stats: { total: number; active: number };
};

const iconButton =
    'flex size-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-30';

export default function AdminMusicRadio({ stations, genres, stats }: Props) {
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<number | null>(null);

    return (
        <>
            <Head title={tr('Радіостанції — Адмін-панель')} />
            <PageHeader
                title={tr('Радіостанції')}
                description={tr(
                    'Інтернет-радіо для вкладки «Радіо». Потік — лише https; вимкнені станції слухачі не бачать.',
                )}
                actions={
                    !adding && (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white"
                        >
                            <Plus className="size-4" /> {tr('Додати станцію')}
                        </button>
                    )
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3">
                <StatCard
                    label={tr('Станцій')}
                    value={stats.total}
                    icon={RadioTower}
                />
                <StatCard
                    label={tr('Увімкнено')}
                    value={stats.active}
                    icon={Radio}
                    tone="from-gc-mint to-gc-cyan"
                    delay={60}
                />
            </div>

            <datalist id="radio-genres">
                {genres.map((genre) => (
                    <option key={genre} value={genre} />
                ))}
            </datalist>

            {adding && (
                <section className="glass mb-5 rounded-2xl p-4 sm:p-5">
                    <h2 className="mb-4 font-display text-base font-bold text-white">
                        {tr('Нова станція')}
                    </h2>
                    <StationForm onDone={() => setAdding(false)} />
                </section>
            )}

            <div className="glass overflow-hidden rounded-2xl">
                {stations.map((station, index) =>
                    editing === station.id ? (
                        <div
                            key={station.id}
                            className="border-b border-white/[0.06] p-4 last:border-0 sm:p-5"
                        >
                            <StationForm
                                station={station}
                                onDone={() => setEditing(null)}
                            />
                        </div>
                    ) : (
                        <StationRow
                            key={station.id}
                            station={station}
                            first={index === 0}
                            last={index === stations.length - 1}
                            onEdit={() => setEditing(station.id)}
                        />
                    ),
                )}
                {stations.length === 0 && (
                    <div className="px-6 py-14 text-center text-sm text-white/40">
                        {tr(
                            'Станцій ще немає. Додайте першу — вона з’явиться у вкладці «Радіо».',
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function StationRow({
    station,
    first,
    last,
    onEdit,
}: {
    station: Station;
    first: boolean;
    last: boolean;
    onEdit: () => void;
}) {
    const [probing, setProbing] = useState(false);

    const patch = (data: { move?: 'up' | 'down'; is_active?: boolean }) =>
        router.patch(`/admin/music/radio/${station.id}/flags`, data, {
            preserveScroll: true,
        });

    const probe = () => {
        setProbing(true);
        router.post(
            `/admin/music/radio/${station.id}/probe`,
            {},
            { preserveScroll: true, onFinish: () => setProbing(false) },
        );
    };

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-3 border-b border-white/[0.04] px-4 py-3 last:border-0',
                !station.is_active && 'opacity-60',
            )}
        >
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05]">
                {station.logo_url ? (
                    <img
                        src={station.logo_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                    />
                ) : (
                    <Radio className="size-5 text-white/30" />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-white">
                        {station.name}
                    </p>
                    {station.genre && <Pill>{station.genre}</Pill>}
                    {station.country && <Pill>{station.country}</Pill>}
                </div>
                <p className="truncate text-xs text-white/40">
                    {station.tagline ? `${station.tagline} · ` : ''}
                    {station.stream_url}
                </p>
            </div>
            <div className="flex items-center gap-1">
                {station.homepage && (
                    <a
                        href={station.homepage}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={iconButton}
                        title={tr('Сайт станції')}
                    >
                        <ExternalLink className="size-4" />
                    </a>
                )}
                <button
                    type="button"
                    onClick={probe}
                    disabled={probing}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                    <Activity className="size-3.5" />
                    {probing ? tr('Перевіряємо…') : tr('Перевірити потік')}
                </button>
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
                        checked={station.is_active}
                        onChange={(value) => patch({ is_active: value })}
                        label={tr('Увімкнено')}
                    />
                </span>
                <button
                    type="button"
                    className={iconButton}
                    onClick={onEdit}
                    title={tr('Редагувати')}
                >
                    <Pencil className="size-4" />
                </button>
                <button
                    type="button"
                    className={cn(iconButton, 'hover:text-rose-300')}
                    onClick={() => {
                        if (
                            confirm(
                                tr('Видалити станцію «{name}»?', {
                                    name: station.name,
                                }),
                            )
                        ) {
                            router.delete(`/admin/music/radio/${station.id}`, {
                                preserveScroll: true,
                            });
                        }
                    }}
                    title={tr('Видалити')}
                >
                    <Trash2 className="size-4" />
                </button>
            </div>
        </div>
    );
}

function StationForm({
    station,
    onDone,
}: {
    station?: Station;
    onDone: () => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const form = useForm<{
        name: string;
        tagline: string;
        stream_url: string;
        homepage: string;
        genre: string;
        country: string;
        is_active: boolean;
        logo: File | null;
        logo_url: string;
        remove_logo: boolean;
    }>({
        name: station?.name ?? '',
        tagline: station?.tagline ?? '',
        stream_url: station?.stream_url ?? '',
        homepage: station?.homepage ?? '',
        genre: station?.genre ?? '',
        country: station?.country ?? '',
        is_active: station?.is_active ?? true,
        logo: null,
        logo_url: station?.logo_external ? (station.logo_url ?? '') : '',
        remove_logo: false,
    });
    const upload = useMemo(
        () => (form.data.logo ? URL.createObjectURL(form.data.logo) : null),
        [form.data.logo],
    );
    useEffect(
        () => () => {
            if (upload) URL.revokeObjectURL(upload);
        },
        [upload],
    );
    const preview = upload
        ? upload
        : form.data.remove_logo
          ? null
          : form.data.logo_url || station?.logo_url || null;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(
            station ? `/admin/music/radio/${station.id}` : '/admin/music/radio',
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => onDone(),
            },
        );
    };

    const field = (
        key: 'name' | 'tagline' | 'stream_url' | 'homepage',
        placeholder: string,
        className?: string,
    ) => (
        <div className={className}>
            <Input
                value={form.data[key]}
                onChange={(e) => form.setData(key, e.target.value)}
                placeholder={placeholder}
                className="h-10"
            />
            <InputError message={form.errors[key]} className="mt-1" />
        </div>
    );

    return (
        <form onSubmit={submit} className="grid gap-3">
            <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 text-white/40 transition hover:border-primary/60 hover:text-white"
                        title={tr('Завантажити логотип')}
                    >
                        {preview ? (
                            <img
                                src={preview}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : (
                            <ImagePlus className="size-5" />
                        )}
                    </button>
                    {preview && (
                        <button
                            type="button"
                            onClick={() => {
                                form.setData((data) => ({
                                    ...data,
                                    logo: null,
                                    logo_url: '',
                                    remove_logo: true,
                                }));
                            }}
                            className="flex items-center gap-1 text-xs text-white/40 hover:text-rose-300"
                        >
                            <X className="size-3" /> {tr('Прибрати')}
                        </button>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            form.setData((data) => ({
                                ...data,
                                logo: file,
                                logo_url: '',
                                remove_logo: false,
                            }));
                            e.target.value = '';
                        }}
                    />
                </div>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    {field('name', tr('Назва станції'))}
                    {field('tagline', tr('Короткий опис (необов’язково)'))}
                    {field(
                        'stream_url',
                        tr('Адреса потоку https://…'),
                        'sm:col-span-2',
                    )}
                    {field('homepage', tr('Сайт станції (необов’язково)'))}
                    <div>
                        <Input
                            value={form.data.logo_url}
                            onChange={(e) =>
                                form.setData((data) => ({
                                    ...data,
                                    logo_url: e.target.value,
                                    logo: null,
                                    remove_logo: false,
                                }))
                            }
                            placeholder={tr('Або адреса логотипа https://…')}
                            className="h-10"
                        />
                        <InputError
                            message={form.errors.logo_url ?? form.errors.logo}
                            className="mt-1"
                        />
                    </div>
                    <div className="flex gap-3">
                        <div className="min-w-0 flex-1">
                            <Input
                                value={form.data.genre}
                                onChange={(e) =>
                                    form.setData('genre', e.target.value)
                                }
                                list="radio-genres"
                                placeholder={tr('Жанр')}
                                className="h-10"
                            />
                            <InputError
                                message={form.errors.genre}
                                className="mt-1"
                            />
                        </div>
                        <div className="w-24">
                            <Input
                                value={form.data.country}
                                onChange={(e) =>
                                    form.setData(
                                        'country',
                                        e.target.value
                                            .replace(/[^a-z]/gi, '')
                                            .slice(0, 2)
                                            .toUpperCase(),
                                    )
                                }
                                placeholder="UA"
                                aria-label={tr('Країна')}
                                className="h-10 text-center"
                            />
                            <InputError
                                message={form.errors.country}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-3 text-sm text-white/65">
                        <Toggle
                            checked={form.data.is_active}
                            onChange={(value) =>
                                form.setData('is_active', value)
                            }
                            label={tr('Увімкнено')}
                        />
                        {tr('Показувати слухачам')}
                    </label>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onDone}
                    className="h-10 rounded-xl px-4 text-sm font-medium text-white/60 hover:bg-white/[0.06] hover:text-white"
                >
                    {tr('Скасувати')}
                </button>
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        !form.data.name.trim() ||
                        !form.data.stream_url.trim()
                    }
                    className="h-10 rounded-xl bg-gradient-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {station ? tr('Зберегти') : tr('Додати станцію')}
                </button>
            </div>
        </form>
    );
}

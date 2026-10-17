import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Drama, ImagePlus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    character: {
        id: number;
        name: string;
        age: number | null;
        occupation: string | null;
        bio: string | null;
        story: string | null;
        status: string;
        is_main: boolean;
        family_id: number | null;
        portrait_url: string | null;
    } | null;
    server: string | null;
    servers: { slug: string; name: string }[];
    families: { id: number; name: string; tag: string; server: string }[];
    statuses: Record<string, string>;
};

const STATUS_OPTIONS = () => [
    { value: 'active', label: tr('Грає') },
    { value: 'retired', label: tr('На паузі') },
    { value: 'dead', label: tr('Загинув') },
];

const fieldClass =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

function Field({
    label,
    error,
    hint,
    children,
}: {
    label: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block min-w-0 space-y-1.5">
            <span className="text-xs font-medium text-white/60">{label}</span>
            {children}
            {hint && !error && (
                <span className="block text-xs text-white/35">{hint}</span>
            )}
            {error && (
                <span className="block text-xs text-rose-300">{error}</span>
            )}
        </label>
    );
}

export default function CharacterEdit({
    character,
    server,
    servers,
    families,
}: Props) {
    const form = useForm<{
        server: string;
        name: string;
        age: string;
        occupation: string;
        bio: string;
        story: string;
        status: string;
        is_main: boolean;
        family_id: string;
        portrait: File | null;
    }>({
        server: server ?? servers[0]?.slug ?? '',
        name: character?.name ?? '',
        age: character?.age ? String(character.age) : '',
        occupation: character?.occupation ?? '',
        bio: character?.bio ?? '',
        story: character?.story ?? '',
        status: character?.status ?? 'active',
        is_main: character?.is_main ?? false,
        family_id: character?.family_id ? String(character.family_id) : '',
        portrait: null,
    });
    const [preview, setPreview] = useState<string | null>(
        character?.portrait_url ?? null,
    );
    const serverFamilies = useMemo(
        () => families.filter((family) => family.server === form.data.server),
        [families, form.data.server],
    );

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            age: data.age === '' ? null : Number(data.age),
            family_id: data.family_id === '' ? null : Number(data.family_id),
            is_main: data.is_main ? 1 : 0,
        }));
        form.post(character ? `/characters/${character.id}` : '/characters', {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head
                title={
                    character
                        ? tr('Редагувати персонажа')
                        : tr('Новий персонаж')
                }
            />
            <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
                <Link
                    href={character ? `/characters/${character.id}` : '/me'}
                    className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Назад')}
                </Link>

                <section className="glass space-y-5 rounded-3xl p-5 sm:p-6">
                    <h1 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                        <Drama className="size-5 text-gc-lilac-300" />
                        {character
                            ? tr('Редагувати персонажа')
                            : tr('Новий персонаж')}
                    </h1>

                    <div className="flex flex-col gap-5 sm:flex-row">
                        <label className="group relative flex aspect-[4/5] w-40 shrink-0 cursor-pointer items-center justify-center self-center overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition hover:bg-white/[0.07] sm:w-44 sm:self-start">
                            {preview ? (
                                <img
                                    loading="lazy"
                                    decoding="async"
                                    src={preview}
                                    alt=""
                                    className="size-full object-cover"
                                />
                            ) : (
                                <span className="flex flex-col items-center gap-2 px-4 text-center text-xs text-white/50">
                                    <ImagePlus className="size-6" />
                                    {tr('Портрет персонажа')}
                                </span>
                            )}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    form.setData('portrait', file);
                                    setPreview(URL.createObjectURL(file));
                                }}
                            />
                        </label>

                        <div className="min-w-0 flex-1 space-y-4">
                            <Field
                                label={tr('Ім’я персонажа')}
                                error={form.errors.name}
                            >
                                <input
                                    value={form.data.name}
                                    onChange={(e) =>
                                        form.setData('name', e.target.value)
                                    }
                                    maxLength={60}
                                    required
                                    placeholder={tr('Наприклад, Тарас Коваль')}
                                    className={fieldClass}
                                />
                            </Field>
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
                                <Field
                                    label={tr('Вік')}
                                    error={form.errors.age}
                                >
                                    <input
                                        value={form.data.age}
                                        onChange={(e) =>
                                            form.setData(
                                                'age',
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                            )
                                        }
                                        inputMode="numeric"
                                        maxLength={3}
                                        className={fieldClass}
                                    />
                                </Field>
                                <Field
                                    label={tr('Заняття')}
                                    error={form.errors.occupation}
                                >
                                    <input
                                        value={form.data.occupation}
                                        onChange={(e) =>
                                            form.setData(
                                                'occupation',
                                                e.target.value,
                                            )
                                        }
                                        maxLength={60}
                                        placeholder={tr(
                                            'Механік, адвокат, байкер…',
                                        )}
                                        className={fieldClass}
                                    />
                                </Field>
                            </div>
                            <Field
                                label={tr('Сервер')}
                                error={form.errors.server}
                            >
                                <select
                                    value={form.data.server}
                                    onChange={(e) => {
                                        form.setData((data) => ({
                                            ...data,
                                            server: e.target.value,
                                            family_id: '',
                                        }));
                                    }}
                                    className={cn(selectClass, 'h-11 w-full')}
                                >
                                    {servers.map((option) => (
                                        <option
                                            key={option.slug}
                                            value={option.slug}
                                        >
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label={tr('Сім’я')}
                                error={form.errors.family_id}
                                hint={
                                    serverFamilies.length === 0
                                        ? tr('Ви не в сім’ї на цьому сервері.')
                                        : undefined
                                }
                            >
                                <select
                                    value={form.data.family_id}
                                    disabled={serverFamilies.length === 0}
                                    onChange={(e) =>
                                        form.setData(
                                            'family_id',
                                            e.target.value,
                                        )
                                    }
                                    className={cn(
                                        selectClass,
                                        'h-11 w-full disabled:opacity-50',
                                    )}
                                >
                                    <option value="">{tr('Без сім’ї')}</option>
                                    {serverFamilies.map((family) => (
                                        <option
                                            key={family.id}
                                            value={family.id}
                                        >
                                            [{family.tag}] {family.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={tr('Статус')}>
                            <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
                                {STATUS_OPTIONS().map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={
                                            form.data.status === option.value
                                        }
                                        onClick={() =>
                                            form.setData('status', option.value)
                                        }
                                        className={cn(
                                            'h-9 min-w-0 flex-1 truncate rounded-lg px-2 text-sm font-medium transition',
                                            form.data.status === option.value
                                                ? 'bg-white/10 text-white'
                                                : 'text-white/55 hover:text-white',
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <div className="flex items-end">
                            <button
                                type="button"
                                aria-pressed={form.data.is_main}
                                onClick={() =>
                                    form.setData('is_main', !form.data.is_main)
                                }
                                className={cn(
                                    'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition',
                                    form.data.is_main
                                        ? 'bg-amber-300/15 text-amber-100'
                                        : 'bg-white/[0.05] text-white/70 hover:text-white',
                                )}
                            >
                                <Star
                                    className={cn(
                                        'size-4',
                                        form.data.is_main &&
                                            'fill-amber-300 text-amber-300',
                                    )}
                                />
                                {tr('Головний персонаж на сервері')}
                            </button>
                        </div>
                    </div>

                    <Field
                        label={tr('Коротко про персонажа')}
                        error={form.errors.bio}
                        hint={tr(
                            'Видно в списках і на картці, до 600 символів.',
                        )}
                    >
                        <textarea
                            value={form.data.bio}
                            onChange={(e) =>
                                form.setData('bio', e.target.value)
                            }
                            rows={3}
                            maxLength={600}
                            className={fieldClass}
                        />
                    </Field>
                    <Field
                        label={tr('Історія')}
                        error={form.errors.story}
                        hint={tr(
                            'Минуле, характер, звідки прийшов у місто — до 5000 символів.',
                        )}
                    >
                        <textarea
                            value={form.data.story}
                            onChange={(e) =>
                                form.setData('story', e.target.value)
                            }
                            rows={8}
                            maxLength={5000}
                            className={fieldClass}
                        />
                    </Field>
                    {form.errors.portrait && (
                        <p className="text-xs text-rose-300">
                            {form.errors.portrait}
                        </p>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={
                                form.processing || form.data.name.trim() === ''
                            }
                            className="btn-glow h-11 w-full rounded-xl px-6 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                        >
                            {character
                                ? tr('Зберегти')
                                : tr('Створити персонажа')}
                        </button>
                    </div>
                </section>
            </form>
        </>
    );
}

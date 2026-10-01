import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Crown, ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { FamilyLogo } from '@/components/families/family-logo';
import { btnPrimary, textareaClass } from '@/components/families/ui';
import { ServerIcon } from '@/components/servers/server-icon';
import { Field, inputClass } from '@/components/servers/server-form';
import { cn } from '@/lib/utils';
import type { ServerOption } from '@/types';

type Props = { servers: ServerOption[]; server: string | null };

export default function CreateFamily({ servers, server }: Props) {
    const preset = servers.find((s) => s.slug === server);
    const form = useForm({
        server_id: preset?.id ?? servers[0]?.id ?? 0,
        name: '',
        tag: '',
        description: '',
        rp_nickname: '',
        static_id: '',
        logo: null as File | null,
    });
    const { data, setData, errors } = form;
    const fileRef = useRef<HTMLInputElement>(null);
    const [logo, setLogo] = useState<string | null>(null);

    const submit = () => form.post('/families', { forceFormData: true });

    return (
        <>
            <Head title="Нова сім’я" />
            <div className="mx-auto max-w-3xl space-y-4">
                <Link
                    href="/families"
                    className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> До сімей
                </Link>
                <section className="glass rounded-3xl p-5 sm:p-7">
                    <div className="flex items-center gap-3">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-rose-500">
                            <Crown className="size-6 text-white" />
                        </span>
                        <div>
                            <h1 className="font-display text-2xl font-bold text-white">
                                Створення сім’ї
                            </h1>
                            <p className="text-sm text-white/50">
                                Ви станете лідером (ранг 10). Після верифікації
                                адміністрацією відкриються набір і чат.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="mb-1.5 text-xs font-medium text-white/60">
                            Сервер
                        </div>
                        <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                            {servers.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setData('server_id', s.id)}
                                    className={cn(
                                        'flex items-center gap-3 rounded-2xl border p-2.5 text-left transition',
                                        data.server_id === s.id
                                            ? 'border-amber-300/50 bg-amber-300/10'
                                            : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]',
                                    )}
                                >
                                    <ServerIcon
                                        name={s.name}
                                        icon={s.icon}
                                        className="size-9 rounded-xl text-[10px]"
                                    />
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-white">
                                            {s.name}
                                        </div>
                                        <div className="text-[11px] text-white/40">
                                            {s.platform === 'mobile'
                                                ? 'Мобільний'
                                                : 'ПК'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {errors.server_id && (
                            <p className="mt-1 text-xs text-rose-300">
                                {errors.server_id}
                            </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-white/35">
                            Немає вашого сервера?{' '}
                            <Link
                                href="/servers"
                                className="text-[#a5b4fc] hover:underline"
                            >
                                Запропонуйте його в каталозі
                            </Link>
                            .
                        </p>
                    </div>

                    <div className="mt-5 flex flex-wrap items-start gap-5">
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="group relative"
                        >
                            <FamilyLogo
                                family={{
                                    tag: data.tag || 'TAG',
                                    logo_url: logo,
                                }}
                                size="xl"
                            />
                            <span className="absolute inset-0 flex items-center justify-center rounded-[26px] bg-black/50 opacity-0 transition group-hover:opacity-100">
                                <ImagePlus className="size-6 text-white" />
                            </span>
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                setData('logo', file);
                                setLogo(
                                    file ? URL.createObjectURL(file) : null,
                                );
                            }}
                        />
                        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-[1fr_140px]">
                            <Field label="Назва сім’ї" error={errors.name}>
                                <input
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    placeholder="Scaletta Family"
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Тег" error={errors.tag}>
                                <input
                                    value={data.tag}
                                    onChange={(e) =>
                                        setData(
                                            'tag',
                                            e.target.value.toUpperCase(),
                                        )
                                    }
                                    maxLength={8}
                                    placeholder="SCL"
                                    className={cn(
                                        inputClass,
                                        'font-mono font-bold tracking-widest',
                                    )}
                                />
                            </Field>
                            <Field
                                label="Опис"
                                error={errors.description}
                                className="sm:col-span-2"
                            >
                                <textarea
                                    value={data.description}
                                    onChange={(e) =>
                                        setData('description', e.target.value)
                                    }
                                    rows={3}
                                    placeholder="Хто ви, чим займаєтесь, кого шукаєте"
                                    className={textareaClass}
                                />
                            </Field>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                        <div className="mb-3 text-sm font-semibold text-white">
                            Ваш персонаж
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                            <Field
                                label="RP-нікнейм"
                                hint="Ім’я_Прізвище латиницею"
                                error={errors.rp_nickname}
                            >
                                <input
                                    value={data.rp_nickname}
                                    onChange={(e) =>
                                        setData('rp_nickname', e.target.value)
                                    }
                                    placeholder="Marco_Scaletta"
                                    className={cn(inputClass, 'font-mono')}
                                />
                            </Field>
                            <Field label="Static ID" error={errors.static_id}>
                                <input
                                    value={data.static_id}
                                    onChange={(e) =>
                                        setData(
                                            'static_id',
                                            e.target.value.replace(/\D/g, ''),
                                        )
                                    }
                                    inputMode="numeric"
                                    placeholder="12345"
                                    className={cn(inputClass, 'font-mono')}
                                />
                            </Field>
                        </div>
                        {data.rp_nickname && data.static_id && (
                            <div className="mt-3 text-xs text-white/45">
                                У чаті й звітах:{' '}
                                <span className="font-mono text-white">
                                    {data.rp_nickname} [{data.static_id}]
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={form.processing || servers.length === 0}
                            className={cn(btnPrimary, 'h-12 px-7')}
                        >
                            {form.processing ? 'Створюємо…' : 'Створити сім’ю'}
                        </button>
                    </div>
                </section>
            </div>
        </>
    );
}

import { router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Clapperboard,
    Database,
    ExternalLink,
    Eye,
    EyeOff,
    KeyRound,
    PlugZap,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Pill, Toggle, selectClass } from '@/components/gc/admin';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type IntegrationField = {
    name: string;
    label: string;
    type: 'secret' | 'url' | 'text' | 'select' | 'bool';
    placeholder: string | null;
    help: string | null;
    options: { value: string; label: string }[] | null;
    value: string | boolean | null;
    hint: string | null;
    from_env: boolean;
};

export type CinemaIntegration = {
    key: string;
    label: string;
    group: 'auth' | 'push' | 'voice' | 'players' | 'metadata';
    description: string;
    docs: string;
    steps: string[];
    configured: boolean;
    stat: string | null;
    fields: IntegrationField[];
};

const tones: Record<string, string> = {
    kodik: 'from-[#4f8bff] to-[#6d5dfc]',
    flixcdn: 'from-[#a855f7] to-[#f04fd8]',
    tmdb: 'from-[#01b4e4] to-[#22d3a6]',
    shikimori: 'from-[#5b7cfa] to-[#38e1ff]',
    omdb: 'from-[#f5c518] to-[#f5b342]',
};

function initialValues(fields: IntegrationField[]) {
    return Object.fromEntries(
        fields.map((f) => [
            f.name,
            f.type === 'secret'
                ? ''
                : f.type === 'bool'
                  ? Boolean(f.value ?? true)
                  : String(f.value ?? f.options?.[0]?.value ?? ''),
        ]),
    ) as Record<string, string | boolean>;
}

export function IntegrationCard({
    integration,
}: {
    integration: CinemaIntegration;
}) {
    const form = useForm(initialValues(integration.fields));
    const [reveal, setReveal] = useState<Record<string, boolean>>({});
    const Icon = integration.group === 'players' ? Clapperboard : Database;
    const fromEnv = integration.fields.some((f) => f.from_env);

    const save = () =>
        form.put(`/admin/integrations/cinema/${integration.key}`, {
            preserveScroll: true,
            onSuccess: () =>
                integration.fields
                    .filter((f) => f.type === 'secret')
                    .forEach((f) => form.setData(f.name, '')),
        });

    return (
        <section className="glass relative flex flex-col overflow-hidden rounded-3xl p-5">
            <div
                className={cn(
                    'pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-gradient-to-br opacity-15 blur-3xl',
                    tones[integration.key],
                )}
            />
            <header className="relative mb-4 flex items-start gap-3">
                <span
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br',
                        tones[integration.key],
                    )}
                >
                    <Icon className="size-5 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-semibold text-white">
                        {integration.label}
                        {integration.configured ? (
                            <Pill tone="green">
                                <CheckCircle2 className="size-3" /> Підключено
                            </Pill>
                        ) : (
                            <Pill tone="gold">Не налаштовано</Pill>
                        )}
                        {fromEnv && <Pill tone="blue">з .env</Pill>}
                    </h3>
                    <p className="mt-0.5 text-[13px] leading-snug text-white/50">
                        {integration.description}
                    </p>
                </div>
                <a
                    href={integration.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                    title="Відкрити сайт сервісу"
                >
                    <ExternalLink className="size-4" />
                </a>
            </header>

            <div className="relative grid flex-1 content-start gap-3">
                {integration.fields.map((f) => {
                    const id = `${integration.key}-${f.name}`;
                    const error = form.errors[f.name];

                    if (f.type === 'bool') {
                        return (
                            <label
                                key={f.name}
                                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/75"
                            >
                                {f.label}
                                <Toggle
                                    checked={Boolean(form.data[f.name])}
                                    onChange={(v) => form.setData(f.name, v)}
                                    label={f.label}
                                />
                            </label>
                        );
                    }

                    return (
                        <div key={f.name} className="grid gap-1.5">
                            <Label htmlFor={id} className="text-xs">
                                {f.label}
                            </Label>
                            {f.type === 'select' ? (
                                <select
                                    id={id}
                                    value={String(form.data[f.name])}
                                    onChange={(e) =>
                                        form.setData(f.name, e.target.value)
                                    }
                                    className={selectClass}
                                >
                                    {f.options?.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            ) : f.type === 'url' ? (
                                <textarea
                                    id={id}
                                    value={String(form.data[f.name])}
                                    onChange={(e) =>
                                        form.setData(
                                            f.name,
                                            e.target.value.replace(/\s+/g, ''),
                                        )
                                    }
                                    placeholder={f.placeholder ?? ''}
                                    rows={2}
                                    inputMode="url"
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    className="input-glass [field-sizing:content] min-h-[4.25rem] w-full resize-y rounded-xl px-3.5 py-2.5 font-mono text-[13px] leading-relaxed break-all text-white outline-none placeholder:text-white/35"
                                />
                            ) : (
                                <div className="relative">
                                    <Input
                                        id={id}
                                        type={
                                            f.type === 'secret' &&
                                            !reveal[f.name]
                                                ? 'password'
                                                : 'text'
                                        }
                                        value={String(form.data[f.name])}
                                        onChange={(e) =>
                                            form.setData(
                                                f.name,
                                                e.target.value.trim(),
                                            )
                                        }
                                        placeholder={
                                            f.type === 'secret'
                                                ? f.hint
                                                    ? `Збережено ${f.hint}`
                                                    : 'Вставте ключ'
                                                : (f.placeholder ?? '')
                                        }
                                        autoComplete={
                                            f.type === 'secret'
                                                ? 'new-password'
                                                : 'off'
                                        }
                                        spellCheck={false}
                                        className={cn(
                                            'font-mono text-[13px]',
                                            f.type === 'secret' && 'pr-11',
                                        )}
                                    />
                                    {f.type === 'secret' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setReveal((r) => ({
                                                    ...r,
                                                    [f.name]: !r[f.name],
                                                }))
                                            }
                                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 hover:text-white"
                                            aria-label="Показати"
                                        >
                                            {reveal[f.name] ? (
                                                <EyeOff className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                            {error ? (
                                <p className="text-xs text-rose-300">{error}</p>
                            ) : (
                                (f.help || (f.type === 'secret' && f.hint)) && (
                                    <p className="text-xs text-white/40">
                                        {f.help ??
                                            'Залиште порожнім, щоб не змінювати.'}
                                    </p>
                                )
                            )}
                        </div>
                    );
                })}

                <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-white/45">
                    {integration.steps.map((step) => (
                        <li key={step}>{step}</li>
                    ))}
                </ol>
            </div>

            <footer className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                <button
                    type="button"
                    onClick={save}
                    disabled={form.processing}
                    className="btn-glow inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                    <KeyRound className="size-4" /> Зберегти
                </button>
                <button
                    type="button"
                    onClick={() =>
                        router.post(
                            `/admin/integrations/cinema/${integration.key}/test`,
                            {},
                            { preserveScroll: true },
                        )
                    }
                    disabled={!integration.configured}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                >
                    <PlugZap className="size-4" /> Перевірити
                </button>
                {integration.configured && !fromEnv && (
                    <button
                        type="button"
                        onClick={() =>
                            window.confirm(
                                `Видалити налаштування ${integration.label}?`,
                            ) &&
                            router.put(
                                `/admin/integrations/cinema/${integration.key}`,
                                { clear: true },
                                { preserveScroll: true },
                            )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                        <Trash2 className="size-4" />
                    </button>
                )}
                {integration.stat && (
                    <span className="ml-auto text-xs text-white/40">
                        {integration.stat}
                    </span>
                )}
            </footer>
        </section>
    );
}

import { Head, router } from '@inertiajs/react';
import { Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Pill, Toggle } from '@/components/gc/admin';
import { PendingBar } from '@/components/settings/pending-bar';
import { tr } from '@/lib/i18n';
import { FEATURE_LABELS, MODE_ICONS } from '@/lib/modes';
import type { NetworkMode } from '@/lib/modes';
import { cn } from '@/lib/utils';

type Config = { default: string; modes: NetworkMode[] };
type ModuleItem = {
    key: string;
    name: string;
    core: boolean;
    enabled: boolean;
};
type PluginItem = {
    key: string;
    group: string;
    name: string;
    description: string;
    enabled: boolean;
};

/**
 * Адмінка → Режими соцмережі: які режими є, що в кожному видно «до дрібниць» (розділи,
 * можливості, окремі функції-плагіни), який режим типовий для новачків. Зміни — через панель
 * «N змін · Скасувати · Зберегти», як у налаштуваннях.
 */
export default function AdminModes({
    config,
    modules,
    plugins,
    features,
    icons,
}: {
    config: Config;
    modules: ModuleItem[];
    plugins: PluginItem[];
    features: string[];
    icons: string[];
}) {
    const [saved, setSaved] = useState<Config>(config);
    const [data, setData] = useState<Config>(config);
    const [selected, setSelected] = useState(config.modes[0]?.id ?? '');
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const mode =
        data.modes.find((item) => item.id === selected) ?? data.modes[0];
    const changes = JSON.stringify(data) === JSON.stringify(saved) ? 0 : 1;
    const featureLabels = FEATURE_LABELS();
    const groups = [...new Set(plugins.map((item) => item.group))];

    const patch = (change: Partial<NetworkMode>) =>
        setData((current) => ({
            ...current,
            modes: current.modes.map((item) =>
                item.id === mode.id ? { ...item, ...change } : item,
            ),
        }));
    const toggleIn = (list: string[], key: string, on: boolean) =>
        on ? [...new Set([...list, key])] : list.filter((item) => item !== key);

    const addMode = () => {
        let n = data.modes.length + 1;
        while (data.modes.some((item) => item.id === `mode-${n}`)) n++;
        const fresh: NetworkMode = {
            id: `mode-${n}`,
            name: tr('Новий режим'),
            description: '',
            icon: 'layers',
            enabled: true,
            builtin: false,
            modules: modules.map((item) => item.key),
            plugins_off: [],
            features: Object.fromEntries(features.map((key) => [key, true])),
        };
        setData((current) => ({
            ...current,
            modes: [...current.modes, fresh],
        }));
        setSelected(fresh.id);
    };

    const removeMode = () => {
        const rest = data.modes.filter((item) => item.id !== mode.id);
        setData((current) => ({
            default:
                current.default === mode.id
                    ? (rest[0]?.id ?? '')
                    : current.default,
            modes: rest,
        }));
        setSelected(rest[0]?.id ?? '');
    };

    const save = () => {
        setProcessing(true);
        router.put('/admin/modes', data, {
            preserveScroll: true,
            onSuccess: () => {
                setSaved(data);
                setErrors({});
            },
            onError: (bag) => setErrors(bag),
            onFinish: () => setProcessing(false),
        });
    };

    const reset = () => {
        if (
            !window.confirm(
                tr('Повернути типові режими? Свої режими буде видалено.'),
            )
        )
            return;
        router.post(
            '/admin/modes/reset',
            {},
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    const fresh = (page.props as unknown as { config: Config })
                        .config;
                    setSaved(fresh);
                    setData(fresh);
                    setSelected(fresh.modes[0]?.id ?? '');
                },
            },
        );
    };

    return (
        <>
            <Head title={tr('Режими — Адмін-панель')} />
            <PageHeader
                title={tr('Режими соцмережі')}
                description={tr(
                    'Режим ховає зайве в меню й інтерфейсі людини. Вимкнене для всього сайту лишається вимкненим у будь-якому режимі.',
                )}
                actions={
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={reset}
                            className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-white/80 hover:text-white"
                        >
                            <RotateCcw className="size-4" /> {tr('Типові')}
                        </button>
                        <button
                            type="button"
                            onClick={addMode}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="size-4" /> {tr('Новий режим')}
                        </button>
                    </div>
                }
            />

            {(errors.modes || errors.default) && (
                <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    {errors.modes ?? errors.default}
                </p>
            )}

            <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                {/* Перелік режимів */}
                <div className="space-y-2">
                    {data.modes.map((item) => {
                        const Icon = MODE_ICONS[item.icon] ?? MODE_ICONS.layers;
                        const active = item.id === mode?.id;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSelected(item.id)}
                                className={cn(
                                    'glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
                                    active
                                        ? 'ring-2 ring-primary'
                                        : 'hover:border-white/25',
                                    !item.enabled && 'opacity-55',
                                )}
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/25 ring-1 ring-white/10">
                                    <Icon className="size-5 text-white/85" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                                        <span className="truncate">
                                            {item.name}
                                        </span>
                                        {data.default === item.id && (
                                            <Star className="size-3.5 shrink-0 fill-current text-gold" />
                                        )}
                                    </span>
                                    <span className="block text-xs text-white/45">
                                        {item.enabled
                                            ? tr('Увімкнено')
                                            : tr('Вимкнено')}{' '}
                                        · {item.modules.length}/{modules.length}{' '}
                                        {tr('розділів')}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Редактор вибраного режиму */}
                {mode && (
                    <div className="glass space-y-6 rounded-2xl p-5 sm:p-6">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="text-sm text-white/70">
                                {tr('Назва')}
                                <input
                                    value={mode.name}
                                    maxLength={40}
                                    onChange={(e) =>
                                        patch({ name: e.target.value })
                                    }
                                    className="input-glass mt-1.5 h-11 w-full rounded-xl px-3.5 text-sm text-white focus:outline-none"
                                />
                            </label>
                            <div className="flex flex-wrap items-end gap-3">
                                <Toggle
                                    checked={mode.enabled}
                                    onChange={(value) =>
                                        patch({ enabled: value })
                                    }
                                    label={tr('Доступний людям')}
                                />
                                <button
                                    type="button"
                                    disabled={
                                        data.default === mode.id ||
                                        !mode.enabled
                                    }
                                    onClick={() =>
                                        setData((current) => ({
                                            ...current,
                                            default: mode.id,
                                        }))
                                    }
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-black/25 px-3 text-xs font-medium text-white/80 ring-1 ring-white/10 disabled:opacity-50"
                                >
                                    <Star className="size-3.5" />
                                    {data.default === mode.id
                                        ? tr('Типовий для новачків')
                                        : tr('Зробити типовим')}
                                </button>
                            </div>
                            <label className="text-sm text-white/70 sm:col-span-2">
                                {tr('Опис (бачать люди під час вибору)')}
                                <textarea
                                    value={mode.description}
                                    maxLength={200}
                                    rows={2}
                                    onChange={(e) =>
                                        patch({ description: e.target.value })
                                    }
                                    className="input-glass mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                                />
                            </label>
                            <div className="sm:col-span-2">
                                <p className="text-sm text-white/70">
                                    {tr('Значок')}
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {icons.map((key) => {
                                        const Icon =
                                            MODE_ICONS[key] ??
                                            MODE_ICONS.layers;

                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                aria-label={key}
                                                aria-pressed={mode.icon === key}
                                                onClick={() =>
                                                    patch({ icon: key })
                                                }
                                                className={cn(
                                                    'flex size-10 items-center justify-center rounded-xl ring-1 transition-colors',
                                                    mode.icon === key
                                                        ? 'bg-primary text-primary-foreground ring-primary'
                                                        : 'bg-black/25 text-white/70 ring-white/10 hover:text-white',
                                                )}
                                            >
                                                <Icon className="size-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <section>
                            <h3 className="text-sm font-semibold text-white">
                                {tr('Розділи')}
                            </h3>
                            <p className="mt-0.5 text-xs text-white/45">
                                {tr(
                                    'Що з’являється в меню. Розділи ядра є завжди.',
                                )}
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {modules.map((item) => (
                                    <label
                                        key={item.key}
                                        className="flex min-h-11 items-center gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm text-white ring-1 ring-white/[0.05]"
                                    >
                                        <input
                                            type="checkbox"
                                            className="gc-switch"
                                            checked={
                                                item.core ||
                                                mode.modules.includes(item.key)
                                            }
                                            disabled={item.core}
                                            onChange={(e) =>
                                                patch({
                                                    modules: toggleIn(
                                                        mode.modules,
                                                        item.key,
                                                        e.target.checked,
                                                    ),
                                                })
                                            }
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">
                                                {item.name}
                                            </span>
                                            {(item.core || !item.enabled) && (
                                                <span className="block text-[11px] text-white/40">
                                                    {item.core
                                                        ? tr('ядро — завжди')
                                                        : tr(
                                                              'вимкнено на сайті',
                                                          )}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h3 className="text-sm font-semibold text-white">
                                {tr('Можливості')}
                            </h3>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {features.map((key) => (
                                    <label
                                        key={key}
                                        className="flex min-h-11 items-center gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm text-white ring-1 ring-white/[0.05]"
                                    >
                                        <input
                                            type="checkbox"
                                            className="gc-switch"
                                            checked={
                                                mode.features[key] !== false
                                            }
                                            onChange={(e) =>
                                                patch({
                                                    features: {
                                                        ...mode.features,
                                                        [key]: e.target.checked,
                                                    },
                                                })
                                            }
                                        />
                                        {featureLabels[key] ?? key}
                                    </label>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h3 className="text-sm font-semibold text-white">
                                {tr('Функції')}
                            </h3>
                            <p className="mt-0.5 text-xs text-white/45">
                                {tr(
                                    'Дрібні можливості всередині розділів. Вимкнене тут сховано лише в цьому режимі.',
                                )}
                            </p>
                            <div className="mt-3 space-y-2">
                                {groups.map((group) => {
                                    const items = plugins.filter(
                                        (item) => item.group === group,
                                    );
                                    const off = items.filter((item) =>
                                        mode.plugins_off.includes(item.key),
                                    ).length;

                                    return (
                                        <details
                                            key={group}
                                            className="group rounded-2xl bg-black/20 ring-1 ring-white/[0.05]"
                                        >
                                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-white">
                                                <span className="flex-1">
                                                    {group}
                                                </span>
                                                {off > 0 && (
                                                    <Pill tone="gold">
                                                        {tr('сховано')}: {off}
                                                    </Pill>
                                                )}
                                                <span className="text-white/40 transition group-open:rotate-90">
                                                    ›
                                                </span>
                                            </summary>
                                            <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                                                {items.map((item) => (
                                                    <label
                                                        key={item.key}
                                                        title={item.description}
                                                        className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-white/85"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="gc-switch"
                                                            checked={
                                                                !mode.plugins_off.includes(
                                                                    item.key,
                                                                )
                                                            }
                                                            onChange={(e) =>
                                                                patch({
                                                                    plugins_off:
                                                                        toggleIn(
                                                                            mode.plugins_off,
                                                                            item.key,
                                                                            !e
                                                                                .target
                                                                                .checked,
                                                                        ),
                                                                })
                                                            }
                                                        />
                                                        <span className="min-w-0 flex-1 truncate">
                                                            {item.name}
                                                        </span>
                                                        {!item.enabled && (
                                                            <span className="text-[11px] text-white/35">
                                                                {tr(
                                                                    'вимкнено на сайті',
                                                                )}
                                                            </span>
                                                        )}
                                                    </label>
                                                ))}
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        </section>

                        {!mode.builtin && (
                            <button
                                type="button"
                                onClick={removeMode}
                                className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-rose-300 hover:bg-rose-400/10"
                            >
                                <Trash2 className="size-4" />{' '}
                                {tr('Видалити режим')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <PendingBar
                count={changes}
                processing={processing}
                onDiscard={() => {
                    setData(saved);
                    setErrors({});
                }}
                onSave={save}
            />
        </>
    );
}

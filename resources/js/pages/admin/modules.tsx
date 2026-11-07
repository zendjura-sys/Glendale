import { Head, router } from '@inertiajs/react';
import { Lock, Sparkles, Wrench } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, Pill, Toggle } from '@/components/gc/admin';
import { ModuleIcon } from '@/components/gc/module-icon';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type ModuleItem = {
    key: string;
    name: string;
    description: string;
    icon: string;
    core: boolean;
    available: boolean;
    enabled: boolean;
};

export default function AdminModules({
    modules,
    maintenance = {},
}: {
    modules: ModuleItem[];
    maintenance?: Record<string, string>;
}) {
    const [pending, setPending] = useState<string | null>(null);

    const toggle = (module: ModuleItem, enabled: boolean) => {
        setPending(module.key);
        router.patch(
            `/admin/modules/${module.key}`,
            { enabled },
            { preserveScroll: true, onFinish: () => setPending(null) },
        );
    };

    const groups = [
        {
            title: tr('Ядро'),
            description: tr(
                'Базові розділи соціальної мережі. Завжди увімкнені.',
            ),
            items: modules.filter((m) => m.core),
        },
        {
            title: tr('Модулі'),
            description: tr('Вмикайте та вимикайте розділи без зупинки сайту.'),
            items: modules.filter((m) => !m.core && m.available),
        },
        {
            title: tr('У розробці'),
            description: tr("З'являться в наступних етапах."),
            items: modules.filter((m) => !m.core && !m.available),
        },
    ].filter((g) => g.items.length > 0);

    return (
        <>
            <Head title={tr('Модулі — Адмін-панель')} />
            <PageHeader
                title={tr('Модулі')}
                description={tr(
                    'Платформа складається з ядра та незалежних модулів. Вимкнений модуль зникає з меню, а його сторінки стають недоступними.',
                )}
            />

            <div className="space-y-8">
                {groups.map((group) => (
                    <section key={group.title}>
                        <div className="mb-3 flex items-baseline gap-3">
                            <h2 className="font-display text-sm font-semibold text-white/90">
                                {group.title}
                            </h2>
                            <span className="text-xs text-white/35">
                                {group.description}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {group.items.map((m, i) => (
                                <div
                                    key={m.key}
                                    className={cn(
                                        'gc-solid group relative animate-rise overflow-hidden rounded-2xl p-5 transition',
                                        m.enabled && 'border-gc-indigo/25',
                                        !m.available && 'opacity-65',
                                    )}
                                    style={{ animationDelay: `${i * 50}ms` }}
                                >
                                    {m.enabled && (
                                        <div className="absolute -top-12 -left-12 size-36 rounded-full bg-sky-500 opacity-20 blur-3xl" />
                                    )}
                                    <div className="relative flex items-start gap-4">
                                        <span
                                            className={cn(
                                                'flex size-12 shrink-0 items-center justify-center rounded-2xl',
                                                m.enabled
                                                    ? 'bg-sky-500'
                                                    : 'gc-solid-2',
                                            )}
                                        >
                                            <ModuleIcon
                                                name={m.icon}
                                                className={cn(
                                                    'size-[22px]',
                                                    m.enabled
                                                        ? 'text-white'
                                                        : 'text-white/45',
                                                )}
                                            />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-semibold text-white">
                                                    {m.name}
                                                </h3>
                                                {m.core && (
                                                    <Pill tone="gold">
                                                        <Lock className="size-3" />{' '}
                                                        {tr('Ядро')}
                                                    </Pill>
                                                )}
                                                {!m.available && (
                                                    <Pill tone="violet">
                                                        <Sparkles className="size-3" />{' '}
                                                        {tr('У розробці')}
                                                    </Pill>
                                                )}
                                            </div>
                                            <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                                                {m.description}
                                            </p>
                                        </div>
                                        <Toggle
                                            checked={m.enabled}
                                            disabled={
                                                m.core ||
                                                !m.available ||
                                                pending === m.key
                                            }
                                            onChange={(v) => toggle(m, v)}
                                            label={m.name}
                                        />
                                    </div>
                                    <div className="relative mt-4 flex items-center gap-2 text-xs text-white/35">
                                        <span
                                            className={cn(
                                                'size-1.5 rounded-full',
                                                m.enabled
                                                    ? 'bg-emerald-400 shadow-emerald-400'
                                                    : 'bg-white/25',
                                            )}
                                        />
                                        {m.enabled
                                            ? tr('Увімкнено')
                                            : m.available
                                              ? tr('Вимкнено')
                                              : tr('Недоступно')}
                                        <code className="gc-solid-2 ml-auto rounded px-1.5 py-0.5 text-white/30">
                                            {m.key}
                                        </code>
                                    </div>
                                    {m.enabled && (
                                        <MaintenanceRow
                                            module={m.key}
                                            message={maintenance[m.key] ?? null}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

/** Техроботи в розділі: команда заходить як завжди, решта бачить повідомлення. */
function MaintenanceRow({
    module,
    message,
}: {
    module: string;
    message: string | null;
}) {
    const [text, setText] = useState(message ?? '');
    const [editing, setEditing] = useState(false);
    const save = (on: boolean) =>
        router.put(
            `/admin/modules/${module}/maintenance`,
            { on, message: on ? text : '' },
            {
                preserveScroll: true,
                onSuccess: () => setEditing(false),
            },
        );

    if (message && !editing) {
        return (
            <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                <Wrench className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{message}</span>
                <button
                    type="button"
                    onClick={() => save(false)}
                    className="shrink-0 font-semibold text-white hover:underline"
                >
                    {tr('Завершити')}
                </button>
            </div>
        );
    }

    return editing ? (
        <div className="relative mt-3 flex gap-2">
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={tr(
                    'Розділ на технічних роботах — скоро повернемося.',
                )}
                maxLength={300}
                className="input-glass h-9 min-w-0 flex-1 rounded-lg px-2.5 text-xs text-white"
            />
            <button
                type="button"
                onClick={() => save(true)}
                className="h-9 shrink-0 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-white"
            >
                {tr('Закрити')}
            </button>
        </div>
    ) : (
        <button
            type="button"
            onClick={() => setEditing(true)}
            className="relative mt-3 inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"
        >
            <Wrench className="size-3.5" />
            {tr('Техроботи в розділі')}
        </button>
    );
}

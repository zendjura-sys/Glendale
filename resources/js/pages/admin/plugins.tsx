import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { PageHeader, Toggle } from '@/components/gc/admin';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type PluginItem = {
    key: string;
    group: string;
    name: string;
    description: string;
    enabled: boolean;
};

export default function AdminPlugins({ plugins }: { plugins: PluginItem[] }) {
    const [pending, setPending] = useState<string | null>(null);
    const groups = [...new Set(plugins.map((item) => item.group))];

    const toggle = (plugin: PluginItem, enabled: boolean) => {
        setPending(plugin.key);
        router.patch(
            `/admin/plugins/${plugin.key}`,
            { enabled },
            { preserveScroll: true, onFinish: () => setPending(null) },
        );
    };

    return (
        <>
            <Head title={tr('Плагіни — Адмін-панель')} />
            <PageHeader
                title={tr('Плагіни')}
                description={tr(
                    'Інтегровані функції всередині сайту. Вони не з’являються в меню: меню складають модулі. Вимкнений плагін ховає свою дію.',
                )}
            />

            <div className="space-y-8">
                {groups.map((group) => (
                    <section key={group}>
                        <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-white/90 uppercase">
                            {tr(group)}
                        </h2>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {plugins
                                .filter((item) => item.group === group)
                                .map((plugin) => (
                                    <div
                                        key={plugin.key}
                                        className={cn(
                                            'glass relative overflow-hidden rounded-3xl p-5',
                                            plugin.enabled && 'border-gc-indigo/25',
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-white">{tr(plugin.name)}</h3>
                                                <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                                                    {tr(plugin.description)}
                                                </p>
                                            </div>
                                            <Toggle
                                                checked={plugin.enabled}
                                                disabled={pending === plugin.key}
                                                onChange={(value) => toggle(plugin, value)}
                                                label={plugin.name}
                                            />
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs text-white/35">
                                            <span
                                                className={cn(
                                                    'size-1.5 rounded-full',
                                                    plugin.enabled ? 'bg-emerald-400' : 'bg-white/25',
                                                )}
                                            />
                                            {plugin.enabled ? tr('Увімкнено') : tr('Вимкнено')}
                                            <code className="ml-auto rounded bg-white/[0.04] px-1.5 py-0.5 text-white/30">
                                                {plugin.key}
                                            </code>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

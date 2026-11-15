import { Head, router } from '@inertiajs/react';
import { AppWindow, ChevronDown, Code2, Gamepad2, Layers } from 'lucide-react';
import { useState } from 'react';
import { Toggle } from '@/components/gc/admin';
import { OverlayCompanion } from '@/components/developers/overlay-companion';
import { SettingsCard } from '@/layouts/settings/layout';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type ConnectedApp = {
    id: number;
    name: string;
    website: string | null;
    scope_labels: string[];
    since: string | null;
    last_used_at: string | null;
    /** Оверлей GameCon SDK у цій грі (гравець вирішує завжди). */
    overlay: boolean;
    /** Що гра повідомила через SDK: «У матчі · 12:40» (живе 10 хвилин). */
    playing: { status?: string | null } | null;
};

/** Налаштування → Застосунки: кому дано доступ через «Увійти через GameCon». */
export default function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
    const [open, setOpen] = useState<number | null>(null);
    const disconnect = (app: ConnectedApp) => {
        if (
            !confirm(
                tr('Відключити «{name}»? Застосунок втратить доступ одразу.', {
                    name: app.name,
                }),
            )
        )
            return;
        router.delete(`/settings/connected-apps/${app.id}`, {
            preserveScroll: true,
        });
    };

    const overlay = (app: ConnectedApp, enabled: boolean) =>
        router.put(
            `/settings/connected-apps/${app.id}/overlay`,
            { enabled },
            { preserveScroll: true },
        );

    return (
        <>
            <Head title={tr('Підключені застосунки')} />
            <SettingsCard
                title={tr('Підключені застосунки')}
                description={tr(
                    'Сайти, боти й програми, яким ви дозволили доступ через «Увійти через GameCon».',
                )}
            >
                {apps.length === 0 ? (
                    <p className="mt-4 text-sm text-white/50">
                        {tr('Ви ще не підключали жодного застосунку.')}
                    </p>
                ) : (
                    <ul className="mt-4 grid gap-2">
                        {apps.map((app) => (
                            <li
                                key={app.id}
                                className="gc-solid-2 flex flex-wrap items-start gap-3 rounded-2xl p-3"
                            >
                                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                                    <AppWindow className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-white">
                                        {app.name}
                                    </p>
                                    <p className="text-xs text-white/50">
                                        {app.since &&
                                            tr('Підключено {time}', {
                                                time: timeAgo(app.since),
                                            })}
                                        {app.last_used_at &&
                                            ` · ${tr('останній запит {time}', { time: timeAgo(app.last_used_at) })}`}
                                    </p>
                                    <p className="mt-1 text-xs text-white/65">
                                        {app.scope_labels
                                            .map((s) => tr(s))
                                            .join(' · ')}
                                    </p>
                                </div>
                                <div
                                    data-overlay-row
                                    className="flex w-full min-w-0 flex-wrap items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 sm:order-last"
                                >
                                    <Layers className="size-4 shrink-0 text-white/50" />
                                    <span className="min-w-0 flex-1 text-sm text-white/75">
                                        {tr('Оверлей GameCon у цій грі')}
                                        <span className="block text-xs text-white/40">
                                            {tr(
                                                'Друзі, чат і голос поверх гри. Вимкнений — гра працює як раніше.',
                                            )}
                                        </span>
                                    </span>
                                    <Toggle
                                        checked={app.overlay}
                                        onChange={(v) => overlay(app, v)}
                                        label={tr('Оверлей GameCon у цій грі')}
                                    />
                                    {app.overlay && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpen(
                                                    open === app.id
                                                        ? null
                                                        : app.id,
                                                )
                                            }
                                            aria-expanded={open === app.id}
                                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-white/[0.06]"
                                        >
                                            {tr('Налаштувати')}
                                            <ChevronDown
                                                className={cn(
                                                    'size-3.5 transition',
                                                    open === app.id &&
                                                        'rotate-180',
                                                )}
                                            />
                                        </button>
                                    )}
                                    {app.overlay && open === app.id && (
                                        <div className="basis-full border-t border-white/[0.06] pt-3">
                                            <OverlayCompanion appId={app.id} />
                                        </div>
                                    )}
                                </div>
                                {app.playing?.status && (
                                    <p className="flex w-full items-center gap-2 text-xs text-emerald-300 sm:order-last">
                                        <Gamepad2 className="size-3.5" />
                                        {tr('Зараз у грі: {status}', {
                                            status: app.playing.status,
                                        })}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={() => disconnect(app)}
                                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
                                >
                                    {tr('Відключити')}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <a
                    href="/developers"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                    <Code2 className="size-4" />
                    {tr('Створити свій застосунок — для розробників')}
                </a>
            </SettingsCard>
        </>
    );
}

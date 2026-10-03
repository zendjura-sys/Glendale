import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    CircleMinus,
    LayoutGrid,
    Plus,
    RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { update as updateNavigation } from '@/routes/navigation';
import { ModuleIcon } from '@/components/gc/module-icon';
import { SettingsCard } from '@/layouts/settings/layout';
import { MOBILE_LABEL } from '@/lib/nav';
import { cn } from '@/lib/utils';

type Props = {
    defaults: string[];
    max: number;
};

export default function Navigation({ defaults, max }: Props) {
    const { nav, auth } = usePage().props;
    const [tabs, setTabs] = useState<string[]>(auth.user.nav_tabs);

    useEffect(() => setTabs(auth.user.nav_tabs), [auth.user.nav_tabs]);

    const byKey = new Map(nav.map((item) => [item.key, item]));
    const pinned = tabs
        .map((key) => byKey.get(key))
        .filter((item) => item !== undefined);
    const rest = nav.filter((item) => !tabs.includes(item.key));
    const full = tabs.length >= max;
    const isDefault =
        tabs.join() === defaults.filter((key) => byKey.has(key)).join();

    const save = (next: string[]) => {
        const previous = tabs;
        setTabs(next);
        router.put(
            updateNavigation.url(),
            { tabs: next },
            { preserveScroll: true, onError: () => setTabs(previous) },
        );
    };

    const move = (index: number, by: number) => {
        const next = [...tabs];
        const [item] = next.splice(index, 1);
        next.splice(index + by, 0, item);
        save(next);
    };

    return (
        <>
            <Head title="Нижня панель" />

            <SettingsCard
                title="Нижня панель"
                description={`До ${max} розділів поруч із «Меню» на телефоні — і на сайті, і в застосунку. Те, що приберете з панелі, буде в меню.`}
            >
                <div
                    className="mb-6 flex items-stretch rounded-2xl border border-white/[0.08] bg-[#0f0a1e]/60"
                    aria-label="Попередній перегляд"
                >
                    {[...pinned, null].map((item) => (
                        <div
                            key={item?.key ?? 'menu'}
                            className="flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-white/55"
                        >
                            {item ? (
                                <ModuleIcon
                                    name={item.icon}
                                    className="size-5"
                                />
                            ) : (
                                <LayoutGrid className="size-5" />
                            )}
                            <span className="max-w-full truncate px-0.5">
                                {item
                                    ? (MOBILE_LABEL[item.key] ?? item.label)
                                    : 'Меню'}
                            </span>
                        </div>
                    ))}
                </div>

                <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/45 uppercase">
                    У панелі
                </h3>
                <ul className="grid gap-1.5" data-test="nav-pinned">
                    {pinned.map((item, index) => (
                        <li
                            key={item.key}
                            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] py-1.5 pr-1.5 pl-3"
                        >
                            <ModuleIcon
                                name={item.icon}
                                className="size-5 shrink-0 text-[#9aa6ff]"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                {item.label}
                            </span>
                            <IconButton
                                label="Вище"
                                disabled={index === 0}
                                onClick={() => move(index, -1)}
                            >
                                <ArrowUp className="size-4" />
                            </IconButton>
                            <IconButton
                                label="Нижче"
                                disabled={index === pinned.length - 1}
                                onClick={() => move(index, 1)}
                            >
                                <ArrowDown className="size-4" />
                            </IconButton>
                            <IconButton
                                label="Прибрати в меню"
                                disabled={pinned.length <= 1}
                                onClick={() =>
                                    save(tabs.filter((key) => key !== item.key))
                                }
                                className="text-rose-300"
                            >
                                <CircleMinus className="size-4" />
                            </IconButton>
                        </li>
                    ))}
                </ul>

                <div className="mt-6 mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold tracking-wide text-white/45 uppercase">
                        У меню
                    </h3>
                    {full && (
                        <span className="text-xs text-white/35">
                            Панель заповнена
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2" data-test="nav-rest">
                    {rest.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            disabled={full}
                            onClick={() => save([...tabs, item.key])}
                            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[13px] font-medium text-white/75 transition hover:bg-white/[0.07] disabled:opacity-40"
                        >
                            <Plus className="size-3.5 text-white/45" />
                            <ModuleIcon
                                name={item.icon}
                                className="size-4 text-[#9aa6ff]"
                            />
                            {item.label}
                        </button>
                    ))}
                </div>

                {!isDefault && (
                    <button
                        type="button"
                        onClick={() =>
                            save(defaults.filter((key) => byKey.has(key)))
                        }
                        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06]"
                    >
                        <RotateCcw className="size-4" />
                        Повернути як було
                    </button>
                )}
            </SettingsCard>
        </>
    );
}

function IconButton({
    label,
    className,
    ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/[0.06] disabled:opacity-25',
                className,
            )}
            {...props}
        />
    );
}

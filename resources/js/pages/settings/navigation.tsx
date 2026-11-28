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
import {
    header as updateHeader,
    update as updateNavigation,
} from '@/routes/navigation';
import { ModuleIcon } from '@/components/gc/module-icon';
import { SettingsCard } from '@/layouts/settings/layout';
import { MOBILE_LABEL } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

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
            <Head title={tr('Навігація')} />

            <SettingsCard
                title={tr('Нижня панель (навбар)')}
                description={tr(
                    'До {max} розділів у плаваючій капсулі знизу — на телефоні (поруч із «Меню»), на ПК і планшеті, і в застосунку. Те, що приберете з панелі, буде в меню.',
                    { max },
                )}
            >
                <div
                    className="mb-6 flex items-stretch rounded-xl border-[var(--gc-hairline)] bg-black/20"
                    aria-label={tr('Попередній перегляд')}
                >
                    {[...pinned, null].map((item) => (
                        <div
                            key={item?.key ?? 'menu'}
                            className="flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-white/55"
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
                                    : tr('Меню')}
                            </span>
                        </div>
                    ))}
                </div>

                <h3 className="mb-1 text-[13px] font-semibold text-white/50">
                    {tr('У панелі')}
                </h3>
                <ul
                    className="-mx-4 border-[var(--gc-hairline)] px-4 sm:-mx-5 sm:px-5"
                    data-test="nav-pinned"
                >
                    {pinned.map((item, index) => (
                        <li
                            key={item.key}
                            className="gc-row flex min-h-12 items-center gap-3 py-1.5"
                        >
                            <ModuleIcon
                                name={item.icon}
                                className="size-5 shrink-0 text-primary"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                {item.label}
                            </span>
                            <IconButton
                                label={tr('Вище')}
                                disabled={index === 0}
                                onClick={() => move(index, -1)}
                            >
                                <ArrowUp className="size-4" />
                            </IconButton>
                            <IconButton
                                label={tr('Нижче')}
                                disabled={index === pinned.length - 1}
                                onClick={() => move(index, 1)}
                            >
                                <ArrowDown className="size-4" />
                            </IconButton>
                            <IconButton
                                label={tr('Прибрати в меню')}
                                disabled={pinned.length <= 1}
                                onClick={() =>
                                    save(tabs.filter((key) => key !== item.key))
                                }
                                className="text-red-400"
                            >
                                <CircleMinus className="size-4" />
                            </IconButton>
                        </li>
                    ))}
                </ul>

                <div className="mt-6 mb-2 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-white/50">
                        {tr('У меню')}
                    </h3>
                    {full && (
                        <span className="text-xs text-white/35">
                            {tr('Панель заповнена')}
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
                            className="gc-solid-2 flex items-center gap-2 rounded-control px-3.5 py-2 text-[13px] font-medium text-white/75 transition hover:bg-[var(--gc-l3)] disabled:opacity-40"
                        >
                            <Plus className="size-3.5 text-white/45" />
                            <ModuleIcon
                                name={item.icon}
                                className="size-4 text-primary"
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
                        className="mt-6 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white/75 transition hover:bg-[var(--gc-l3)]"
                    >
                        <RotateCcw className="size-4" />
                        {tr('Повернути як було')}
                    </button>
                )}
            </SettingsCard>

            <HeaderSettings />
        </>
    );
}

/**
 * Шапка на ПК і планшеті: які розділи значками. Розділи нижньої капсули тут не повторюються;
 * порожній список — автоматично (усе, чого немає в капсулі, скільки вміститься).
 */
function HeaderSettings() {
    const { nav, auth } = usePage().props;
    const capsule = auth.user.nav_tabs;
    const [header, setHeader] = useState<string[]>(auth.user.header_tabs ?? []);
    useEffect(
        () => setHeader(auth.user.header_tabs ?? []),
        [auth.user.header_tabs],
    );

    const byKey = new Map(nav.map((item) => [item.key, item]));
    const chosen = header
        .filter((key) => !capsule.includes(key))
        .map((key) => byKey.get(key))
        .filter((item) => item !== undefined);
    const free = nav.filter(
        (item) => !capsule.includes(item.key) && !header.includes(item.key),
    );

    const save = (next: string[]) => {
        const previous = header;
        setHeader(next);
        router.put(
            updateHeader.url(),
            { header: next },
            { preserveScroll: true, onError: () => setHeader(previous) },
        );
    };
    const move = (index: number, by: number) => {
        const next = chosen.map((item) => item.key);
        const [item] = next.splice(index, 1);
        next.splice(index + by, 0, item);
        save(next);
    };

    return (
        <SettingsCard
            title={tr('Шапка (ПК і планшет)')}
            description={tr(
                'Які розділи стоять значками в шапці. Розділи з нижньої панелі тут не повторюються. Нічого не вибрано — шапка заповнюється сама, скільки вміститься; решта — у меню.',
            )}
        >
            <h3 className="mb-1 text-[13px] font-semibold text-white/50">
                {chosen.length > 0 ? tr('У шапці') : tr('Автоматично')}
            </h3>
            {chosen.length > 0 && (
                <ul
                    className="-mx-4 px-4 sm:-mx-5 sm:px-5"
                    data-test="header-pinned"
                >
                    {chosen.map((item, index) => (
                        <li
                            key={item.key}
                            className="gc-row flex min-h-12 items-center gap-3 py-1.5"
                        >
                            <ModuleIcon
                                name={item.icon}
                                className="size-5 shrink-0 text-primary"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                                {item.label}
                            </span>
                            <IconButton
                                label={tr('Вище')}
                                disabled={index === 0}
                                onClick={() => move(index, -1)}
                            >
                                <ArrowUp className="size-4" />
                            </IconButton>
                            <IconButton
                                label={tr('Нижче')}
                                disabled={index === chosen.length - 1}
                                onClick={() => move(index, 1)}
                            >
                                <ArrowDown className="size-4" />
                            </IconButton>
                            <IconButton
                                label={tr('Прибрати з шапки')}
                                onClick={() =>
                                    save(
                                        chosen
                                            .map((i) => i.key)
                                            .filter((key) => key !== item.key),
                                    )
                                }
                                className="text-red-400"
                            >
                                <CircleMinus className="size-4" />
                            </IconButton>
                        </li>
                    ))}
                </ul>
            )}
            <h3 className="mt-6 mb-2 text-[13px] font-semibold text-white/50">
                {tr('Додати в шапку')}
            </h3>
            <div className="flex flex-wrap gap-2" data-test="header-free">
                {free.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                            save([...chosen.map((i) => i.key), item.key])
                        }
                        className="gc-solid-2 flex items-center gap-2 rounded-control px-3.5 py-2 text-[13px] font-medium text-white/75 transition hover:bg-[var(--gc-l3)]"
                    >
                        <Plus className="size-3.5 text-white/45" />
                        <ModuleIcon
                            name={item.icon}
                            className="size-4 text-primary"
                        />
                        {item.label}
                    </button>
                ))}
            </div>
            {chosen.length > 0 && (
                <button
                    type="button"
                    onClick={() => save([])}
                    className="mt-6 inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white/75 transition hover:bg-[var(--gc-l3)]"
                >
                    <RotateCcw className="size-4" />
                    {tr('Автоматично')}
                </button>
            )}
        </SettingsCard>
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
                'flex size-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition hover:bg-[var(--gc-l3)] disabled:opacity-25',
                className,
            )}
            {...props}
        />
    );
}

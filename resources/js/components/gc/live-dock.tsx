import { Link, router, usePage } from '@inertiajs/react';
import { Gift, Headphones, Menu, Plus, ShieldAlert, Zap } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MenuHub } from '@/components/gc/menu-hub';
import { PostComposer } from '@/components/gc/post-composer';
import { ModuleIcon } from '@/components/gc/module-icon';
import { useRail } from '@/components/gc/rail-widgets';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { motionOr, SNAP } from '@/lib/motion';
import { MOBILE_LABEL } from '@/lib/nav';
import { usePlugin } from '@/lib/plugins';
import { NAV_CACHE, navPrefetch } from '@/lib/prefetch';
import { playNavTick } from '@/lib/sound-fx';
import { cn } from '@/lib/utils';

/** Ширина значка в шапці з проміжком, px (для підрахунку, скільки вміщується). */
const HEADER_SLOT = 44;
/** Запас під назву активного розділу в шапці, px. */
const HEADER_LABEL = 110;

/** Віджет лобі → розділи, які він заміняє в навігації шапки. */
export const WIDGET_SECTIONS: Record<string, string[]> = {
    requests: ['friends'],
    servers: ['servers'],
    season: ['quests'],
    media: ['music', 'cinema'],
};

export type DockItem = {
    key: string;
    href: string;
    icon: string;
    label: string;
    badge: number;
};

type LiveSlot = {
    key: string;
    href: string;
    icon: ReactNode;
    label: string;
    tone?: 'live' | 'alert';
};

/**
 * Живі кнопки дока: з’являються лише за обставин (друзі в голосі, друзі в грі, догана в сім’ї,
 * нагорода за серію). Немає обставини — немає кнопки. Дані — /me/rail і /ready.
 */
export function useLiveSlots(): LiveSlot[] {
    const { data } = useRail();
    const readyOn = usePlugin('ready_to_play');
    const [ready, setReady] = useState(0);

    useEffect(() => {
        if (!readyOn) return;
        const load = () =>
            void api<{ mine: unknown; friends: unknown[] }>('GET', '/ready')
                .then((r) => setReady(r.friends.length))
                .catch(() => undefined);
        load();
        const timer = window.setInterval(load, 60_000);
        return () => window.clearInterval(timer);
    }, [readyOn]);

    const slots: LiveSlot[] = [];
    const room = data?.voice?.find((r) => r.count > 0);
    if (room) {
        slots.push({
            key: 'voice',
            href: room.href,
            icon: <Headphones className="size-4" />,
            label: tr('Голос · {count}', { count: room.count }),
            tone: 'live',
        });
    }
    const inGame = data?.in_game?.length ?? 0;
    if (ready > 0 || inGame > 0) {
        slots.push({
            key: 'ready',
            href: '/feed#ready',
            icon: <Zap className="size-4" />,
            label:
                ready > 0
                    ? tr('Готові грати · {count}', { count: ready })
                    : tr('У грі · {count}', { count: inGame }),
            tone: 'live',
        });
    }
    const family = data?.me?.family;
    if (family && (family.warns ?? 0) > 0) {
        slots.push({
            key: 'family',
            href: `${family.href}/discipline`,
            icon: <ShieldAlert className="size-4" />,
            label: tr('Догана {count}/{limit}', {
                count: family.warns ?? 0,
                limit: family.warn_limit ?? 3,
            }),
            tone: 'alert',
        });
    }
    if (data?.me?.reward) {
        slots.push({
            key: 'reward',
            href: '/quests',
            icon: <Gift className="size-4" />,
            label: tr('Нагорода за серію'),
        });
    }

    return slots;
}

/** Живі кнопки (голос, готові грати, догана, нагорода) у потоці сторінки — у блоці привітання лобі. */
export function LiveChips() {
    const slots = useLiveSlots();
    if (slots.length === 0) return null;

    return (
        <div
            className="mt-4 flex flex-wrap gap-1.5"
            aria-label={tr('Що відбувається')}
        >
            {slots.map((slot) => (
                <Link
                    key={slot.key}
                    href={slot.href}
                    className={cn(
                        'gc-dock-chip',
                        slot.tone && `gc-dock-chip--${slot.tone}`,
                    )}
                >
                    {slot.icon}
                    <span>{slot.label}</span>
                </Link>
            ))}
        </div>
    );
}

/** Відкрити вікно нового допису з будь-якого місця (док «+», картка «Поділитися моментом»). */
export function openComposer() {
    window.dispatchEvent(new Event('gc:compose-open'));
}

/** Вікно нового допису поверх будь-якої сторінки (стрічка — блоки лобі, окремого поля там немає). */
export function ComposeSheet() {
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    useEffect(() => {
        const show = () => setOpen(true);
        const onKey = (e: KeyboardEvent) =>
            e.key === 'Escape' && setOpen(false);
        window.addEventListener('gc:compose-open', show);
        window.addEventListener('keydown', onKey);
        const off = router.on('navigate', () => setOpen(false));
        if (window.location.hash === '#compose') setOpen(true);
        return () => {
            window.removeEventListener('gc:compose-open', show);
            window.removeEventListener('keydown', onKey);
            off();
        };
    }, []);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <m.button
                        type="button"
                        aria-label={tr('Закрити')}
                        onClick={() => setOpen(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/55"
                    />
                    <m.div
                        role="dialog"
                        aria-label={tr('Новий допис')}
                        initial={reduce ? false : { y: 16, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { y: 16, opacity: 0 }}
                        transition={motionOr(reduce, SNAP)}
                        className="gc-compose-sheet"
                    >
                        <PostComposer />
                    </m.div>
                </>
            )}
        </AnimatePresence>
    );
}

/** «+» у центрі капсули: новий допис. */
function CreateButton() {
    return (
        <button
            type="button"
            aria-label={tr('Новий допис')}
            title={tr('Новий допис')}
            onClick={openComposer}
            data-tour="create"
            className="gc-dock-create"
        >
            <Plus className="size-6" strokeWidth={2.25} />
        </button>
    );
}

function Badge({ n }: { n: number }) {
    if (n <= 0) return null;
    return (
        <span className="gc-dock-badge" aria-hidden>
            {n > 99 ? '99+' : n}
        </span>
    );
}

/**
 * Живий док: плаваючий острів знизу по центру (і на ПК, і на телефоні) замість лівого меню й
 * таббару. Закріплені розділи, «Меню» (шторка з усіма розділами) і живі кнопки поруч.
 */
export function LiveDock({
    items,
    isActive,
    variant = 'dock',
    covered = [],
}: {
    /** Розділи, представлені віджетами в лобі (лише для шапки). */
    covered?: string[];
    items: DockItem[];
    isActive: (href: string, key?: string) => boolean;
    /** «dock» — нижній острів (телефон; на ПК лишаються тільки живі кнопки), «header» — розділи в шапці (ПК і планшет). */
    variant?: 'dock' | 'header';
}) {
    const header = variant === 'header';
    const { auth } = usePage().props;
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    const close = useCallback(() => setOpen(false), []);
    // Живі кнопки — у потоці сторінки (LiveChips у лобі), не плаваючі: нічого не перекривають.
    const slots: LiveSlot[] = [];

    const fallback = ['feed', 'messages', 'friends', 'profile'];
    // Розділ, чий віджет уже стоїть у лобі, з навігації зникає — місце бере наступний.
    const shown = items.filter((i) => !covered.includes(i.key));
    const wanted = auth.user.nav_tabs?.length ? auth.user.nav_tabs : fallback;
    // Шапка: стільки значків, скільки вміщується; решта — у меню.
    const [fit, setFit] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        // Міряємо вільне місце в шапці (батьківський nav), а не саму капсулу — вона за вмістом.
        const el = barRef.current?.parentElement;
        if (!header || !el) return;
        const measure = () =>
            setFit(
                Math.max(
                    0,
                    Math.floor(
                        (el.clientWidth - HEADER_SLOT - HEADER_LABEL) /
                            HEADER_SLOT,
                    ),
                ),
            );
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [header]);
    // Капсула знизу — явний вибір людини (налаштування «Нижня панель»), завжди як вибрано.
    const capsule = wanted
        .map((key) => items.find((i) => i.key === key))
        .filter((i): i is DockItem => i !== undefined)
        .slice(0, 4);
    // Шапка: решта без повторів із капсулою; розділ, чий віджет уже в лобі, зникає лише звідси.
    const ordered = [...capsule, ...shown.filter((i) => !capsule.includes(i))];
    // Шапка: свій вибір із налаштувань (без розділів капсули) або автоматично — усе після капсули.
    const chosen = (auth.user.header_tabs ?? [])
        .map((key) => shown.find((i) => i.key === key))
        .filter((i): i is DockItem => i !== undefined && !capsule.includes(i));
    const headerPool =
        chosen.length > 0 ? chosen : ordered.slice(capsule.length);
    const primary = header ? headerPool.slice(0, fit) : capsule;
    // Активний розділ, якого немає в капсулі, у шапці видно завжди.
    if (header && fit > 0) {
        const current = headerPool.find((i) => isActive(i.href, i.key));
        if (current && !primary.includes(current)) {
            if (primary.length < fit) primary.push(current);
            else primary.splice(primary.length - 1, 1, current);
        }
    }
    // Меню: те, чого немає ні в шапці, ні в капсулі (для крапки «є непрочитане»).
    const rest = header
        ? ordered.filter((i) => !capsule.includes(i) && !primary.includes(i))
        : items.filter((i) => !primary.includes(i));
    const restBadge = rest.reduce((sum, i) => sum + i.badge, 0);
    const restActive = !header && rest.some((i) => isActive(i.href, i.key));

    useEffect(() => {
        if (!open) return;
        // «navigate» — лише справжній перехід (prefetch і фонові перезавантаження шторку не закривають).
        const offNavigate = router.on('navigate', close);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
        window.addEventListener('keydown', onKey);
        return () => {
            offNavigate();
            window.removeEventListener('keydown', onKey);
        };
    }, [open, close]);

    return (
        <>
            <AnimatePresence>
                {open && (
                    <>
                        <m.button
                            type="button"
                            aria-label={tr('Закрити меню')}
                            onClick={close}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduce ? 0 : 0.18 }}
                            className="fixed inset-0 z-[54] bg-black/50"
                        />
                        <m.div
                            role="dialog"
                            aria-label={tr('Меню')}
                            initial={
                                reduce
                                    ? false
                                    : { y: header ? -12 : 24, opacity: 0 }
                            }
                            animate={{ y: 0, opacity: 1 }}
                            exit={
                                reduce
                                    ? { opacity: 0 }
                                    : { y: header ? -12 : 24, opacity: 0 }
                            }
                            transition={motionOr(reduce, SNAP)}
                            className={cn(
                                'gc-dock-sheet',
                                header && 'gc-dock-sheet--top',
                            )}
                        >
                            <MenuHub onClose={close} />
                        </m.div>
                    </>
                )}
            </AnimatePresence>
            <nav
                aria-label={tr('Розділи')}
                className={header ? 'gc-header-nav' : 'gc-live-dock'}
            >
                <AnimatePresence initial={false}>
                    {slots.length > 0 && (
                        <m.div
                            key="live"
                            className="gc-dock-live"
                            initial={reduce ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={
                                reduce ? { opacity: 0 } : { opacity: 0, y: 8 }
                            }
                            transition={motionOr(reduce, SNAP)}
                        >
                            <AnimatePresence initial={false}>
                                {slots.map((slot) => (
                                    <m.div
                                        key={slot.key}
                                        layout={!reduce}
                                        initial={
                                            reduce
                                                ? false
                                                : { opacity: 0, scale: 0.85 }
                                        }
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={
                                            reduce
                                                ? { opacity: 0 }
                                                : { opacity: 0, scale: 0.85 }
                                        }
                                        transition={motionOr(reduce, SNAP)}
                                    >
                                        <Link
                                            href={slot.href}
                                            className={cn(
                                                'gc-dock-chip',
                                                slot.tone &&
                                                    `gc-dock-chip--${slot.tone}`,
                                            )}
                                        >
                                            {slot.icon}
                                            <span>{slot.label}</span>
                                        </Link>
                                    </m.div>
                                ))}
                            </AnimatePresence>
                        </m.div>
                    )}
                </AnimatePresence>
                <div
                    ref={barRef}
                    data-tour={header ? 'header-nav' : 'dock'}
                    className={
                        header
                            ? 'gc-header-bar'
                            : // Ім’я переходу — на самій панелі: на обгортці воно відрізало б розмиття від сторінки.
                              'gc-dock-bar [view-transition-name:gc-tabbar]'
                    }
                >
                    {primary.map((item, index) => {
                        const active = !open && isActive(item.href, item.key);
                        const link = (
                            <Link
                                key={item.key}
                                href={item.href}
                                {...({
                                    prefetch: navPrefetch(),
                                    cacheFor: NAV_CACHE,
                                } as object)}
                                onClick={() => playNavTick()}
                                aria-current={active ? 'page' : undefined}
                                title={item.label}
                                aria-label={
                                    item.badge > 0
                                        ? `${item.label}: ${item.badge}`
                                        : item.label
                                }
                                className={cn(
                                    'gc-dock-item',
                                    active && 'is-active',
                                )}
                            >
                                {/* Шапка: підкладка-пігулка «переїжджає» між пунктами (як Tubelight, без лампи й світіння). */}
                                {header && active && (
                                    <m.span
                                        layoutId="gc-tube"
                                        aria-hidden
                                        className="gc-tube"
                                        transition={
                                            reduce
                                                ? { duration: 0 }
                                                : {
                                                      type: 'spring',
                                                      stiffness: 420,
                                                      damping: 34,
                                                  }
                                        }
                                    />
                                )}
                                <span className="relative">
                                    <ModuleIcon
                                        name={item.icon}
                                        animated
                                        size={header ? 20 : 22}
                                    />
                                    <Badge n={item.badge} />
                                </span>
                                <span className="gc-dock-label">
                                    {header
                                        ? item.label
                                        : (MOBILE_LABEL[item.key] ??
                                          item.label)}
                                </span>
                            </Link>
                        );
                        return !header &&
                            index === Math.min(2, primary.length) - 1 ? (
                            <Fragment key={item.key}>
                                {link}
                                <CreateButton />
                            </Fragment>
                        ) : (
                            link
                        );
                    })}
                    <button
                        type="button"
                        data-test={header ? 'header-menu' : 'mobile-menu'}
                        data-tour="menu"
                        aria-expanded={open}
                        aria-label={header ? tr('Меню') : undefined}
                        title={header ? tr('Меню') : undefined}
                        onClick={() => setOpen((v) => !v)}
                        className={cn(
                            'gc-dock-item',
                            // На ПК і планшеті меню — лише в шапці; у капсулі — розділи й «+».
                            !header && 'gc-dock-menu',
                            (open || restActive) && 'is-active',
                        )}
                    >
                        <span className="relative">
                            <Menu className="size-[22px]" />
                            {restBadge > 0 && !open && (
                                <span className="gc-dock-dot" aria-hidden />
                            )}
                        </span>
                        {!header && (
                            <span className="gc-dock-label">{tr('Меню')}</span>
                        )}
                    </button>
                </div>
            </nav>
        </>
    );
}

import { Head, Link, router } from '@inertiajs/react';
import {
    CalendarClock,
    AlertTriangle,
    BarChart3,
    BookOpen,
    CalendarDays,
    ClipboardCheck,
    FilePlus2,
    FileText,
    Gavel,
    Handshake,
    History,
    LayoutDashboard,
    Scale,
    MessagesSquare,
    Package,
    ScrollText,
    Settings,
    ShieldCheck,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { PlusBadge } from '@/components/gc/plus';
import { ServerIcon } from '@/components/servers/server-icon';
import { useRealtime } from '@/hooks/use-realtime';
import { uah } from '@/lib/money';
import { usePlayer } from '@/lib/player';
import { cn, floatingAboveNav } from '@/lib/utils';
import type { FamilySection, FamilyShellProps } from '@/types';
import { FamilyLogo } from './family-logo';
import { RankBadge } from './ui';
import { tr } from '@/lib/i18n';
import { centerInRow } from '@/lib/scroll-row';

type Tab = {
    section: FamilySection;
    label: string;
    href: string;
    icon: LucideIcon;
    badge?: number;
    visible: boolean;
};

export function FamilyShell({
    family,
    me,
    can,
    section,
    badges,
    title,
    children,
}: FamilyShellProps & { title: string; children: ReactNode }) {
    const base = `/f/${family.slug}`;
    const playing = usePlayer().current !== null;
    const reduce = useReducedMotion();
    const tabStrip = useRef<HTMLElement | null>(null);

    useEffect(() => {
        centerInRow(
            tabStrip.current,
            tabStrip.current?.querySelector<HTMLElement>(
                '[aria-current="page"]',
            ),
            true,
        );
    }, [section]);
    const reload = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tabsNav = useRef<HTMLElement | null>(null);

    useRealtime(`family.${family.id}`, {
        'family.updated': () => {
            if (reload.current) clearTimeout(reload.current);
            reload.current = setTimeout(() => router.reload(), 700);
        },
    });

    useEffect(() => {
        const active = tabsNav.current?.querySelector<HTMLElement>(
            '[data-family-tab="active"]',
        );
        centerInRow(tabsNav.current, active, true);
    }, [section]);

    const tabs: Tab[] = [
        {
            section: 'overview',
            label: tr('Огляд'),
            href: base,
            icon: LayoutDashboard,
            visible: true,
        },
        {
            section: 'reports',
            label: tr('Звіти'),
            href: `${base}/reports`,
            icon: FileText,
            badge: badges?.my_pending,
            visible: true,
        },
        {
            section: 'queue',
            label: tr('Перевірка'),
            href: `${base}/queue`,
            icon: ClipboardCheck,
            badge: badges?.queue,
            visible: can['reports.review'] || can['treasury.manage'],
        },
        {
            section: 'bank',
            label: tr('Банк'),
            href: `${base}/bank`,
            icon: Wallet,
            visible: true,
        },
        {
            section: 'warehouse',
            label: tr('Склад'),
            href: `${base}/warehouse`,
            icon: Package,
            badge: badges?.alerts,
            visible: family.sections?.warehouse !== false,
        },
        {
            section: 'members',
            label: tr('Учасники'),
            href: `${base}/members`,
            icon: Users,
            badge: badges?.applications,
            visible: true,
        },
        {
            section: 'discipline',
            label: tr('Дисципліна'),
            href: `${base}/discipline`,
            icon: Gavel,
            visible: true,
        },
        {
            section: 'events',
            label: tr('Події'),
            href: `${base}/events`,
            icon: CalendarDays,
            visible: family.sections?.events !== false,
        },
        {
            section: 'shifts',
            label: tr('Зміни'),
            href: `${base}/shifts`,
            icon: CalendarClock,
            visible: family.shifts_enabled !== false,
        },
        {
            section: 'rating',
            label: tr('Рейтинг'),
            href: `${base}/rating`,
            icon: BarChart3,
            visible: family.sections?.rating !== false,
        },
        {
            section: 'charter',
            label: tr('Статут'),
            href: `${base}/charter`,
            icon: Scale,
            visible: true,
        },
        {
            section: 'wiki',
            label: tr('Вікі'),
            href: `${base}/wiki`,
            icon: BookOpen,
            visible: true,
        },
        {
            section: 'relations',
            label: tr('Союзи й війни'),
            href: `${base}/relations`,
            icon: Handshake,
            visible: true,
        },
        {
            section: 'history',
            label: tr('Історія'),
            href: `${base}/history`,
            icon: History,
            visible: true,
        },
        {
            section: 'audit',
            label: tr('Аудит'),
            href: `${base}/audit`,
            icon: ScrollText,
            visible: can['audit.view'],
        },
        {
            section: 'settings',
            label: tr('Налаштування'),
            href: `${base}/settings`,
            icon: Settings,
            visible: can['settings.manage'],
        },
    ];

    // Групи вкладок: робота, люди, сама сім’я, керування — щоб 16 розділів читались одразу.
    const GROUPS: { key: string; label: string; items: FamilySection[] }[] = [
        {
            key: 'work',
            label: tr('Робота'),
            items: [
                'overview',
                'reports',
                'queue',
                'bank',
                'warehouse',
                'shifts',
            ],
        },
        {
            key: 'people',
            label: tr('Люди'),
            items: ['members', 'discipline', 'events', 'rating'],
        },
        {
            key: 'family',
            label: tr('Сім’я'),
            items: ['charter', 'wiki', 'relations', 'history'],
        },
        { key: 'admin', label: tr('Керування'), items: ['audit', 'settings'] },
    ];
    const visible = tabs.filter((t) => t.visible);
    const groups = GROUPS.map((g) => ({
        ...g,
        tabs: g.items
            .map((key) => visible.find((t) => t.section === key))
            .filter((t): t is Tab => t !== undefined),
    })).filter((g) => g.tabs.length > 0);

    // На огляді є велика кнопка «Новий звіт» — плаваюча там лише закривала б вміст.
    const showReportButton = section !== 'reports' && section !== 'overview';

    return (
        <>
            <Head title={`${title} · [${family.tag}] ${family.name}`} />
            <div className={cn('space-y-4', showReportButton && 'pb-20')}>
                <header className="gc-family-hero">
                    <div className="gc-family-hero__cover">
                        {family.cover_url ? (
                            <img
                                decoding="async"
                                src={family.cover_url}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : (
                            <div
                                className="size-full"
                                style={{
                                    backgroundImage: family.plus?.accent
                                        ? `linear-gradient(120deg, ${family.plus.accent.join(', ')})`
                                        : 'linear-gradient(120deg, color-mix(in oklab, var(--gc-accent-strong) 40%, var(--gc-l2)), var(--gc-l2) 70%)',
                                }}
                            />
                        )}
                    </div>
                    <div className="relative -mt-10 flex flex-wrap items-start gap-x-5 gap-y-4 px-4 pb-5 sm:px-6">
                        <FamilyLogo
                            family={family}
                            size="xl"
                            className="ring-4 ring-[var(--gc-l1)]"
                        />
                        <div className="min-w-0 flex-1 pt-12">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-[32px]">
                                    <span className="text-[var(--gc-accent)]">
                                        [{family.tag}]
                                    </span>{' '}
                                    {family.name}
                                </h1>
                                {family.status === 'verified' && (
                                    <ShieldCheck
                                        className="size-5 text-[var(--gc-live)]"
                                        aria-label={tr('Верифіковано')}
                                    />
                                )}
                                {family.plus && (
                                    <PlusBadge className="size-5 rounded-md" />
                                )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--gc-text-2)]">
                                {family.server && (
                                    <Link
                                        href={`/servers/${family.server.slug}`}
                                        className="flex items-center gap-1.5 hover:text-[var(--gc-text)]"
                                    >
                                        <ServerIcon
                                            name={family.server.name}
                                            icon={family.server.icon}
                                            className="size-4 rounded-md text-[7px]"
                                        />
                                        {family.server.name}
                                    </Link>
                                )}
                                <span className="flex items-center gap-1">
                                    <Users className="size-3.5" />
                                    {tr('{n} учасників', {
                                        n: family.members_count,
                                    })}
                                </span>
                                {can['treasury.manage'] && (
                                    <span>
                                        {tr('Скарбниця:')}{' '}
                                        {uah(family.treasury)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:pt-12">
                            <div className="gc-family-me">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">
                                        {me.display}
                                    </div>
                                    <RankBadge
                                        rank={me.rank}
                                        title={me.rank_title}
                                        className="mt-0.5"
                                    />
                                </div>
                                <div className="ml-auto pl-4 text-right">
                                    <div className="text-xs text-[var(--gc-text-2)]">
                                        {tr('Баланс')}
                                    </div>
                                    <div
                                        className={cn(
                                            'text-base font-bold whitespace-nowrap tabular-nums',
                                            me.balance < 0
                                                ? 'text-red-400'
                                                : 'text-[var(--gc-live)]',
                                        )}
                                    >
                                        {uah(me.balance)}
                                    </div>
                                </div>
                            </div>
                            {family.conversation_id && (
                                <a
                                    href={`${base}/chat`}
                                    className="gc-ghost-btn h-12 px-4"
                                >
                                    <MessagesSquare className="size-4" />
                                    {tr('Чат')}
                                </a>
                            )}
                        </div>
                    </div>
                </header>

                {/* Вкладки: групи з тонким роздільником, підкладка активної «переїжджає», липнуть під шапкою. */}
                <nav
                    ref={(el) => {
                        tabStrip.current = el;
                        tabsNav.current = el;
                    }}
                    aria-label={tr('Розділи сім’ї')}
                    className="gc-family-tabs"
                >
                    {groups.map((g, gi) => (
                        <div
                            key={g.key}
                            role="group"
                            aria-label={g.label}
                            className="flex shrink-0 items-center gap-0.5"
                        >
                            {gi > 0 && (
                                <span
                                    aria-hidden
                                    className="mx-1.5 h-5 w-px bg-[var(--gc-hairline)]"
                                />
                            )}
                            {g.tabs.map((t) => {
                                const on = section === t.section;
                                return (
                                    <Link
                                        key={t.section}
                                        href={t.href}
                                        preserveScroll
                                        preserveState
                                        prefetch={['hover']}
                                        cacheFor="1m"
                                        aria-current={on ? 'page' : undefined}
                                        data-family-tab={
                                            on ? 'active' : undefined
                                        }
                                        className={cn(
                                            'gc-family-tab',
                                            on && 'is-active',
                                        )}
                                    >
                                        {on && (
                                            <m.span
                                                layoutId="gc-family-tab"
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
                                                aria-hidden
                                            />
                                        )}
                                        <t.icon className="relative size-4" />
                                        <span className="relative">
                                            {t.label}
                                        </span>
                                        {!!t.badge && (
                                            <span className="relative min-w-4 rounded-full bg-[var(--gc-alert)] px-1.5 text-center text-[11px] leading-4 font-semibold text-white tabular-nums">
                                                {t.badge > 99 ? '99+' : t.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {family.status !== 'verified' && (
                    <div
                        className={cn(
                            'flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm',
                            family.status === 'suspended'
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-amber-300/10 text-amber-400',
                        )}
                    >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <div>
                            <div className="font-semibold">
                                {family.status === 'suspended'
                                    ? tr(
                                          'Сім’ю призупинено платформою — зміни недоступні',
                                      )
                                    : tr('Сім’я очікує верифікації')}
                            </div>
                            <div className="mt-0.5 text-xs opacity-80">
                                {family.status === 'suspended'
                                    ? family.status_reason ||
                                      tr('Зверніться до адміністрації GameCon.')
                                    : tr(
                                          'Панель уже працює. Після перевірки адміністрацією з’являться публічна сторінка, набір учасників і чат сім’ї.',
                                      )}
                            </div>
                        </div>
                    </div>
                )}

                {children}
            </div>

            {showReportButton && (
                <Link
                    href={`${base}/reports?new=1`}
                    className={cn(
                        'gc-primary-btn fixed right-4 z-30 h-12 px-5 shadow-[0_12px_28px_-12px_rgb(0_0_0/0.7)]',
                        floatingAboveNav(playing),
                    )}
                >
                    <FilePlus2 className="size-5" /> {tr('Звіт')}
                </Link>
            )}
        </>
    );
}

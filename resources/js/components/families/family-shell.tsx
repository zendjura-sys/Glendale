import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    ClipboardCheck,
    FilePlus2,
    FileText,
    Gavel,
    LayoutDashboard,
    MessagesSquare,
    Package,
    ScrollText,
    Settings,
    ShieldCheck,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef } from 'react';
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
    const reload = useRef<ReturnType<typeof setTimeout> | null>(null);

    useRealtime(`family.${family.id}`, {
        'family.updated': () => {
            if (reload.current) clearTimeout(reload.current);
            reload.current = setTimeout(() => router.reload(), 700);
        },
    });

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
            visible: true,
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
            visible: true,
        },
        {
            section: 'rating',
            label: tr('Рейтинг'),
            href: `${base}/rating`,
            icon: BarChart3,
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

    // На огляді є велика кнопка «Новий звіт» — плаваюча там лише закривала б вміст.
    const showReportButton = section !== 'reports' && section !== 'overview';

    return (
        <>
            <Head title={`${title} · [${family.tag}] ${family.name}`} />
            <div
                className={cn('space-y-4', showReportButton && 'pb-20 lg:pb-0')}
            >
                <header className="glass noise relative overflow-hidden rounded-3xl">
                    <div className="relative h-28 sm:h-36">
                        {family.cover_url ? (
                            <img
                                src={family.cover_url}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : family.plus?.accent ? (
                            <div
                                className="size-full opacity-70"
                                style={{
                                    backgroundImage: `radial-gradient(120% 120% at 0% 0%, ${family.plus.accent[0]}, transparent 55%), radial-gradient(120% 120% at 100% 0%, ${family.plus.accent[1]}, transparent 60%), linear-gradient(135deg, #0b0f1d, #141a33)`,
                                }}
                            />
                        ) : (
                            <div className="size-full bg-[radial-gradient(120%_120%_at_0%_0%,#f59e0b55,transparent_55%),radial-gradient(120%_120%_at_100%_0%,#6d5dfc66,transparent_60%),linear-gradient(135deg,#0b0f1d,#141a33)]" />
                        )}
                        <div className="scrim absolute inset-0" />
                        {family.plus?.accent && (
                            <div
                                className="absolute inset-x-0 bottom-0 h-[3px]"
                                style={{
                                    backgroundImage: `linear-gradient(90deg, ${family.plus.accent.join(', ')})`,
                                }}
                            />
                        )}
                    </div>
                    <div className="relative -mt-12 flex flex-wrap items-end gap-4 px-4 pb-4 sm:px-6">
                        <FamilyLogo
                            family={family}
                            size="xl"
                            className="shadow-[0_10px_40px_-10px_rgb(250_204_21/0.5)] ring-4 ring-[#0a0d18]"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                                    <span className="text-amber-300">
                                        [{family.tag}]
                                    </span>{' '}
                                    {family.name}
                                </h1>
                                {family.status === 'verified' && (
                                    <ShieldCheck
                                        className="size-5 text-emerald-300"
                                        aria-label={tr('Верифіковано')}
                                    />
                                )}
                                {family.plus && (
                                    <PlusBadge className="size-5 rounded-md" />
                                )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
                                {family.server && (
                                    <Link
                                        href={`/servers/${family.server.slug}`}
                                        className="flex items-center gap-1.5 hover:text-white"
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
                                    {family.members_count}
                                </span>
                                {can['treasury.manage'] && (
                                    <span>
                                        {tr('Скарбниця:')}{' '}
                                        {uah(family.treasury)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white/[0.05] px-3.5 py-2 ring-1 ring-white/[0.07] sm:flex-none">
                                <div className="min-w-0">
                                    <div className="font-mono text-sm font-semibold break-words text-white">
                                        {me.display}
                                    </div>
                                    <RankBadge
                                        rank={me.rank}
                                        title={me.rank_title}
                                        className="mt-0.5"
                                    />
                                </div>
                                <div className="ml-auto border-l border-white/10 pl-3 text-right">
                                    <div className="text-xs tracking-wide text-white/40 uppercase">
                                        {tr('Баланс')}
                                    </div>
                                    <div
                                        className={cn(
                                            'font-display text-base font-bold whitespace-nowrap',
                                            me.balance < 0
                                                ? 'text-rose-300'
                                                : 'text-emerald-300',
                                        )}
                                    >
                                        {uah(me.balance)}
                                    </div>
                                </div>
                            </div>
                            {family.conversation_id && (
                                <a
                                    href={`${base}/chat`}
                                    className="glass inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium text-white/80 hover:text-white"
                                >
                                    <MessagesSquare className="size-4" />{' '}
                                    {tr('Чат')}
                                </a>
                            )}
                        </div>
                    </div>
                    <nav className="flex [scrollbar-width:none] gap-1 overflow-x-auto border-t border-white/[0.06] px-2 py-1.5 sm:px-4 [&::-webkit-scrollbar]:hidden">
                        {tabs
                            .filter((t) => t.visible)
                            .map((t) => (
                                <Link
                                    key={t.section}
                                    href={t.href}
                                    preserveScroll
                                    className={cn(
                                        'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition',
                                        section === t.section
                                            ? 'bg-white/[0.08] text-white'
                                            : 'text-white/50 hover:text-white',
                                    )}
                                >
                                    <t.icon className="size-4" />
                                    {t.label}
                                    {!!t.badge && (
                                        <span className="rounded-full bg-rose-500 px-1.5 text-[11px] leading-4 font-semibold text-white">
                                            {t.badge > 99 ? '99+' : t.badge}
                                        </span>
                                    )}
                                    {section === t.section && (
                                        <span className="absolute inset-x-3 -bottom-1.5 h-0.5 rounded-full bg-gradient-brand" />
                                    )}
                                </Link>
                            ))}
                    </nav>
                </header>

                {family.status !== 'verified' && (
                    <div
                        className={cn(
                            'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
                            family.status === 'suspended'
                                ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                                : 'border-amber-300/30 bg-amber-300/10 text-amber-100',
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
                        'btn-glow fixed right-4 z-30 inline-flex h-14 items-center gap-2 rounded-2xl px-5 text-sm font-semibold shadow-2xl lg:hidden',
                        floatingAboveNav(playing),
                    )}
                >
                    <FilePlus2 className="size-5" /> {tr('Звіт')}
                </Link>
            )}
        </>
    );
}

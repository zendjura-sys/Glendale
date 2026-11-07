import { Link, router, usePage } from '@inertiajs/react';
import {
    Bookmark,
    ChevronDown,
    ChevronRight,
    Clapperboard,
    Coins,
    FileCheck,
    Gamepad2,
    Headset,
    Image,
    LifeBuoy,
    LogOut,
    MessageSquareHeart,
    Music,
    Package,
    PanelBottom,
    Phone,
    Radar,
    Server,
    Settings,
    ShieldCheck,
    ShieldHalf,
    Siren,
    Sparkles,
    Swords,
    UserPlus,
    UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { AccountSwitcher } from '@/components/gc/account-switcher';
import { openFeedback } from '@/components/gc/site-extras';
import { LanguageSelect } from '@/components/gc/language-switcher';
import { ModuleIcon } from '@/components/gc/module-icon';
import { PlusBadge, plusNameProps } from '@/components/gc/plus';
import { StatusDialog } from '@/components/gc/status-dialog';
import { ThemeRow } from '@/components/gc/theme-toggle';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { forgetOfflinePages } from '@/lib/offline';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';

type Hub = {
    alerts: {
        active_count: number;
        region: { name: string; active: boolean } | null;
    } | null;
    family: {
        name: string;
        slug: string;
        treasury: number;
        items: number;
        low_stock: number;
        pending_reports: number;
    } | null;
};

/** Розділи, що вже мають свою плитку в хабі, — у «Ще розділи» їх не дублюємо. */
const IN_HUB = new Set([
    'profile',
    'servers',
    'clans',
    'party',
    'games',
    'music',
    'cinema',
    'communities',
    'photos',
    'phone',
    'families',
]);

const block = 'gc-solid rounded-2xl p-3';
const inner = 'gc-solid-2 rounded-xl transition hover:bg-[var(--gc-l3)]';

function Tile({
    href,
    icon: Icon,
    title,
    hint,
    tone,
}: {
    href: string;
    icon: ComponentType<{ className?: string }>;
    title: string;
    hint: string;
    tone: string;
}) {
    return (
        <Link href={href} className={cn(inner, 'flex flex-col gap-2 p-3')}>
            <Icon className={cn('size-5', tone)} />
            <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-white">
                    {title}
                </span>
                <span className="block truncate text-[11px] text-white/60">
                    {hint}
                </span>
            </span>
        </Link>
    );
}

function Row({
    href,
    icon: Icon,
    children,
    onClick,
    danger,
}: {
    href?: string;
    icon: ComponentType<{ className?: string }>;
    children: ReactNode;
    onClick?: () => void;
    danger?: boolean;
}) {
    const cls = cn(
        'flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-[14px] font-medium transition hover:bg-[var(--gc-l2)]',
        danger ? 'text-red-400' : 'text-white/85',
    );
    const content = (
        <>
            <Icon className="size-[18px] shrink-0" />
            <span className="min-w-0 flex-1 truncate">{children}</span>
        </>
    );

    return href ? (
        <Link href={href} className={cls}>
            {content}
        </Link>
    ) : (
        <button type="button" onClick={onClick} className={cls}>
            {content}
        </button>
    );
}

/**
 * Меню «Bento Hub» (телефон): профіль і GameCon+, інформер тривог, ігровий хаб (штаб сім'ї й казна,
 * плитки 2×2), медіа (ряд 1×4) і системний акордеон. Суцільні матові поверхні, без рамок і тіней.
 */
export function MenuHub({ onClose }: { onClose: () => void }) {
    const { auth, airAlerts, modules, nav } = usePage().props;
    const user = auth.user;
    const supportOn = usePlugin('support_tickets');
    const [hub, setHub] = useState<Hub | null>(null);
    const [system, setSystem] = useState(false);
    const [more, setMore] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const statusOn = usePlugin('status_emoji');
    const profilePinned = (user.nav_tabs ?? []).includes('profile');
    const on = (key: string) => modules.includes(key);

    useEffect(() => {
        void api<Hub>('GET', '/me/hub')
            .then(setHub)
            .catch(() => undefined);
    }, []);

    const plusEnds = user.plus_until ? new Date(user.plus_until).getTime() : 0;
    const plusActive = plusEnds > Date.now();
    const plusDays = plusActive
        ? Math.ceil((plusEnds - Date.now()) / 86_400_000)
        : 0;
    const family = hub?.family;
    const alerts = hub?.alerts;
    const rest = nav.filter((i) => !IN_HUB.has(i.key));

    return (
        <div className="space-y-3">
            <StatusDialog
                user={user}
                open={statusOpen}
                onOpenChange={setStatusOpen}
            />
            {/* 1. Профіль і GameCon+ */}
            <section className={block}>
                <div className="flex items-center gap-3">
                    {/* Посилання на профіль — лише одне: якщо «Сторінка» вже в нижній панелі, тут просто картка. */}
                    {profilePinned ? (
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <UserAvatar user={user} size="md" />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1 truncate text-[15px] font-semibold text-white">
                                    <span {...plusNameProps(user.plus)}>
                                        {user.name}
                                    </span>
                                    {user.is_verified && (
                                        <VerifiedBadge
                                            kind={user.verified_kind}
                                            className="size-3.5"
                                        />
                                    )}
                                    {user.is_admin && (
                                        <ShieldCheck className="size-3.5 text-amber-400" />
                                    )}
                                </span>
                                <span className="block truncate text-xs text-white/60">
                                    @{user.username}
                                </span>
                            </span>
                        </div>
                    ) : (
                        <Link
                            href={`/${user.username}`}
                            className="flex min-w-0 flex-1 items-center gap-3"
                        >
                            <UserAvatar user={user} size="md" />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1 truncate text-[15px] font-semibold text-white">
                                    <span {...plusNameProps(user.plus)}>
                                        {user.name}
                                    </span>
                                    {user.is_verified && (
                                        <VerifiedBadge
                                            kind={user.verified_kind}
                                            className="size-3.5"
                                        />
                                    )}
                                    {user.is_admin && (
                                        <ShieldCheck className="size-3.5 text-amber-400" />
                                    )}
                                </span>
                                <span className="block truncate text-xs text-white/60">
                                    @{user.username}
                                </span>
                            </span>
                        </Link>
                    )}
                    {statusOn && (
                        <button
                            type="button"
                            onClick={() => setStatusOpen(true)}
                            title={tr('Встановити статус')}
                            aria-label={tr('Встановити статус')}
                            className={cn(
                                inner,
                                'flex size-10 shrink-0 items-center justify-center text-lg',
                            )}
                        >
                            {user.status_emoji ?? '🙂'}
                        </button>
                    )}
                    <AccountSwitcher
                        variant="quick"
                        rowClass={cn(
                            inner,
                            'flex size-10 shrink-0 items-center justify-center text-sky-400',
                        )}
                    />
                </div>
                {/* GameCon+: дві строки — назва й статус, нижче строк і кнопка (не стиснуто). */}
                <div className="gc-solid-2 mt-3 rounded-xl p-3">
                    <div className="flex items-center gap-2.5">
                        <PlusBadge className="size-8 rounded-lg [&_svg]:size-4" />
                        <span className="min-w-0 flex-1 text-[14px] font-semibold text-white">
                            GameCon+
                        </span>
                        <span
                            className={cn(
                                'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                                plusActive
                                    ? 'bg-emerald-400/15 text-emerald-400'
                                    : 'bg-[var(--gc-l3)] text-white/60',
                            )}
                        >
                            {plusActive ? tr('Активний') : tr('Не активний')}
                        </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-xs text-white/60">
                            {plusActive
                                ? tr('Ще {n} дн.', { n: plusDays })
                                : tr('Рамки, ник, теми й більше')}
                        </span>
                        <Link
                            href="/plus"
                            className="shrink-0 rounded-lg bg-[var(--gc-active)] px-4 py-2 text-xs font-semibold text-sky-400"
                        >
                            {plusActive ? tr('Продовжити') : tr('Оформити')}
                        </Link>
                    </div>
                </div>
            </section>

            {/* 2. Інформер тривог (лише для України) */}
            {airAlerts && (
                <Link
                    href="/alerts"
                    className={cn(block, 'flex items-center gap-3')}
                >
                    <span
                        className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-xl',
                            alerts && alerts.active_count > 0
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-emerald-400/15 text-emerald-400',
                        )}
                    >
                        <Siren className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-white">
                            {alerts && alerts.active_count > 0
                                ? tr('Тривога в {n} обл.', {
                                      n: alerts.active_count,
                                  })
                                : tr('Тривог немає')}
                        </span>
                        <span className="block truncate text-xs text-white/60">
                            {alerts?.region
                                ? alerts.region.active
                                    ? tr('{name}: тривога', {
                                          name: alerts.region.name,
                                      })
                                    : tr('{name}: спокійно', {
                                          name: alerts.region.name,
                                      })
                                : tr('Оберіть свій регіон на мапі')}
                        </span>
                    </span>
                    <ChevronRight className="size-4 text-white/50" />
                </Link>
            )}

            {/* 3. Ігровий хаб і RP */}
            <section className={cn(block, 'space-y-2')}>
                {on('families') &&
                    (family ? (
                        <Link
                            href={`/f/${family.slug}`}
                            className={cn(inner, 'block p-3')}
                        >
                            <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
                                <ShieldHalf className="size-4 text-sky-400" />
                                {tr('Штаб сім’ї & Казна')}
                                <span className="ml-auto truncate text-xs font-normal text-white/60">
                                    {family.name}
                                </span>
                            </span>
                            <span className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                                <span className="rounded-lg bg-[var(--gc-l3)] p-2">
                                    <Coins className="mx-auto size-4 text-amber-400" />
                                    <span className="mt-1 block text-sm font-bold text-white tabular-nums">
                                        {family.treasury.toLocaleString('uk')}
                                    </span>
                                    <span className="block text-[10px] text-white/60">
                                        {tr('Казна')}
                                    </span>
                                </span>
                                <span className="rounded-lg bg-[var(--gc-l3)] p-2">
                                    <Package
                                        className={cn(
                                            'mx-auto size-4',
                                            family.low_stock > 0
                                                ? 'text-amber-400'
                                                : 'text-emerald-400',
                                        )}
                                    />
                                    <span className="mt-1 block text-sm font-bold text-white tabular-nums">
                                        {family.items}
                                    </span>
                                    <span className="block text-[10px] text-white/60">
                                        {family.low_stock > 0
                                            ? tr('Закінчується: {n}', {
                                                  n: family.low_stock,
                                              })
                                            : tr('Склад у нормі')}
                                    </span>
                                </span>
                                <span className="rounded-lg bg-[var(--gc-l3)] p-2">
                                    <FileCheck className="mx-auto size-4 text-cyan-400" />
                                    <span className="mt-1 block text-sm font-bold text-white tabular-nums">
                                        {family.pending_reports}
                                    </span>
                                    <span className="block text-[10px] text-white/60">
                                        {tr('Звітів на перевірці')}
                                    </span>
                                </span>
                            </span>
                        </Link>
                    ) : (
                        <Link
                            href="/families"
                            className={cn(inner, 'flex items-center gap-3 p-3')}
                        >
                            <ShieldHalf className="size-5 text-sky-400" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold text-white">
                                    {tr('Штаб сім’ї & Казна')}
                                </span>
                                <span className="block text-[11px] text-white/60">
                                    {tr('Знайдіть сім’ю або створіть свою')}
                                </span>
                            </span>
                            <ChevronRight className="size-4 text-white/50" />
                        </Link>
                    ))}
                <div className="grid grid-cols-2 gap-2">
                    {on('servers') && (
                        <Tile
                            href="/servers"
                            icon={Server}
                            title={tr('Сервери GTA')}
                            hint={tr('Онлайн і моніторинг')}
                            tone="text-sky-400"
                        />
                    )}
                    {on('clans') && (
                        <Tile
                            href="/clans"
                            icon={Swords}
                            title={tr('Клани & Війни')}
                            hint={tr('Дипломатія й матчі')}
                            tone="text-amber-400"
                        />
                    )}
                    {on('party') && (
                        <Tile
                            href="/party"
                            icon={Radar}
                            title={tr('Пошук паті')}
                            hint={tr('Хто готовий грати')}
                            tone="text-emerald-400"
                        />
                    )}
                    {on('games') && (
                        <Tile
                            href="/games"
                            icon={Gamepad2}
                            title={tr('Ігри & FPS')}
                            hint={tr('Перевірка ПК, беклог, роздачі')}
                            tone="text-cyan-400"
                        />
                    )}
                </div>
            </section>

            {/* 4. Медіа й спільнота */}
            <section className={cn(block, 'space-y-2')}>
                <div className="grid grid-cols-4 gap-2">
                    {(
                        [
                            ['music', '/music', Music, tr('Музика')],
                            ['cinema', '/cinema', Clapperboard, tr('Кіно')],
                            [
                                'communities',
                                '/communities',
                                UsersRound,
                                tr('Спільноти'),
                            ],
                            ['photos', '/photos', Image, tr('Фото')],
                        ] as const
                    )
                        .filter(([key]) => on(key))
                        .map(([key, href, Icon, label]) => (
                            <Link
                                key={key}
                                href={href}
                                className={cn(
                                    inner,
                                    'flex flex-col items-center gap-1.5 px-1 py-2.5 text-center',
                                )}
                            >
                                <Icon className="size-5 text-sky-400" />
                                <span className="w-full truncate text-[11px] font-medium text-white/85">
                                    {label}
                                </span>
                            </Link>
                        ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {on('phone') && (
                        <Link
                            href="/phone"
                            className={cn(
                                inner,
                                'flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-white/85',
                            )}
                        >
                            <Phone className="size-4 text-emerald-400" />
                            {tr('Телефон')}
                        </Link>
                    )}
                    <Link
                        href="/saved"
                        className={cn(
                            inner,
                            'flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-white/85',
                        )}
                    >
                        <Bookmark className="size-4 text-amber-400" />
                        {tr('Збережене')}
                    </Link>
                </div>
                {rest.length > 0 && (
                    <>
                        <button
                            type="button"
                            aria-expanded={more}
                            onClick={() => setMore((v) => !v)}
                            className="flex w-full items-center gap-2 px-1 pt-1 text-xs font-semibold text-white/60"
                        >
                            {tr('Ще розділи')}
                            <ChevronDown
                                className={cn(
                                    'ml-auto size-4 transition-transform',
                                    more && 'rotate-180',
                                )}
                            />
                        </button>
                        {more && (
                            <div className="grid grid-cols-2 gap-1.5">
                                {rest.map((item) => (
                                    <Link
                                        key={item.key}
                                        href={item.href}
                                        className={cn(
                                            inner,
                                            'flex items-center gap-2 px-2.5 py-2 text-[13px] font-medium text-white/85',
                                        )}
                                    >
                                        <ModuleIcon
                                            name={item.icon}
                                            size={16}
                                            className="shrink-0 text-sky-400"
                                        />
                                        <span className="truncate">
                                            {item.label}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* 5. Системний акордеон */}
            <section className={block}>
                <button
                    type="button"
                    aria-expanded={system}
                    onClick={() => setSystem((v) => !v)}
                    className="flex min-h-10 w-full items-center gap-3 px-2.5 text-left text-[14px] font-semibold text-white"
                >
                    <Settings className="size-[18px] text-sky-400" />
                    {tr('Система')}
                    <ChevronDown
                        className={cn(
                            'ml-auto size-4 transition-transform',
                            system && 'rotate-180',
                        )}
                    />
                </button>
                {system && (
                    <div className="mt-1">
                        <Row href="/settings/profile" icon={Settings}>
                            {tr('Налаштування')}
                        </Row>
                        <Row href="/settings/navigation" icon={PanelBottom}>
                            {tr('Налаштувати нижню панель')}
                        </Row>
                        <Row href="/invite" icon={UserPlus}>
                            {tr('Запросити друзів')}
                        </Row>
                        <LanguageSelect className="mx-2.5 my-1.5" />
                        <ThemeRow />
                        <Row href="/help" icon={LifeBuoy}>
                            {tr('Довідка')}
                        </Row>
                        {supportOn && (
                            <Row href="/support" icon={Headset}>
                                {tr('Підтримка')}
                            </Row>
                        )}
                        <Row
                            icon={MessageSquareHeart}
                            onClick={() => {
                                onClose();
                                openFeedback();
                            }}
                        >
                            {tr('Відгук адмінам')}
                        </Row>
                        {(user.is_admin || user.role === 'moderator') && (
                            <Row href="/admin" icon={ShieldCheck}>
                                {tr('Адмін-панель')}
                            </Row>
                        )}
                        <Row
                            icon={LogOut}
                            danger
                            onClick={() => {
                                forgetOfflinePages();
                                router.post('/logout');
                            }}
                        >
                            {tr('Вийти')}
                        </Row>
                    </div>
                )}
            </section>
            <p className="flex items-center justify-center gap-1.5 pb-1 text-[11px] text-white/50">
                <Sparkles className="size-3" />
                GameCon
            </p>
        </div>
    );
}

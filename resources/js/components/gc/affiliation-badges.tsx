import { Link } from '@inertiajs/react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Castle, Gamepad2, Server, Swords } from 'lucide-react';
import type { ComponentType } from 'react';
import { tr } from '@/lib/i18n';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AffiliationBadge = {
    /** family | clan | server | game */
    kind: string;
    name: string;
    tag: string | null;
    logo: string | null;
    href: string;
    role: string | null;
    lines: string[];
    /** Група: family, clan:{id}, playing — сім'я з сервером, клан чи гільдія з грою. */
    group?: string;
};

const KIND: Record<
    string,
    { icon: ComponentType<{ className?: string }>; label: () => string }
> = {
    family: { icon: Castle, label: () => tr('Сім’я') },
    clan: { icon: Swords, label: () => tr('Клан') },
    guild: { icon: Swords, label: () => tr('Гільдія') },
    server: { icon: Server, label: () => tr('Сервер') },
    game: { icon: Gamepad2, label: () => tr('Гра') },
};

/** Логотип значка: картинка з розділу, а без неї — тег або іконка виду. */
function Logo({ badge, size }: { badge: AffiliationBadge; size: number }) {
    const look = KIND[badge.kind] ?? KIND.game;
    const Icon = look.icon;
    if (badge.logo) {
        return (
            <img
                src={badge.logo}
                alt=""
                loading="lazy"
                className="shrink-0 rounded-md object-cover"
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <span
            className="grid shrink-0 place-items-center rounded-md bg-sky-500/15 text-sky-400"
            style={{ width: size, height: size }}
        >
            {badge.tag && size >= 30 ? (
                <span className="text-[11px] font-bold">
                    {badge.tag.slice(0, 4)}
                </span>
            ) : (
                <Icon className="size-[70%]" />
            )}
        </span>
    );
}

/**
 * Значки біля ніка: зменшені логотипи сім'ї (і її сервера ГТА), клану чи гільдії (і гри клану),
 * гри, у яку людина зараз грає. Наведення — картка з назвою, роллю й відомостями, натискання —
 * перехід у розділ. На телефоні видно лише першу групу (порядок людина обирає в налаштуваннях),
 * решта — за кнопкою «+N» зі списком і описами.
 */
export function AffiliationBadges({
    badges,
    size = 18,
    className,
}: {
    badges?: AffiliationBadge[] | null;
    size?: number;
    className?: string;
}) {
    if (!badges || badges.length === 0) return null;
    const first = badges[0].group;
    const rest = badges.filter((b) => b.group !== first);

    return (
        <span className={cn('inline-flex items-center gap-1', className)}>
            {badges.map((badge) => (
                <BadgeTip
                    key={`${badge.kind}-${badge.href}-${badge.name}`}
                    badge={badge}
                    size={size}
                    className={
                        badge.group !== first
                            ? 'hidden sm:inline-flex'
                            : undefined
                    }
                />
            ))}
            {rest.length > 0 && <MoreBadges badges={rest} size={size} />}
        </span>
    );
}

/** «+N» на телефоні: список решти значків з описами; дотик — перехід у розділ. */
function MoreBadges({
    badges,
    size,
}: {
    badges: AffiliationBadge[];
    size: number;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={tr('Усі значки')}
                className="inline-flex items-center justify-center rounded-md bg-sky-500/15 px-1.5 text-[11px] font-bold text-sky-400 tabular-nums focus-visible:outline-2 focus-visible:outline-sky-400 sm:hidden"
                style={{ height: size, minWidth: size }}
            >
                +{badges.length}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="w-72 rounded-2xl border-0 bg-[var(--gc-l2)] p-1.5 text-white"
            >
                {badges.map((badge) => {
                    const look = KIND[badge.kind] ?? KIND.game;
                    const row = (
                        <span className="flex w-full items-start gap-3">
                            <Logo badge={badge} size={32} />
                            <span className="min-w-0 flex-1">
                                <span className="block text-[11px] text-white/50">
                                    {look.label()}
                                    {badge.role ? ` · ${badge.role}` : ''}
                                </span>
                                <span className="block text-sm leading-snug font-semibold break-words">
                                    {badge.name}
                                </span>
                                {badge.lines.map((line) => (
                                    <span
                                        key={line}
                                        className="block text-xs text-white/60 tabular-nums"
                                    >
                                        {line}
                                    </span>
                                ))}
                            </span>
                        </span>
                    );

                    return (
                        <DropdownMenuItem
                            key={`${badge.kind}-${badge.href}-${badge.name}`}
                            asChild
                            className="rounded-xl p-2 focus:bg-[var(--gc-l3)]"
                        >
                            {badge.href === '' ? (
                                <span>{row}</span>
                            ) : /^https?:\/\//.test(badge.href) ? (
                                <a
                                    href={badge.href}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {row}
                                </a>
                            ) : (
                                <Link href={badge.href}>{row}</Link>
                            )}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Один значок із карткою при наведенні. */
function BadgeTip({
    badge,
    size,
    className,
}: {
    badge: AffiliationBadge;
    size: number;
    className?: string;
}) {
    const look = KIND[badge.kind] ?? KIND.game;
    const external = /^https?:\/\//.test(badge.href);
    const trigger = <Logo badge={badge} size={size} />;
    const ring =
        'inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-sky-400';

    return (
        <TooltipPrimitive.Root delayDuration={120}>
            <TooltipPrimitive.Trigger asChild>
                {badge.href === '' ? (
                    <span
                        tabIndex={0}
                        aria-label={badge.name}
                        className={cn(ring, className)}
                    >
                        {trigger}
                    </span>
                ) : external ? (
                    <a
                        href={badge.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={badge.name}
                        className={cn(ring, className)}
                    >
                        {trigger}
                    </a>
                ) : (
                    <Link
                        href={badge.href}
                        aria-label={badge.name}
                        className={cn(ring, className)}
                    >
                        {trigger}
                    </Link>
                )}
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                    side="top"
                    sideOffset={6}
                    collisionPadding={12}
                    className="z-50 w-64 rounded-2xl bg-[var(--gc-l2)] p-3 text-left text-white"
                >
                    <span className="flex items-center gap-3">
                        <Logo badge={badge} size={40} />
                        <span className="min-w-0 flex-1">
                            <span className="block text-[11px] text-white/50">
                                {look.label()}
                            </span>
                            <span className="block text-sm leading-snug font-bold break-words">
                                {badge.name}
                                {badge.tag &&
                                badge.kind !== 'game' &&
                                !badge.name.includes(badge.tag)
                                    ? ` [${badge.tag}]`
                                    : ''}
                            </span>
                        </span>
                    </span>
                    {badge.role && (
                        <span className="mt-2 inline-flex rounded-lg bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-400">
                            {badge.role}
                        </span>
                    )}
                    {badge.lines.length > 0 && (
                        <span className="mt-2 block space-y-0.5 text-xs text-white/65 tabular-nums">
                            {badge.lines.map((line) => (
                                <span key={line} className="block">
                                    {line}
                                </span>
                            ))}
                        </span>
                    )}
                    <TooltipPrimitive.Arrow className="fill-[var(--gc-l2)]" />
                </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
    );
}

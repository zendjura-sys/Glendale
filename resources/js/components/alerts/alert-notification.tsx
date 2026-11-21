import { Link } from '@inertiajs/react';
import {
    Biohazard,
    Bomb,
    Info,
    Radiation,
    ShieldCheck,
    Siren,
    Swords,
} from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

const ICONS = {
    AIR: Siren,
    ARTILLERY: Bomb,
    URBAN_FIGHTS: Swords,
    CHEMICAL: Biohazard,
    NUCLEAR: Radiation,
    INFO: Info,
} as const;

/**
 * Картка тривоги в сповіщеннях — колір за правилами оповіщення: повітряна червона (ракети) чи жовта (БпЛА),
 * артобстріл помаранчевий, вуличні бої салатові, хімічна фіолетова, радіаційна жовта з чорними смугами;
 * відбій — смарагдовий. «Я в укритті» ставить статус, який бачать друзі й клан.
 */
export function AlertNotification({
    item,
    onOpen,
}: {
    item: NotificationItem;
    onOpen?: () => void;
}) {
    const alert = item.alert!;
    const [sheltered, setSheltered] = useState(false);
    const red = alert.severity === 'red' && !alert.ended;
    const accent =
        alert.accent ?? (alert.ended ? '#10B981' : red ? '#EF4444' : '#F59E0B');
    const Icon = alert.ended
        ? ShieldCheck
        : (ICONS[alert.type as keyof typeof ICONS] ?? Siren);
    const tint = (alpha: number) =>
        `color-mix(in srgb, ${accent} ${alpha}%, transparent)`;
    const stripes: CSSProperties | undefined = alert.striped
        ? {
              backgroundImage: `repeating-linear-gradient(45deg, ${tint(22)} 0 6px, rgb(0 0 0 / 0.35) 6px 12px)`,
          }
        : undefined;
    const shelter = () =>
        api('PUT', '/alerts/preferences', { shelter: true })
            .then(() => {
                setSheltered(true);
                toast.success(tr('Статус «В укритті» видно друзям і родині.'));
            })
            .catch((e: Error) => toast.error(e.message));

    return (
        <div
            className="relative overflow-hidden rounded-xl px-2.5 py-2.5"
            style={{ background: tint(alert.ended ? 8 : 12) }}
        >
            <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-0.5 rounded-full"
                style={{ background: accent }}
            />
            <Link
                href={item.url ?? '/alerts'}
                onClick={onOpen}
                className="flex gap-3"
            >
                <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full"
                    style={{ background: tint(22), color: accent, ...stripes }}
                >
                    <Icon
                        className={cn(
                            'size-5',
                            red && 'motion-safe:animate-pulse',
                        )}
                    />
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug break-words">
                    <span
                        className="block text-[11px] font-semibold"
                        style={{ color: accent }}
                    >
                        {alert.ended
                            ? tr('Відбій')
                            : red
                              ? tr('Небезпека · в укриття')
                              : tr('Увага · підвищена небезпека')}
                    </span>
                    <span className="font-semibold text-white">
                        {item.text}
                    </span>
                    {item.excerpt && (
                        <span className="mt-0.5 block text-xs text-white/55">
                            {item.excerpt}
                        </span>
                    )}
                    <span className="mt-1 block text-xs text-white/40">
                        {timeAgo(item.created_at)}
                    </span>
                </span>
            </Link>
            {!alert.ended && (
                <button
                    type="button"
                    onClick={shelter}
                    disabled={sheltered}
                    className={cn(
                        'mt-2 ml-14 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition',
                        sheltered
                            ? 'bg-[#10B981]/20 text-emerald-200'
                            : 'bg-white/10 text-white hover:bg-white/15',
                    )}
                >
                    <ShieldCheck className="size-3.5" />
                    {sheltered ? tr('Ви в укритті') : tr('Я в укритті (AFK)')}
                </button>
            )}
        </div>
    );
}

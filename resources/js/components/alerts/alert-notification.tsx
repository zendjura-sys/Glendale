import { Link } from '@inertiajs/react';
import { ShieldCheck, Siren, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';

/**
 * Картка тривоги в сповіщеннях: червона — негайно в укриття, жовта — увага, підвищена небезпека;
 * відбій — спокійний зелений. Кнопка «Я в укритті» ставить статус, який бачать друзі й клан.
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
    // 🔴 #EF4444 — в укриття, 🟡 #F59E0B — увага, 🟢 #10B981 — відбій.
    const red = alert.severity === 'red' && !alert.ended;
    const Icon = alert.ended ? ShieldCheck : red ? Siren : TriangleAlert;
    const shelter = () =>
        api('PUT', '/alerts/preferences', { shelter: true })
            .then(() => {
                setSheltered(true);
                toast.success(tr('Статус «В укритті» видно друзям і родині.'));
            })
            .catch((e: Error) => toast.error(e.message));

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-xl px-2.5 py-2.5',
                alert.ended
                    ? 'bg-[#10B981]/[0.08]'
                    : red
                      ? 'bg-[#EF4444]/[0.12]'
                      : 'bg-[#F59E0B]/[0.10]',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'absolute inset-y-2 left-0 w-0.5 rounded-full',
                    alert.ended
                        ? 'bg-[#10B981]'
                        : red
                          ? 'bg-[#EF4444]'
                          : 'bg-[#F59E0B]',
                )}
            />
            <Link
                href={item.url ?? '/alerts'}
                onClick={onOpen}
                className="flex gap-3"
            >
                <span
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-full',
                        alert.ended
                            ? 'bg-[#10B981]/20 text-[#10B981]'
                            : red
                              ? 'bg-[#EF4444]/25 text-[#EF4444]'
                              : 'bg-[#F59E0B]/20 text-[#F59E0B]',
                    )}
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
                        className={cn(
                            'block text-[11px] font-semibold',
                            alert.ended
                                ? 'text-[#10B981]'
                                : red
                                  ? 'text-[#EF4444]'
                                  : 'text-[#F59E0B]',
                        )}
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
                            ? 'bg-emerald-500/20 text-emerald-200'
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

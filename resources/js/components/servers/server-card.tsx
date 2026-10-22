import { Link } from '@inertiajs/react';
import {
    Check,
    Copy,
    Crown,
    Globe,
    MessageCircle,
    Monitor,
    Send,
    Smartphone,
    Sparkles,
    Vote,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GtaServerCard } from '@/types';
import { OnlineMeter, ServerIcon } from './server-icon';
import { shortNumber } from '@/lib/format';
import { LOCALE, tr } from '@/lib/i18n';

/** Перехід для аналітики власника (без очікування відповіді). */
export function trackServerClick(slug: string | undefined, kind: string) {
    if (!slug) return;
    void api('POST', `/servers/${slug}/click`, { kind }).catch(() => undefined);
}

export function ConnectButton({
    value,
    slug,
}: {
    value: string;
    slug?: string;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            onClick={(event) => {
                event.preventDefault();
                trackServerClick(slug, 'connect');
                void navigator.clipboard?.writeText(value).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                });
            }}
            className="group/copy inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 font-mono text-xs text-white/60 ring-1 ring-white/[0.06] transition hover:text-white"
            title={tr('Скопіювати адресу підключення')}
        >
            {copied ? (
                <Check className="size-3 shrink-0 text-emerald-300" />
            ) : (
                <Copy className="size-3 shrink-0" />
            )}
            <span className="truncate">{value}</span>
        </button>
    );
}

export function ServerLinks({
    server,
    className,
}: {
    server: Pick<GtaServerCard, 'website' | 'discord' | 'telegram'> & {
        slug?: string;
    };
    className?: string;
}) {
    const links = [
        {
            href: server.website,
            icon: Globe,
            label: tr('Сайт'),
            kind: 'website',
        },
        {
            href: server.discord,
            icon: MessageCircle,
            label: 'Discord',
            kind: 'discord',
        },
        {
            href: server.telegram,
            icon: Send,
            label: 'Telegram',
            kind: 'telegram',
        },
    ].filter((link) => link.href);

    return (
        <div className={cn('flex gap-1.5', className)}>
            {links.map(({ href, icon: Icon, label, kind }) => (
                <a
                    key={label}
                    href={href!}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(event) => {
                        event.stopPropagation();
                        trackServerClick(server.slug, kind);
                    }}
                    title={label}
                    className="flex size-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 ring-1 ring-white/[0.06] transition hover:bg-white/10 hover:text-white"
                >
                    <Icon className="size-4" />
                </a>
            ))}
        </div>
    );
}

export function ServerCard({
    server,
    index = 0,
}: {
    server: GtaServerCard;
    index?: number;
}) {
    const PlatformIcon = server.platform === 'pc' ? Monitor : Smartphone;

    return (
        <Link
            href={`/servers/${server.slug}`}
            className={cn(
                'glass group relative flex animate-rise flex-col gap-4 overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-white/15',
                server.is_featured &&
                    'shadow-[0_20px_60px_-30px_rgb(124_92_255/0.9)] ring-1 ring-gc-lilac-500/30',
                server.promo?.includes('highlight') &&
                    'border-indigo-400/50 ring-1 ring-indigo-400/40',
            )}
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
        >
            <div className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full bg-gc-indigo/15 blur-3xl transition group-hover:bg-gc-indigo/30" />
            <div className="relative flex items-start gap-3.5">
                <ServerIcon
                    name={server.name}
                    icon={server.icon}
                    className="size-14"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h3 className="truncate font-display text-[17px] font-bold text-white">
                            {server.name}
                        </h3>
                        {server.is_featured && (
                            <Sparkles className="size-4 shrink-0 text-amber-300" />
                        )}
                        {(server.promo?.includes('top') ||
                            server.promo?.includes('highlight')) && (
                            <span
                                title={tr('Платне просування')}
                                className="ml-auto shrink-0 rounded-chip bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/55"
                            >
                                {tr('Реклама')}
                            </span>
                        )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium">
                        <span className="inline-flex items-center gap-1 rounded-chip bg-white/[0.06] px-2 py-0.5 text-white/65">
                            <PlatformIcon className="size-3" />
                            {server.platform_label}
                        </span>
                        <span className="rounded-chip bg-gc-indigo/15 px-2 py-0.5 text-[#b9b0ff]">
                            {server.multiplayer_label}
                        </span>
                        <span className="rounded-chip bg-[#facc15]/10 px-2 py-0.5 text-[#fde68a]">
                            {server.language === 'uk'
                                ? '🇺🇦 UA'
                                : server.language.toUpperCase()}
                        </span>
                        {(server.votes_month ?? 0) > 0 && (
                            <span
                                title={tr('Голосів за місяць')}
                                className="inline-flex items-center gap-1 rounded-chip bg-emerald-400/10 px-2 py-0.5 text-emerald-200"
                            >
                                <Vote className="size-3" />
                                {shortNumber(server.votes_month ?? 0)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {server.tagline && (
                <p className="relative line-clamp-2 text-[13px] leading-relaxed text-white/55">
                    {server.tagline}
                </p>
            )}

            <div className="relative mt-auto space-y-3">
                <OnlineMeter
                    online={server.players_online}
                    max={server.players_max}
                />
                {server.players_online === null &&
                    server.discord_members !== null && (
                        <div className="text-xs text-white/50">
                            <span className="font-semibold text-gc-sky">
                                {server.discord_members.toLocaleString(LOCALE)}
                            </span>{' '}
                            {tr('у Discord')}
                            {server.discord_online !== null &&
                                tr(' · {toLocaleString} в мережі', {
                                    toLocaleString:
                                        server.discord_online.toLocaleString(
                                            LOCALE,
                                        ),
                                })}
                        </div>
                    )}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        {server.connect ? (
                            <ConnectButton
                                value={server.connect}
                                slug={server.slug}
                            />
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-white/40">
                                <Crown className="size-3.5" />
                                {server.families_count} {tr('сімей')}
                            </span>
                        )}
                    </div>
                    <ServerLinks server={server} />
                </div>
            </div>
        </Link>
    );
}

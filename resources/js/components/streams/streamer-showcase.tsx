import { CalendarClock, ExternalLink, Radio } from 'lucide-react';
import type { AccountCardData } from '@/components/profile/account-card';
import type { StreamSlot } from '@/components/profile/stream-schedule';
import type { StreamInfo } from '@/components/streams/stream';
import { shortNumber } from '@/lib/format';
import { LOCALE, tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const CHANNELS = [
    { key: 'twitch', label: 'Twitch' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'kick', label: 'Kick' },
] as const;

/** Посилання з поля акаунта: повна адреса або нік на платформі. */
function channelUrl(key: string, value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    const handle = value.replace(/^@/, '');
    return key === 'twitch'
        ? `https://twitch.tv/${handle}`
        : key === 'youtube'
          ? `https://youtube.com/@${handle}`
          : `https://kick.com/${handle}`;
}

function nextSlot(slots: StreamSlot[] | null | undefined): StreamSlot | null {
    const list = Array.isArray(slots) ? slots : [];
    return (
        [...list].sort((a, b) => a.next_at.localeCompare(b.next_at))[0] ?? null
    );
}

/**
 * Вітрина стрімера вгорі профілю: в ефірі — великий плеєр, назва й глядачі; поза ефіром —
 * найближчий стрім за розкладом. Під ними — канали (Twitch, YouTube, Kick).
 */
export function StreamerShowcase({
    stream,
    account,
    schedule,
}: {
    stream: StreamInfo | null;
    account: AccountCardData;
    schedule?: StreamSlot[] | null;
}) {
    const live = !!stream?.live;
    const next = live ? null : nextSlot(schedule);
    const channels = CHANNELS.flatMap(({ key, label }) => {
        const value = account.details?.[key]?.value;
        if (value) return [{ key, label, url: channelUrl(key, value) }];
        if (stream?.platform === key) return [{ key, label, url: stream.url }];
        return [];
    });

    if (!stream && !next && channels.length === 0) return null;

    return (
        <section
            className={cn('gc-streamer-showcase', live && 'is-live')}
            aria-label={tr('Вітрина стрімера')}
        >
            <span className="gc-live-badge">
                <span
                    className={cn(
                        'gc-live-badge__pill',
                        live ? 'gc-live-badge--alert' : 'gc-live-badge--accent',
                    )}
                >
                    {live && (
                        <span className="gc-live-badge__dot" aria-hidden />
                    )}
                    {live ? 'LIVE' : tr('Стрімер')}
                </span>
            </span>

            {live && stream?.embed && (
                <div className="gc-streamer-showcase__player">
                    <iframe
                        src={stream.embed}
                        title={stream.title ?? stream.channel}
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                    />
                </div>
            )}

            <div className="gc-streamer-showcase__info">
                <span className="gc-streamer-showcase__icon" aria-hidden>
                    {live ? (
                        <Radio className="size-5" />
                    ) : (
                        <CalendarClock className="size-5" />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="gc-streamer-showcase__title truncate text-[15px] font-semibold text-[var(--gc-text)]">
                        {live
                            ? (stream?.title ?? tr('Зараз в ефірі'))
                            : next
                              ? tr('Наступний стрім · {when}', {
                                    when: new Date(next.next_at).toLocaleString(
                                        LOCALE,
                                        {
                                            weekday: 'long',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        },
                                    ),
                                })
                              : tr('Зараз не в ефірі')}
                    </p>
                    <p className="text-[13px] text-pretty text-[var(--gc-text-2)]">
                        {live
                            ? [
                                  stream?.platform_label,
                                  stream?.game,
                                  stream?.viewers != null
                                      ? tr('{n} глядачів', {
                                            n: shortNumber(stream.viewers),
                                        })
                                      : null,
                              ]
                                  .filter(Boolean)
                                  .join(' · ')
                            : (next?.title ??
                              tr(
                                  'Підпишіться на канал, щоб не пропустити ефір',
                              ))}
                    </p>
                </div>
            </div>

            {channels.length > 0 && (
                <div className="gc-streamer-showcase__channels">
                    {channels.map((channel) => (
                        <a
                            key={channel.key}
                            href={channel.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className={cn(
                                'gc-streamer-channel',
                                `is-${channel.key}`,
                            )}
                        >
                            {channel.label}
                            <ExternalLink className="size-3.5 opacity-60" />
                        </a>
                    ))}
                </div>
            )}
        </section>
    );
}

import { Link } from '@inertiajs/react';
import {
    Briefcase,
    Gamepad2,
    Newspaper,
    PenLine,
    Radio,
    Store,
    Trophy,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type AccountCardData = {
    type: string;
    label: string;
    icon: string;
    details: Record<string, { label: string; value: string }>;
    roster: (UserCard & { role: string | null })[] | null;
    member_of: (UserCard & { role: string | null })[];
};

export const ACCOUNT_ICONS: Record<string, LucideIcon> = {
    'user-round': UserRound,
    radio: Radio,
    'pen-line': PenLine,
    store: Store,
    briefcase: Briefcase,
    trophy: Trophy,
    'gamepad-2': Gamepad2,
    newspaper: Newspaper,
};

const LINKS = ['website', 'twitch', 'youtube', 'kick'];

/** Спеціальний акаунт на сторінці: тип, поля, склад і де людина сама в складі. */
export function AccountCard({ data }: { data: AccountCardData }) {
    const Icon = ACCOUNT_ICONS[data.icon] ?? UserRound;
    const details = Object.entries(data.details);

    return (
        <Widget title={data.type === 'personal' ? tr('У складі') : data.label}>
            <div className="space-y-3 px-1">
                {data.type !== 'personal' && details.length > 0 && (
                    <dl className="space-y-1.5 text-sm">
                        {details.map(([key, item]) => (
                            <div key={key} className="flex gap-2">
                                <dt className="w-28 shrink-0 text-white/45">
                                    {item.label}
                                </dt>
                                <dd className="min-w-0 break-words text-white/85">
                                    {LINKS.includes(key) ? (
                                        <a
                                            href={item.value}
                                            target="_blank"
                                            rel="noopener noreferrer nofollow"
                                            className="text-gc-lilac-300 hover:underline"
                                        >
                                            {item.value.replace(
                                                /^https?:\/\/(www\.)?/,
                                                '',
                                            )}
                                        </a>
                                    ) : key === 'email' ? (
                                        <a
                                            href={`mailto:${item.value}`}
                                            className="text-gc-lilac-300 hover:underline"
                                        >
                                            {item.value}
                                        </a>
                                    ) : (
                                        item.value
                                    )}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
                {data.roster && data.roster.length > 0 && (
                    <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-white/45">
                            <Icon className="size-3.5" />
                            {tr('Склад · {count}', {
                                count: data.roster.length,
                            })}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {data.roster.slice(0, 12).map((person) => (
                                <Link
                                    key={person.id}
                                    href={`/${person.username}`}
                                    title={[person.name, person.role]
                                        .filter(Boolean)
                                        .join(' · ')}
                                >
                                    <UserAvatar user={person} size="sm" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
                {data.member_of.length > 0 && (
                    <div className="space-y-1.5">
                        {data.type !== 'personal' && (
                            <p className="text-xs text-white/45">
                                {tr('У складі')}
                            </p>
                        )}
                        {data.member_of.map((org) => (
                            <Link
                                key={org.id}
                                href={`/${org.username}`}
                                className="flex items-center gap-2 text-sm text-white/85 hover:text-white"
                            >
                                <UserAvatar user={org} size="xs" />
                                <span className="truncate">{org.name}</span>
                                {org.role && (
                                    <span className="truncate text-xs text-white/45">
                                        · {org.role}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </Widget>
    );
}

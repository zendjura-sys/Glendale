import { ImagePlus, Lock, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type TicketCard = {
    id: number;
    subject: string;
    category: string;
    category_label: string;
    status: 'open' | 'answered' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    unread: boolean;
    rating: number | null;
    created_at: string;
    updated_at: string;
    user: {
        id: number;
        name: string;
        username: string;
        avatar_url: string | null;
    } | null;
    assignee: {
        id: number;
        name: string;
        username: string;
        avatar_url: string | null;
    } | null;
};

export type TicketMessage = {
    id: number;
    body: string;
    from_staff: boolean;
    internal: boolean;
    author: {
        id: number;
        name: string;
        username: string;
        avatar_url: string | null;
    } | null;
    files: string[];
    created_at: string;
};

const STATUS: Record<
    TicketCard['status'],
    { label: () => string; className: string }
> = {
    open: {
        label: () => tr('Чекає відповіді'),
        className: 'bg-amber-400/15 text-amber-200',
    },
    answered: {
        label: () => tr('Є відповідь'),
        className: 'bg-emerald-400/15 text-emerald-200',
    },
    closed: {
        label: () => tr('Закрито'),
        className: 'bg-white/[0.07] text-white/55',
    },
};

export function StatusPill({
    status,
    staff = false,
}: {
    status: TicketCard['status'];
    staff?: boolean;
}) {
    const s = STATUS[status];
    const label = staff
        ? {
              open: tr('Нове / чекає нас'),
              answered: tr('Чекає людину'),
              closed: tr('Закрито'),
          }[status]
        : s.label();

    return (
        <span
            className={cn(
                'inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium',
                s.className,
            )}
        >
            {label}
        </span>
    );
}

/** Листування звернення: людина праворуч, підтримка ліворуч, нотатки персоналу — жовті. */
export function Thread({
    messages,
    mineIsStaff,
}: {
    messages: TicketMessage[];
    mineIsStaff: boolean;
}) {
    const end = useRef<HTMLDivElement>(null);
    useEffect(
        () => end.current?.scrollIntoView({ block: 'end' }),
        [messages.length],
    );

    return (
        <div className="space-y-3">
            {messages.map((m) => {
                const mine =
                    m.from_staff === mineIsStaff && !(m.author === null);

                return (
                    <div
                        key={m.id}
                        className={cn(
                            'flex gap-2.5',
                            mine && 'flex-row-reverse',
                        )}
                    >
                        {m.author ? (
                            <UserAvatar
                                user={m.author}
                                size="sm"
                                showOnline={false}
                            />
                        ) : (
                            <img
                                src="/images/brand/logo-mark.png"
                                alt=""
                                className="size-9 shrink-0"
                            />
                        )}
                        <div
                            className={cn(
                                'max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5',
                                m.internal
                                    ? 'bg-amber-400/12 ring-1 ring-amber-300/25'
                                    : mine
                                      ? 'bg-gc-indigo/25'
                                      : 'bg-white/[0.06]',
                            )}
                        >
                            <p className="flex flex-wrap items-center gap-x-2 text-xs text-white/50">
                                <span className="font-medium text-white/75">
                                    {m.author
                                        ? m.author.name
                                        : tr('Підтримка GameCon')}
                                </span>
                                {m.from_staff && m.author && !mineIsStaff && (
                                    <span>{tr('підтримка')}</span>
                                )}
                                {m.internal && (
                                    <span className="inline-flex items-center gap-1 text-amber-200">
                                        <Lock className="size-3" />
                                        {tr('нотатка, людина не бачить')}
                                    </span>
                                )}
                                <span>{formatDate(m.created_at)}</span>
                            </p>
                            <p className="mt-1 text-sm break-words whitespace-pre-line text-white/90">
                                {m.body}
                            </p>
                            {m.files.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {m.files.map((url) => (
                                        <a
                                            key={url}
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <img
                                                src={url}
                                                alt=""
                                                className="size-24 rounded-xl object-cover"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={end} />
        </div>
    );
}

/** Вибір до трьох знімків екрана з прев’ю. */
export function ScreenshotPicker({
    files,
    onChange,
}: {
    files: File[];
    onChange: (files: File[]) => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const previews = useMemo(
        () => files.map((f) => URL.createObjectURL(f)),
        [files],
    );
    useEffect(
        () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
        [previews],
    );

    return (
        <div className="flex flex-wrap items-center gap-2">
            {previews.map((url, i) => (
                <span key={url} className="relative">
                    <img
                        src={url}
                        alt=""
                        className="size-14 rounded-xl object-cover"
                    />
                    <button
                        type="button"
                        onClick={() =>
                            onChange(files.filter((_, j) => j !== i))
                        }
                        aria-label={tr('Прибрати')}
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                        <X className="size-3" />
                    </button>
                </span>
            ))}
            {files.length < 3 && (
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm text-white/70 hover:text-white"
                >
                    <ImagePlus className="size-4" />
                    {tr('Знімок екрана')}
                </button>
            )}
            <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => {
                    onChange(
                        [...files, ...Array.from(e.target.files ?? [])].slice(
                            0,
                            3,
                        ),
                    );
                    e.target.value = '';
                }}
            />
        </div>
    );
}

import { Link, router, usePage } from '@inertiajs/react';
import { History, TrendingUp, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CommunityCard, UserCard } from '@/types';
import { CommunityAvatar } from './community-avatar';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';
import { tr } from '@/lib/i18n';

type Hit = { kind: string; title: string; hint: string; href: string };

type Result =
    | { kind: 'user'; href: string; item: UserCard }
    | { kind: 'community'; href: string; item: CommunityCard }
    | { kind: 'hit'; href: string; item: Hit };

/** Чи вміщається повна підказка пошуку (на вузькому екрані — коротка, без обрізання). */
function useWideSearch(): boolean {
    const [wide, setWide] = useState(
        () =>
            typeof window === 'undefined' ||
            window.matchMedia('(min-width: 640px)').matches,
    );
    useEffect(() => {
        const media = window.matchMedia('(min-width: 640px)');
        const update = () => setWide(media.matches);
        media.addEventListener('change', update);

        return () => media.removeEventListener('change', update);
    }, []);

    return wide;
}

export function QuickSearch({ className }: { className?: string }) {
    const wide = useWideSearch();
    // Підказка — лише про розділи режиму людини: у «Класиці» немає ігор, кіно й серверів.
    const { modules } = usePage().props;
    const scope = [
        tr('людей'),
        modules.includes('games') && tr('ігор'),
        modules.includes('cinema') && tr('кіно'),
        modules.includes('music') && tr('музики'),
        modules.includes('servers') && tr('серверів'),
        modules.includes('communities') && tr('спільнот'),
    ].filter(Boolean);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [recent, setRecent] = useState<string[]>([]);
    const [popular, setPopular] = useState<Hit[]>([]);
    const [trending, setTrending] = useState<string[]>([]);
    const [suggest, setSuggest] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        };
        const onClick = (event: MouseEvent) => {
            if (!boxRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', onKey);
        window.addEventListener('mousedown', onClick);

        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mousedown', onClick);
        };
    }, []);

    // Прибрати один запит з історії (або всю історію без аргументу).
    const forget = (value?: string) =>
        api<{ recent: string[] }>(
            'DELETE',
            '/search/recent',
            value ? { q: value } : {},
        )
            .then((response) => setRecent(response.recent))
            .catch(() => undefined);

    const remember = (value: string) => {
        const text = value.trim();
        if (text.length < 2) {
            return;
        }
        api<{ recent: string[] }>('POST', '/search/recent', { q: text })
            .then((response) => setRecent(response.recent))
            .catch(() => undefined);
    };

    useEffect(() => {
        if (!open || query.trim().length >= 2) {
            return;
        }
        api<{ recent?: string[]; popular?: Hit[]; trending?: string[] }>(
            'GET',
            '/search/quick?q=',
        )
            .then((response) => {
                setRecent(response.recent ?? []);
                setPopular(response.popular ?? []);
                setTrending(response.trending ?? []);
            })
            .catch(() => {
                setRecent([]);
                setPopular([]);
            });
    }, [open, query]);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);

            return;
        }

        const timer = setTimeout(() => {
            api<{
                users: UserCard[];
                communities: CommunityCard[];
                hits?: Hit[];
                suggest?: string[];
            }>('GET', `/search/quick?q=${encodeURIComponent(query.trim())}`)
                .then((response) => {
                    setSuggest(response.suggest ?? []);
                    const hits = response.hits ?? [];
                    setResults(
                        hits.length > 0
                            ? hits.map((item) => ({
                                  kind: 'hit' as const,
                                  href: item.href,
                                  item,
                              }))
                            : [
                                  ...response.users.map((item) => ({
                                      kind: 'user' as const,
                                      href: `/${item.username}`,
                                      item,
                                  })),
                                  ...(response.communities ?? []).map(
                                      (item) => ({
                                          kind: 'community' as const,
                                          href: `/c/${item.slug}`,
                                          item,
                                      }),
                                  ),
                              ],
                    );
                    setActive(0);
                })
                .catch(() => setResults([]));
        }, 180);

        return () => clearTimeout(timer);
    }, [query]);

    const submit = () => {
        const target = results[active];
        setOpen(false);

        remember(query);
        if (target) {
            router.visit(target.href);
        } else if (query.trim()) {
            router.visit(`/people?q=${encodeURIComponent(query.trim())}`);
        }
    };

    return (
        <div
            ref={boxRef}
            data-quick-search
            className={cn('relative min-w-0', className)}
        >
            <label className="ios-glass-panel ios-header-search">
                <Search className="size-4 text-white/45" />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            setActive((value) =>
                                Math.min(value + 1, results.length - 1),
                            );
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            setActive((value) => Math.max(value - 1, 0));
                        } else if (event.key === 'Enter') {
                            submit();
                        } else if (event.key === 'Escape') {
                            setOpen(false);
                            inputRef.current?.blur();
                        }
                    }}
                    placeholder={
                        wide
                            ? tr('Пошук: {scope}…', {
                                  scope: scope.slice(0, 4).join(', '),
                              })
                            : tr('Пошук')
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
                {query ? (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="text-white/40 hover:text-white"
                    >
                        <X className="size-4" />
                    </button>
                ) : (
                    <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-xs font-medium text-white/45 md:inline">
                        Ctrl K
                    </kbd>
                )}
            </label>

            {open &&
                query.trim().length < 2 &&
                (recent.length > 0 ||
                    popular.length > 0 ||
                    trending.length > 0) && (
                    <div className="glass-strong absolute top-12 right-0 left-0 z-50 animate-rise overflow-hidden rounded-2xl p-1.5 sm:right-auto sm:w-[max(100%,360px)]">
                        {recent.length > 0 && (
                            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-xs whitespace-nowrap text-white/40">
                                {tr('Недавні запити')}
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => void forget()}
                                    className="font-medium text-white/50 hover:text-white"
                                >
                                    {tr('Очистити')}
                                </button>
                            </div>
                        )}
                        {recent.map((item) => (
                            <div
                                key={item}
                                className="group flex items-center rounded-xl hover:bg-white/5"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery(item);
                                        setOpen(true);
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm text-white/80"
                                >
                                    <History className="size-4 shrink-0 text-white/35" />
                                    <span className="truncate">{item}</span>
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => void forget(item)}
                                    aria-label={tr('Прибрати з історії')}
                                    className="mr-1 grid size-7 place-items-center rounded-lg text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-white focus:opacity-100"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        ))}
                        {trending.length > 0 && (
                            <>
                                <p className="px-2.5 py-1.5 text-xs text-white/40">
                                    {tr('Часто шукають')}
                                </p>
                                <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
                                    {trending.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => {
                                                setQuery(item);
                                                setOpen(true);
                                            }}
                                            className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-white/[0.06] px-3 text-sm whitespace-nowrap text-white/80 hover:bg-white/[0.1] hover:text-white"
                                        >
                                            <TrendingUp className="size-3.5 text-primary" />
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                        {popular.length > 0 && (
                            <p className="px-2.5 py-1.5 text-xs text-white/40">
                                {tr('Зараз популярне')}
                            </p>
                        )}
                        {popular.map((item) => (
                            <Link
                                key={`${item.kind}-${item.href}`}
                                href={item.href}
                                className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                            >
                                <span className="truncate">{item.title}</span>
                                <span className="shrink-0 text-xs text-white/40">
                                    {tr(item.hint)}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}

            {open && query.trim().length >= 2 && (
                <div className="glass-strong absolute top-12 right-0 left-0 z-50 animate-rise overflow-hidden rounded-2xl p-1.5 sm:right-auto sm:w-[max(100%,360px)]">
                    {suggest.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-1.5 pt-1 pb-2">
                            {suggest.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setQuery(item)}
                                    className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs whitespace-nowrap text-white/75 hover:bg-white/[0.1] hover:text-white"
                                >
                                    <Search className="size-3" />
                                    {item}
                                </button>
                            ))}
                        </div>
                    )}
                    {results.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-white/50">
                            {tr('Нікого не знайдено')}
                        </div>
                    ) : (
                        results.map((result, index) => (
                            <Link
                                key={`${result.kind}-${result.href}`}
                                href={result.href}
                                onClick={() => {
                                    remember(query);
                                    setOpen(false);
                                }}
                                onMouseEnter={() => setActive(index)}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl px-2.5 py-2 transition',
                                    index === active
                                        ? 'bg-white/[0.07]'
                                        : 'hover:bg-white/5',
                                )}
                            >
                                {result.kind === 'user' ? (
                                    <UserAvatar user={result.item} size="sm" />
                                ) : result.kind === 'community' ? (
                                    <CommunityAvatar
                                        community={result.item}
                                        size="sm"
                                    />
                                ) : (
                                    <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 uppercase">
                                        {result.item.kind.slice(0, 2)}
                                    </span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1 truncate text-sm font-medium text-white">
                                        {result.kind === 'hit'
                                            ? result.item.title
                                            : result.item.name}
                                        {result.kind !== 'hit' &&
                                            result.item.is_verified && (
                                                <VerifiedBadge
                                                    kind={
                                                        'verified_kind' in
                                                        result.item
                                                            ? result.item
                                                                  .verified_kind
                                                            : null
                                                    }
                                                    className="size-3.5"
                                                />
                                            )}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        {result.kind === 'hit'
                                            ? result.item.hint
                                            : result.kind === 'user'
                                              ? `@${result.item.username}`
                                              : tr(
                                                    '{v} · {members_count} учасн.',
                                                    {
                                                        v:
                                                            result.item.type ===
                                                            'public'
                                                                ? tr(
                                                                      'Публічна сторінка',
                                                                  )
                                                                : tr(
                                                                      'Спільнота',
                                                                  ),
                                                        members_count:
                                                            result.item
                                                                .members_count,
                                                    },
                                                )}
                                    </span>
                                </span>
                            </Link>
                        ))
                    )}
                    {/* Один пошук на весь сайт: ті самі слова — одразу в розділах. */}
                    <div className="mt-1 flex flex-wrap gap-1.5 px-2 pt-2">
                        {(
                            [
                                ['cinema', '/cinema', tr('у кіно')],
                                ['music', '/music', tr('у музиці')],
                                ['games', '/games', tr('серед ігор')],
                                ['servers', '/servers', tr('серед серверів')],
                                [
                                    'communities',
                                    '/communities',
                                    tr('у спільнотах'),
                                ],
                                ['clans', '/clans', tr('серед кланів')],
                                ['families', '/families', tr('серед сімей')],
                            ] as const
                        )
                            .filter(([module]) => modules.includes(module))
                            .map(([module, base, label]) => (
                                <Link
                                    key={module}
                                    href={`${base}?q=${encodeURIComponent(query.trim())}`}
                                    onClick={() => {
                                        remember(query);
                                        setOpen(false);
                                    }}
                                    className="gc-chip text-xs"
                                >
                                    {tr('«{q}» {where}', {
                                        q: query.trim(),
                                        where: label,
                                    })}
                                </Link>
                            ))}
                    </div>
                    <Link
                        href={`/people?q=${encodeURIComponent(query.trim())}`}
                        onClick={() => {
                            remember(query);
                            setOpen(false);
                        }}
                        className="mt-1 block rounded-xl border-t border-white/5 px-3 py-2.5 text-center text-xs font-medium text-gc-lilac-300 hover:bg-white/5"
                    >
                        {tr('Показати всі результати')}
                    </Link>
                </div>
            )}
        </div>
    );
}

import { Link, router } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';
import { UserAvatar } from './user-avatar';
import { VerifiedBadge } from './verified-badge';

export function QuickSearch({ className }: { className?: string }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserCard[]>([]);
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

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);

            return;
        }

        const timer = setTimeout(() => {
            api<{ users: UserCard[] }>(
                'GET',
                `/search/quick?q=${encodeURIComponent(query.trim())}`,
            )
                .then((response) => {
                    setResults(response.users);
                    setActive(0);
                })
                .catch(() => setResults([]));
        }, 180);

        return () => clearTimeout(timer);
    }, [query]);

    const submit = () => {
        const target = results[active];
        setOpen(false);

        if (target) {
            router.visit(`/${target.username}`);
        } else if (query.trim()) {
            router.visit(`/people?q=${encodeURIComponent(query.trim())}`);
        }
    };

    return (
        <div ref={boxRef} className={cn('relative min-w-0', className)}>
            <label className="input-glass flex h-10 items-center gap-2.5 rounded-xl px-3.5">
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
                    placeholder="Пошук людей…"
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
                    <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] font-medium text-white/45 md:inline">
                        Ctrl K
                    </kbd>
                )}
            </label>

            {open && query.trim().length >= 2 && (
                <div className="glass-strong absolute top-12 right-0 left-0 z-50 animate-rise overflow-hidden rounded-2xl p-1.5">
                    {results.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-white/50">
                            Нікого не знайдено
                        </div>
                    ) : (
                        results.map((user, index) => (
                            <Link
                                key={user.id}
                                href={`/${user.username}`}
                                onClick={() => setOpen(false)}
                                onMouseEnter={() => setActive(index)}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl px-2.5 py-2 transition',
                                    index === active
                                        ? 'bg-white/[0.07]'
                                        : 'hover:bg-white/5',
                                )}
                            >
                                <UserAvatar user={user} size="sm" />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1 truncate text-sm font-medium text-white">
                                        {user.name}
                                        {user.is_verified && (
                                            <VerifiedBadge className="size-3.5" />
                                        )}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        @{user.username}
                                    </span>
                                </span>
                            </Link>
                        ))
                    )}
                    <Link
                        href={`/people?q=${encodeURIComponent(query.trim())}`}
                        onClick={() => setOpen(false)}
                        className="mt-1 block rounded-xl border-t border-white/5 px-3 py-2.5 text-center text-xs font-medium text-[#9aa8ff] hover:bg-white/5"
                    >
                        Показати всі результати
                    </Link>
                </div>
            )}
        </div>
    );
}

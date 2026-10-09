import { Check, Search, UserRoundX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ContactCard } from '@/types';
import { tr } from '@/lib/i18n';

export function useContacts(
    query: string,
    enabled: boolean,
    scope: 'friends' | 'site' = 'friends',
) {
    const [users, setUsers] = useState<ContactCard[] | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const timer = window.setTimeout(() => {
            void api<{ users: ContactCard[] }>(
                'GET',
                `/messages/contacts?scope=${scope}&q=${encodeURIComponent(query.trim())}`,
            ).then((response) => setUsers(response.users));
        }, 180);

        return () => window.clearTimeout(timer);
    }, [query, enabled, scope]);

    return users;
}

export function ContactPicker({
    open,
    multiple,
    selected,
    exclude = [],
    onPick,
}: {
    open: boolean;
    multiple: boolean;
    selected: number[];
    exclude?: number[];
    onPick: (user: ContactCard) => void;
}) {
    const [query, setQuery] = useState('');
    const users = useContacts(query, open)?.filter(
        (user) => !exclude.includes(user.id),
    );

    return (
        <div className="flex min-h-0 flex-col">
            <label className="input-glass mb-2 flex h-10 items-center gap-2 rounded-xl px-3">
                <Search className="size-4 text-white/40" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={tr('Пошук серед друзів')}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                    autoFocus
                />
            </label>
            <div className="-mx-1 max-h-[46vh] min-h-[200px] overflow-y-auto px-1">
                {users === undefined ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-2">
                            <span className="skeleton size-10 rounded-full" />
                            <span className="skeleton h-3 w-1/2 rounded" />
                        </div>
                    ))
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center text-sm text-white/45">
                        <UserRoundX className="mb-2 size-7 text-white/20" />
                        {query
                            ? tr('Нікого не знайдено')
                            : tr('Додайте друзів, щоб почати спілкування')}
                    </div>
                ) : (
                    users.map((user) => {
                        const isSelected = selected.includes(user.id);

                        return (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => onPick(user)}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.05]',
                                    isSelected && 'bg-gc-indigo/10',
                                )}
                            >
                                <UserAvatar
                                    user={user}
                                    size="sm"
                                    className="size-10"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-white">
                                        {user.name}
                                    </span>
                                    <span className="block truncate text-xs text-white/40">
                                        {user.is_online
                                            ? tr('в мережі')
                                            : `@${user.username}`}
                                    </span>
                                </span>
                                {multiple && (
                                    <span
                                        className={cn(
                                            'flex size-5 items-center justify-center rounded-full border transition',
                                            isSelected
                                                ? 'border-transparent bg-gradient-brand'
                                                : 'border-white/25',
                                        )}
                                    >
                                        {isSelected && (
                                            <Check className="size-3 text-white" />
                                        )}
                                    </span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

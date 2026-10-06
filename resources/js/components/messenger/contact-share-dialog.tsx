import { Search, SendHorizonal, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ContactCard } from '@/types';
import { useContacts } from './contact-picker';
import { tr } from '@/lib/i18n';

export function ContactShareDialog({
    open,
    onOpenChange,
    onShare,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onShare: (contact: ContactCard) => void;
}) {
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState<ContactCard | null>(null);
    const site = query.trim().length >= 2;
    const users = useContacts(query, open, site ? 'site' : 'friends');

    const close = (value: boolean) => {
        onOpenChange(value);
        if (!value) {
            setQuery('');
            setPicked(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="glass-strong max-w-md gap-0 border-white/10 p-5">
                <DialogTitle className="font-display text-lg text-white">
                    {tr('Надіслати контакт')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/45">
                    {tr(
                        'Знайдіть будь-кого на GameCon за ім’ям або нікнеймом.',
                    )}
                </DialogDescription>

                <label className="input-glass mt-4 mb-2 flex h-11 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/40" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={tr('Ім’я або @нікнейм')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                        autoFocus
                    />
                </label>
                <p className="mb-1 px-1 text-xs font-semibold tracking-wide text-white/35 uppercase">
                    {site ? tr('Результати по всьому сайту') : tr('Ваші друзі')}
                </p>

                <div className="-mx-1 max-h-[44vh] min-h-[220px] overflow-y-auto px-1">
                    {users === null ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 p-2"
                            >
                                <span className="skeleton size-10 rounded-full" />
                                <span className="skeleton h-3 w-1/2 rounded" />
                            </div>
                        ))
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center py-12 text-center text-sm text-white/45">
                            <UserRoundX className="mb-2 size-7 text-white/20" />
                            {query
                                ? tr('Нікого не знайдено')
                                : tr('Почніть вводити ім’я')}
                        </div>
                    ) : (
                        users.map((user) => (
                            <button
                                key={user.id}
                                type="button"
                                onClick={() => setPicked(user)}
                                onDoubleClick={() => {
                                    onShare(user);
                                    close(false);
                                }}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.05]',
                                    picked?.id === user.id &&
                                        'bg-gc-indigo/15 ring-1 ring-gc-violet-400/40',
                                )}
                            >
                                <UserAvatar
                                    user={user}
                                    size="sm"
                                    className="size-10"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1 truncate text-sm font-medium text-white">
                                        {user.name}
                                        {user.is_verified && <VerifiedBadge />}
                                    </span>
                                    <span className="block truncate text-xs text-white/40">
                                        @{user.username}
                                    </span>
                                </span>
                                {user.is_friend && (
                                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
                                        {tr('друг')}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>

                <button
                    type="button"
                    disabled={!picked}
                    onClick={() => {
                        if (!picked) return;
                        onShare(picked);
                        close(false);
                    }}
                    className="btn-glow mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand text-sm font-semibold text-white transition disabled:opacity-40 disabled:shadow-none"
                >
                    <SendHorizonal className="size-4" />
                    {picked
                        ? tr('Надіслати контакт {first_name}', {
                              first_name: picked.first_name,
                          })
                        : tr('Оберіть людину')}
                </button>
            </DialogContent>
        </Dialog>
    );
}

import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

/** Вибір друга для подарунка чи передачі номера (дарувати можна лише друзям). */
export function FriendSelect({
    friends,
    value,
    onChange,
    className,
}: {
    friends: UserCard[];
    value: number | null;
    onChange: (id: number | null) => void;
    className?: string;
}) {
    if (friends.length === 0) {
        return (
            <p className={cn('text-xs text-white/45', className)}>
                {tr(
                    'Дарувати й передавати номер можна лише друзям — додайте когось у друзі.',
                )}
            </p>
        );
    }

    return (
        <select
            value={value ?? ''}
            onChange={(e) =>
                onChange(e.target.value ? Number(e.target.value) : null)
            }
            aria-label={tr('Друг')}
            className={cn(
                'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary',
                className,
            )}
        >
            <option value="">{tr('Оберіть друга')}</option>
            {friends.map((friend) => (
                <option key={friend.id} value={friend.id}>
                    {friend.name} · @{friend.username}
                </option>
            ))}
        </select>
    );
}

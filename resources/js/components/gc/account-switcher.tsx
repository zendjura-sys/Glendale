import { router } from '@inertiajs/react';
import { Check, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Account = UserCard & { current: boolean };

/** Інші акаунти на цьому пристрої й «Додати акаунт» — у меню людини. */
export function AccountSwitcher({
    variant,
    rowClass,
}: {
    variant: 'menu' | 'row';
    rowClass?: string;
}) {
    const on = usePlugin('account_switcher');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [max, setMax] = useState(5);

    useEffect(() => {
        if (!on) return;
        void api<{ accounts: Account[]; max: number }>(
            'GET',
            '/account/switcher',
        )
            .then((d) => {
                setAccounts(d.accounts);
                setMax(d.max);
            })
            .catch(() => undefined);
    }, [on]);

    if (!on) return null;
    const others = accounts.filter((a) => !a.current);
    const switchTo = (id: number) => router.post(`/account/switcher/${id}`);
    const add = () => router.post('/account/switcher/add');
    const canAdd = accounts.length < max;

    if (variant === 'menu') {
        return (
            <>
                {others.map((a) => (
                    <DropdownMenuItem
                        key={a.id}
                        onSelect={() => switchTo(a.id)}
                        className="rounded-lg focus:bg-white/[0.06]"
                    >
                        <UserAvatar user={a} size="xs" showOnline={false} />
                        <span className="min-w-0 flex-1 truncate">
                            {a.name}
                        </span>
                    </DropdownMenuItem>
                ))}
                {canAdd && (
                    <DropdownMenuItem
                        onSelect={add}
                        className="rounded-lg focus:bg-white/[0.06]"
                    >
                        <UserPlus /> {tr('Додати акаунт')}
                    </DropdownMenuItem>
                )}
            </>
        );
    }

    return (
        <>
            {others.map((a) => (
                <button
                    key={a.id}
                    type="button"
                    onClick={() => switchTo(a.id)}
                    className={cn(rowClass)}
                >
                    <UserAvatar user={a} size="xs" showOnline={false} />
                    <span className="min-w-0 flex-1 truncate text-left">
                        {a.name}
                    </span>
                    {a.current && <Check className="size-4" />}
                </button>
            ))}
            {canAdd && (
                <button type="button" onClick={add} className={cn(rowClass)}>
                    <UserPlus className="size-[19px] text-white/50" />
                    {tr('Додати акаунт')}
                </button>
            )}
        </>
    );
}

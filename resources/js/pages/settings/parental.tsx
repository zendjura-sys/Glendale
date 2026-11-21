import { Head } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Rules = {
    night_from?: string | null;
    night_to?: string | null;
    friends_of_friends?: boolean;
};

type State = {
    teen_mode: { on: boolean; locked: boolean };
    children: {
        id: number;
        status: 'invited' | 'active';
        user: UserCard;
        rules: Rules;
        summary: {
            friends: number;
            new_friends: number;
            communities: number;
            last_seen: string | null;
        } | null;
    }[];
    parents: { id: number; status: 'invited' | 'active'; user: UserCard }[];
};

const card = 'gc-solid rounded-2xl p-4 space-y-3';

/**
 * Батьківський контроль (№227): дорослий запрошує підлітка, той погоджується; правила —
 * нічна пауза й заявки в друзі лише від друзів друзів. Листування батьки не бачать.
 */
export default function Parental(initial: State) {
    const [state, setState] = useState<State>(initial);
    const [username, setUsername] = useState('');
    const [busy, setBusy] = useState(false);
    const call = (
        method: 'POST' | 'PUT' | 'DELETE',
        url: string,
        body?: Record<string, unknown>,
    ) => {
        setBusy(true);
        api<State>(method, url, body)
            .then((next) => {
                setState(next);
                setUsername('');
            })
            .catch((e: { message?: string }) =>
                toast.error(e.message ?? tr('Не вдалося.')),
            )
            .finally(() => setBusy(false));
    };
    const invite = (e: FormEvent) => {
        e.preventDefault();
        call('POST', '/settings/parental', { username });
    };

    return (
        <>
            <Head title={tr('Батьківський контроль')} />
            <div className="space-y-4">
                <section className={card}>
                    <h2 className="font-display text-lg font-semibold text-white">
                        {tr('Батьківський контроль')}
                    </h2>
                    <p className="text-sm text-white/60">
                        {tr(
                            'Для акаунтів у підлітковому режимі. Підліток погоджується сам. Батьки бачать загальну картину — друзі й спільноти, — але не листування.',
                        )}
                    </p>
                </section>

                {state.parents.length > 0 && (
                    <section className={card}>
                        <h3 className="font-semibold text-white">
                            {tr('Мої батьки')}
                        </h3>
                        {state.parents.map((p) => (
                            <div
                                key={p.id}
                                className="flex flex-wrap items-center gap-3"
                            >
                                <UserAvatar user={p.user} size="sm" />
                                <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                                    {p.user.name}
                                    {p.status === 'invited' &&
                                        ` · ${tr('пропонує контроль')}`}
                                </span>
                                {p.status === 'invited' && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            call(
                                                'POST',
                                                `/settings/parental/${p.id}/accept`,
                                            )
                                        }
                                        className="gc-pill-primary"
                                    >
                                        {tr('Погодитися')}
                                    </button>
                                )}
                                {(p.status === 'invited' ||
                                    !state.teen_mode.locked) && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            call(
                                                'DELETE',
                                                `/settings/parental/${p.id}`,
                                            )
                                        }
                                        className="gc-ghost-btn"
                                    >
                                        {p.status === 'invited'
                                            ? tr('Відхилити')
                                            : tr('Вимкнути')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {!state.teen_mode.locked && (
                    <section className={card}>
                        <h3 className="font-semibold text-white">
                            {tr('Мої діти')}
                        </h3>
                        {state.children.map((child) => (
                            <ChildRow
                                key={child.id}
                                child={child}
                                busy={busy}
                                onUpdate={(rules) =>
                                    call(
                                        'PUT',
                                        `/settings/parental/${child.id}`,
                                        rules,
                                    )
                                }
                                onRemove={() =>
                                    call(
                                        'DELETE',
                                        `/settings/parental/${child.id}`,
                                    )
                                }
                            />
                        ))}
                        <form onSubmit={invite} className="flex gap-2">
                            <input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={tr('Нік дитини')}
                                aria-label={tr('Нік дитини')}
                                className="input-glass h-10 min-w-0 flex-1 rounded-xl px-3 text-sm text-white placeholder:text-white/35"
                            />
                            <button
                                type="submit"
                                disabled={busy || username.trim() === ''}
                                className="gc-pill-primary"
                            >
                                {tr('Запросити')}
                            </button>
                        </form>
                    </section>
                )}
            </div>
        </>
    );
}

function ChildRow({
    child,
    busy,
    onUpdate,
    onRemove,
}: {
    child: State['children'][number];
    busy: boolean;
    onUpdate: (rules: Record<string, unknown>) => void;
    onRemove: () => void;
}) {
    const [from, setFrom] = useState(child.rules.night_from ?? '23:00');
    const [to, setTo] = useState(child.rules.night_to ?? '07:00');

    return (
        <div className="gc-solid-2 space-y-3 rounded-xl p-3">
            <div className="flex items-center gap-3">
                <UserAvatar user={child.user} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                    {child.user.name}
                </span>
                {child.status === 'invited' && (
                    <span className="text-xs text-white/45">
                        {tr('чекає згоди')}
                    </span>
                )}
                <button
                    type="button"
                    disabled={busy}
                    onClick={onRemove}
                    className="text-xs text-white/45 hover:text-red-300"
                >
                    {tr('Прибрати')}
                </button>
            </div>
            {child.summary && (
                <p className="text-xs text-white/60">
                    {tr('Друзів: {f} (за тиждень +{n}) · спільнот: {c}', {
                        f: child.summary.friends,
                        n: child.summary.new_friends,
                        c: child.summary.communities,
                    })}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/75">
                {tr('Нічна пауза з')}
                <input
                    type="time"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="gc-field h-9"
                    aria-label={tr('Початок паузи')}
                />
                {tr('до')}
                <input
                    type="time"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="gc-field h-9"
                    aria-label={tr('Кінець паузи')}
                />
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => onUpdate({ night_from: from, night_to: to })}
                    className="gc-ghost-btn"
                >
                    {tr('Зберегти')}
                </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-white/75">
                <input
                    type="checkbox"
                    checked={child.rules.friends_of_friends ?? false}
                    onChange={(e) =>
                        onUpdate({ friends_of_friends: e.target.checked })
                    }
                    className="size-4 accent-[var(--gc-accent)]"
                />
                {tr('Заявки в друзі — лише від друзів друзів')}
            </label>
        </div>
    );
}

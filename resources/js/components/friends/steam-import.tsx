import { router } from '@inertiajs/react';
import { Check, Gamepad2, Lock, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { Widget } from '@/components/gc/widget';
import { api, ApiError } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Row = { user: UserCard; state: string };
type Result = {
    status: 'ok' | 'no_steam' | 'private' | 'off';
    people: Row[];
    sent?: number;
};

/**
 * Імпорт друзів (№279): хто з друзів у Steam уже на GameCon. Список друзів Steam читається
 * лише на запит людини й лише з публічного профілю Steam; заявки — звичайні.
 */
export function SteamImport() {
    const [result, setResult] = useState<Result | null>(null);
    const [busy, setBusy] = useState(false);
    const [profile, setProfile] = useState('');

    const load = async () => {
        setBusy(true);
        try {
            setResult(await api<Result>('GET', '/friends/import/steam'));
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr('Steam не відповів. Спробуйте пізніше.'),
            );
        } finally {
            setBusy(false);
        }
    };

    const addable = (result?.people ?? []).filter(
        (row) => row.state === 'none' || row.state === 'incoming',
    );
    const add = async (ids: number[]) => {
        setBusy(true);
        try {
            const next = await api<Result>('POST', '/friends/import/steam', {
                ids,
            });
            setResult(next);
            toast.success(tr('Заявок надіслано: {n}', { n: next.sent ?? 0 }));
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr('Не вдалося надіслати заявки.'),
            );
        } finally {
            setBusy(false);
        }
    };

    if (result?.status === 'off') return null;

    return (
        <Widget title={tr('Друзі зі Steam')} icon={Gamepad2}>
            {result === null ? (
                <div className="flex flex-wrap items-center gap-3 px-1">
                    <p className="min-w-0 flex-1 text-sm text-white/60">
                        {tr(
                            'Знайдемо, хто з ваших друзів у Steam уже на GameCon.',
                        )}
                    </p>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void load()}
                        className="gc-pill-primary shrink-0"
                    >
                        {busy ? tr('Шукаємо…') : tr('Знайти друзів')}
                    </button>
                </div>
            ) : result.status === 'no_steam' ? (
                <form
                    className="flex flex-wrap gap-2 px-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.post(
                            '/me/playing/steam',
                            { profile },
                            {
                                preserveScroll: true,
                                onSuccess: () => void load(),
                            },
                        );
                    }}
                >
                    <p className="w-full text-sm text-white/60">
                        {tr(
                            'Спершу прив’яжіть Steam: вставте посилання на свій профіль.',
                        )}
                    </p>
                    <input
                        value={profile}
                        onChange={(event) => setProfile(event.target.value)}
                        placeholder="https://steamcommunity.com/id/…"
                        aria-label={tr('Посилання на профіль Steam')}
                        className="input-glass h-10 min-w-0 flex-1 rounded-full px-4 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={profile.trim() === ''}
                        className="gc-pill-primary shrink-0"
                    >
                        {tr('Прив’язати')}
                    </button>
                </form>
            ) : result.status === 'private' ? (
                <p className="flex items-start gap-2 px-1 text-sm text-white/60">
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {tr(
                        'Список друзів у Steam закритий. Steam → Профіль → Редагувати → Приватність → «Список друзів: публічний», і натисніть «Знайти» ще раз.',
                    )}
                </p>
            ) : result.people.length === 0 ? (
                <p className="px-1 text-sm text-white/60">
                    {tr(
                        'Поки ніхто з ваших друзів Steam не прив’язав Steam до GameCon. Покличте їх посиланням-запрошенням.',
                    )}
                </p>
            ) : (
                <div className="space-y-2">
                    {addable.length > 1 && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                void add(addable.map((row) => row.user.id))
                            }
                            className="gc-pill-primary w-full"
                        >
                            <UserPlus className="size-4" />
                            {tr('Додати всіх ({n})', { n: addable.length })}
                        </button>
                    )}
                    <ul className="divide-y divide-white/[0.06]">
                        {result.people.map((row) => (
                            <li
                                key={row.user.id}
                                className="flex items-center gap-3 py-2"
                            >
                                <UserAvatar user={row.user} size="sm" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-white">
                                        {row.user.name}
                                    </span>
                                    <span className="block truncate text-xs text-white/45">
                                        @{row.user.username}
                                    </span>
                                </span>
                                {row.state === 'friends' ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-200">
                                        <Check className="size-4" />
                                        {tr('Друзі')}
                                    </span>
                                ) : row.state === 'outgoing' ? (
                                    <span className="text-xs text-white/45">
                                        {tr('Заявку надіслано')}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void add([row.user.id])}
                                        className="gc-ghost-btn shrink-0"
                                    >
                                        {row.state === 'incoming'
                                            ? tr('Прийняти')
                                            : tr('Додати')}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Widget>
    );
}

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

type Group = { key: string; name: string; kind: string; logo: string | null };

const KIND_LABEL: Record<string, () => string> = {
    family: () => tr('Сім’я'),
    clan: () => tr('Клан'),
    guild: () => tr('Гільдія'),
    game: () => tr('Гра'),
    server: () => tr('Сервер'),
};

/**
 * Порядок значків біля ніка: перша група видна завжди (на телефоні — без «+N»).
 * Стрілками людина піднімає сім'ю, клан чи гільдію вище.
 */
export function BadgeOrderSettings() {
    const [groups, setGroups] = useState<Group[] | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api<{ groups: Group[] }>('GET', '/settings/badges')
            .then((data) => setGroups(data.groups))
            .catch(() => setGroups([]));
    }, []);

    const move = (index: number, delta: number) => {
        if (!groups) return;
        const next = [...groups];
        const [item] = next.splice(index, 1);
        next.splice(index + delta, 0, item);
        setGroups(next);
        setBusy(true);
        void api<{ groups: Group[] }>('PUT', '/settings/badges', {
            order: next.map((g) => g.key),
        })
            .then((data) => setGroups(data.groups))
            .finally(() => setBusy(false));
    };

    if (groups === null) return null;
    if (groups.length === 0) {
        return (
            <p className="text-sm text-white/55">
                {tr(
                    'Вступіть у сім’ю, клан чи гільдію — їхні логотипи з’являться біля вашого ніка.',
                )}
            </p>
        );
    }

    return (
        <ul className="divide-y divide-white/[0.06]">
            {groups.map((group, i) => (
                <li key={group.key} className="flex items-center gap-3 py-2.5">
                    {group.logo ? (
                        <img
                            src={group.logo}
                            alt=""
                            className="size-8 shrink-0 rounded-lg object-cover"
                        />
                    ) : (
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-xs font-bold text-sky-400">
                            {group.name.slice(0, 2)}
                        </span>
                    )}
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold break-words text-white">
                            {group.name}
                        </span>
                        <span className="block text-xs text-white/50">
                            {(KIND_LABEL[group.kind] ?? KIND_LABEL.game)()}
                            {i === 0 ? ` · ${tr('показується першим')}` : ''}
                        </span>
                    </span>
                    <button
                        type="button"
                        disabled={busy || i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={tr('Вище')}
                        className="grid size-11 place-items-center rounded-xl text-white/70 hover:bg-[var(--gc-l3)] disabled:opacity-30"
                    >
                        <ChevronUp className="size-4" />
                    </button>
                    <button
                        type="button"
                        disabled={busy || i === groups.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={tr('Нижче')}
                        className="grid size-11 place-items-center rounded-xl text-white/70 hover:bg-[var(--gc-l3)] disabled:opacity-30"
                    >
                        <ChevronDown className="size-4" />
                    </button>
                </li>
            ))}
        </ul>
    );
}

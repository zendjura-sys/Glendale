import { Link } from '@inertiajs/react';
import { Clapperboard, Eye, EyeOff, Music2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

export type TogetherPerson = UserCard & {
    kind: 'cinema' | 'music';
    /** Назва фільму чи треку, які дивилися / слухали разом. */
    together: string;
};

/**
 * «Дивилися й слухали разом»: люди зі спільних переглядів і прослуховувань (назва фільму чи треку поруч).
 * Власник може прибрати людину з блоку або сховати весь блок від інших.
 */
export function WatchedTogether({
    people,
    isSelf,
    hiddenForOthers,
}: {
    people: TogetherPerson[];
    isSelf: boolean;
    hiddenForOthers: boolean;
}) {
    const [list, setList] = useState(people);
    const [off, setOff] = useState(hiddenForOthers);

    const send = (body: Record<string, unknown>) =>
        api<{ together: TogetherPerson[]; off: boolean }>(
            'POST',
            '/me/together',
            body,
        )
            .then((r) => {
                setList(r.together);
                setOff(r.off);
            })
            .catch((e) => toast.error((e as Error).message));

    if (list.length === 0) return null;

    return (
        <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/40">
                    {tr('Дивилися й слухали разом')}
                </span>
                {list.map((person) => {
                    const Icon =
                        person.kind === 'music' ? Music2 : Clapperboard;

                    return (
                        <span
                            key={person.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pr-1.5 pl-2.5 text-xs text-white/80"
                        >
                            <Link
                                href={`/${person.username}`}
                                className="hover:text-white"
                            >
                                {person.name}
                            </Link>
                            <span
                                className="inline-flex max-w-40 items-center gap-1 truncate text-white/40"
                                title={person.together}
                            >
                                <Icon className="size-3 shrink-0" />
                                <span className="truncate">
                                    {person.together}
                                </span>
                            </span>
                            {isSelf && (
                                <button
                                    type="button"
                                    title={tr('Прибрати з профілю')}
                                    aria-label={tr('Прибрати з профілю')}
                                    onClick={() =>
                                        void send({ hide: person.id })
                                    }
                                    className="rounded-full p-0.5 text-white/35 transition hover:bg-white/10 hover:text-white"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </span>
                    );
                })}
            </div>
            {isSelf && (
                <button
                    type="button"
                    onClick={() => void send({ off: !off })}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-white/40 transition hover:text-white/70"
                >
                    {off ? (
                        <EyeOff className="size-3" />
                    ) : (
                        <Eye className="size-3" />
                    )}
                    {off
                        ? tr('Бачите лише ви · показати всім')
                        : tr('Бачать усі · сховати від інших')}
                </button>
            )}
        </div>
    );
}

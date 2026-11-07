import { router } from '@inertiajs/react';
import { Copy, ExternalLink, Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Widget } from '@/components/gc/widget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

export type GamerId = {
    key: string;
    label: string;
    value: string;
    url: string | null;
};

type Field = { key: string; label: string; placeholder: string; value: string };

/** Платформи й ігрові ID у профілі: Steam, PSN, Xbox, Riot… з кнопкою «Копіювати»; власник редагує. */
export function GamerIds({
    steam,
    ids,
    isSelf,
}: {
    steam: string | null;
    ids: GamerId[];
    isSelf: boolean;
}) {
    const [fields, setFields] = useState<Field[] | null>(null);

    if (!steam && ids.length === 0 && !isSelf) return null;

    const copy = (id: GamerId) =>
        navigator.clipboard
            .writeText(id.value)
            .then(() => toast.success(tr('Скопійовано: {v}', { v: id.value })))
            .catch(() => undefined);

    const edit = () =>
        api<{ ids: Field[] }>('GET', '/me/playing')
            .then((d) => setFields(d.ids))
            .catch(() => undefined);

    const save = () =>
        fields &&
        router.put(
            '/me/playing/consoles',
            Object.fromEntries(fields.map((f) => [f.key, f.value])),
            { preserveScroll: true, onSuccess: () => setFields(null) },
        );

    return (
        <Widget title={tr('Платформи й ігрові ID')}>
            <div className="space-y-1 px-1">
                {steam && (
                    <a
                        href={steam}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg py-1 text-sm text-white/85 hover:text-white"
                    >
                        <span className="w-24 shrink-0 text-xs text-white/45">
                            Steam
                        </span>
                        <span className="flex-1">{tr('Профіль')}</span>
                        <ExternalLink className="size-3.5 text-white/40" />
                    </a>
                )}
                {ids.map((id) => (
                    <div
                        key={id.key}
                        className="flex items-center gap-2 py-1 text-sm"
                    >
                        <span className="w-24 shrink-0 truncate text-xs text-white/45">
                            {id.label}
                        </span>
                        {id.url ? (
                            <a
                                href={id.url}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 flex-1 truncate text-white/85 hover:text-white"
                            >
                                {id.value}
                            </a>
                        ) : (
                            <span className="min-w-0 flex-1 truncate text-white/85">
                                {id.value}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => copy(id)}
                            className="rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                            aria-label={tr('Копіювати {label}', {
                                label: id.label,
                            })}
                        >
                            <Copy className="size-3.5" />
                        </button>
                    </div>
                ))}
                {!steam && ids.length === 0 && (
                    <p className="text-sm text-white/45">
                        {tr(
                            'Додайте PSN, Xbox, Riot ID чи Battle.net — друзям буде легше вас знайти.',
                        )}
                    </p>
                )}
                {isSelf && (
                    <button
                        type="button"
                        onClick={edit}
                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-gc-lilac-300 hover:text-white"
                    >
                        <Pencil className="size-3.5" />
                        {ids.length === 0 ? tr('Додати ID') : tr('Змінити')}
                    </button>
                )}
            </div>
            <Dialog
                open={fields !== null}
                onOpenChange={(open) => !open && setFields(null)}
            >
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-lg">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Ігрові ID')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Видно всім, хто бачить ваш профіль. Порожнє поле — не показувати.',
                            )}
                        </DialogDescription>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {fields?.map((f, i) => (
                            <label key={f.key} className="block">
                                <span className="mb-1 block text-xs text-white/50">
                                    {f.label}
                                </span>
                                <input
                                    value={f.value}
                                    onChange={(e) =>
                                        setFields(
                                            fields.map((x, j) =>
                                                j === i
                                                    ? {
                                                          ...x,
                                                          value: e.target.value,
                                                      }
                                                    : x,
                                            ),
                                        )
                                    }
                                    placeholder={f.placeholder}
                                    maxLength={32}
                                    className="input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30"
                                />
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={save}
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold"
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </Widget>
    );
}

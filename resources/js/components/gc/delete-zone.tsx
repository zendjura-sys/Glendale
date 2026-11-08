import { useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { tr } from '@/lib/i18n';

/** Небезпечна зона: видалення спільноти, клану, гільдії чи сім’ї з підтвердженням адресою. */
export function DeleteZone({
    title,
    description,
    slug,
    action,
}: {
    title: string;
    description: string;
    slug: string;
    action: string;
}) {
    const form = useForm({ confirm: '' });

    return (
        <section className="gc-solid mt-4 rounded-2xl p-4">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-red-400">
                <Trash2 className="size-4" />
                {title}
            </h3>
            <p className="mt-1 text-sm text-white/55">{description}</p>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.delete(action);
                }}
                className="mt-3 flex flex-col gap-3 sm:flex-row"
            >
                <input
                    value={form.data.confirm}
                    onChange={(e) => form.setData('confirm', e.target.value)}
                    placeholder={tr('Введіть «{slug}» для підтвердження', {
                        slug,
                    })}
                    aria-label={tr('Підтвердження видалення')}
                    className="h-11 flex-1 rounded-xl bg-white/[0.06] px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={form.data.confirm !== slug || form.processing}
                    className="h-11 rounded-xl bg-red-500/80 px-5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
                >
                    {tr('Видалити')}
                </button>
            </form>
            {form.errors.confirm && (
                <p className="mt-2 text-sm text-red-400">
                    {form.errors.confirm}
                </p>
            )}
        </section>
    );
}

import { useForm } from '@inertiajs/react';
import { HandHeart, ExternalLink } from 'lucide-react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/billing';
import { tr } from '@/lib/i18n';

export type DonationJar = {
    url: string;
    note: string | null;
    title: string | null;
    /** Зібрано, копійки (null — Monobank не відповів). */
    amount: number | null;
    /** Ціль, копійки (null — без цілі). */
    goal: number | null;
};

/**
 * Картка «Підтримати» з банкою Monobank: назва збору, прогрес і кнопка на банку.
 * Лише на сайті — у застосунку банок немає (правила Google Play щодо зовнішніх оплат).
 */
export function DonationJarCard({
    jar,
    title,
}: {
    jar: DonationJar | null | undefined;
    title: string;
}) {
    if (!jar) return null;
    const progress =
        jar.goal && jar.amount !== null
            ? Math.min(100, Math.round((jar.amount / jar.goal) * 100))
            : null;

    return (
        <section className="glass rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <HandHeart className="size-5 text-rose-300" />
                {title}
            </h2>
            {jar.title && (
                <p className="mt-1 text-sm font-medium text-white/80">
                    {jar.title}
                </p>
            )}
            {jar.note && (
                <p className="mt-1 text-sm whitespace-pre-line text-white/55">
                    {jar.note}
                </p>
            )}
            {jar.amount !== null && (
                <div className="mt-3">
                    <p className="text-sm text-white">
                        <b className="tabular-nums">{money(jar.amount)}</b>
                        {jar.goal && (
                            <span className="text-white/45">
                                {' '}
                                {tr('з {goal}', { goal: money(jar.goal) })}
                            </span>
                        )}
                    </p>
                    {progress !== null && (
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                            <div
                                className="h-full rounded-full bg-[var(--btn-primary,#6366f1)] transition-[width] duration-700 ease-out"
                                style={{ width: `${Math.max(3, progress)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
            <a
                href={jar.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
                {tr('Задонатити')}
                <ExternalLink className="size-4" />
            </a>
            <p className="mt-2 text-[11px] text-white/35">
                {tr(
                    'Банка Monobank. Кошти йдуть напряму власнику банки — GameCon їх не отримує.',
                )}
            </p>
        </section>
    );
}

/** Налаштування банки: посилання й підпис. Порожнє посилання — прибрати картку. */
export function DonationJarForm({
    action,
    initial,
    hint,
}: {
    action: string;
    initial: { url: string | null; note: string | null };
    hint: string;
}) {
    const form = useForm({ url: initial.url ?? '', note: initial.note ?? '' });

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                form.put(action, { preserveScroll: true });
            }}
            className="glass space-y-3 rounded-3xl p-5"
        >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <HandHeart className="size-5 text-rose-300" />
                {tr('Банка Monobank')}
            </h2>
            <p className="text-sm text-white/50">{hint}</p>
            <Input
                value={form.data.url}
                onChange={(e) => form.setData('url', e.target.value)}
                placeholder="https://send.monobank.ua/jar/…"
                inputMode="url"
            />
            <InputError message={form.errors.url} />
            <Input
                value={form.data.note}
                onChange={(e) => form.setData('note', e.target.value)}
                maxLength={200}
                placeholder={tr('На що збираємо (необов’язково)')}
            />
            <button
                type="submit"
                disabled={form.processing}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--btn-primary,#6366f1)] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
                {tr('Зберегти')}
            </button>
        </form>
    );
}

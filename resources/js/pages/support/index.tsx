import { Head, Link, useForm } from '@inertiajs/react';
import { LifeBuoy, MessageSquarePlus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { ScreenshotPicker, StatusPill } from '@/components/support/support-ui';
import type { TicketCard } from '@/components/support/support-ui';
import { EmptyState } from '@/components/gc/widget';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Підтримка: мої звернення й нове звернення. */
export default function Support({
    tickets,
    categories,
    prefill,
}: {
    tickets: TicketCard[];
    categories: Record<string, string>;
    prefill: {
        category: string | null;
        subject: string | null;
        url: string | null;
    };
}) {
    const reduce = useReducedMotion();
    const [creating, setCreating] = useState(
        tickets.length === 0 || Boolean(prefill.category || prefill.subject),
    );
    const form = useForm<{
        category: string;
        subject: string;
        body: string;
        url: string;
        files: File[];
    }>({
        category:
            prefill.category && categories[prefill.category]
                ? prefill.category
                : '',
        subject: prefill.subject ?? '',
        body: '',
        url: prefill.url ?? '',
        files: [],
    });

    return (
        <>
            <Head title={tr('Підтримка')} />
            <div className="mx-auto max-w-[760px] space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-white">
                            {tr('Підтримка')}
                        </h1>
                        <p className="mt-1 text-sm text-white/50">
                            {tr(
                                'Опишіть проблему — відповімо тут і надішлемо сповіщення. Часті питання є в',
                            )}{' '}
                            <Link
                                href="/help"
                                className="text-gc-lilac-300 hover:underline"
                            >
                                {tr('довідці')}
                            </Link>
                            .
                        </p>
                    </div>
                    {!creating && (
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <MessageSquarePlus className="size-4" />
                            {tr('Нове звернення')}
                        </button>
                    )}
                </div>

                <AnimatePresence initial={false}>
                    {creating && (
                        <motion.form
                            initial={
                                reduce ? { opacity: 0 } : { opacity: 0, y: -8 }
                            }
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post('/support', { forceFormData: true });
                            }}
                            className="glass space-y-4 rounded-2xl p-4 sm:p-5"
                        >
                            <div>
                                <p className="mb-2 text-sm font-medium text-white">
                                    {tr('З чим допомогти?')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(categories).map(
                                        ([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() =>
                                                    form.setData(
                                                        'category',
                                                        key,
                                                    )
                                                }
                                                className={cn(
                                                    'h-9 rounded-xl px-3.5 text-sm transition',
                                                    form.data.category === key
                                                        ? 'bg-gc-indigo text-white'
                                                        : 'bg-white/[0.06] text-white/70 hover:text-white',
                                                )}
                                            >
                                                {tr(label)}
                                            </button>
                                        ),
                                    )}
                                </div>
                                {form.errors.category && (
                                    <p className="mt-1 text-xs text-red-300">
                                        {form.errors.category}
                                    </p>
                                )}
                            </div>
                            <div>
                                <input
                                    value={form.data.subject}
                                    onChange={(e) =>
                                        form.setData('subject', e.target.value)
                                    }
                                    maxLength={120}
                                    placeholder={tr('Коротко: що сталося')}
                                    className={cn(field, 'h-11')}
                                />
                                {form.errors.subject && (
                                    <p className="mt-1 text-xs text-red-300">
                                        {form.errors.subject}
                                    </p>
                                )}
                            </div>
                            <div>
                                <textarea
                                    value={form.data.body}
                                    onChange={(e) =>
                                        form.setData('body', e.target.value)
                                    }
                                    rows={6}
                                    maxLength={5000}
                                    placeholder={tr(
                                        'Детально: що робили, що очікували, що вийшло. Для оплати — дата й сума.',
                                    )}
                                    className={cn(field, 'resize-y py-3')}
                                />
                                {form.errors.body && (
                                    <p className="mt-1 text-xs text-red-300">
                                        {form.errors.body}
                                    </p>
                                )}
                            </div>
                            <ScreenshotPicker
                                files={form.data.files}
                                onChange={(files) =>
                                    form.setData('files', files)
                                }
                            />
                            <div className="flex justify-end gap-2">
                                {tickets.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setCreating(false)}
                                        className="h-10 rounded-xl px-4 text-sm text-white/60 hover:text-white"
                                    >
                                        {tr('Скасувати')}
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={
                                        form.processing || !form.data.category
                                    }
                                    className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
                                >
                                    {tr('Надіслати')}
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                {tickets.length === 0 ? (
                    !creating && (
                        <EmptyState
                            icon={LifeBuoy}
                            title={tr('Звернень поки немає')}
                        />
                    )
                ) : (
                    <ul className="glass divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
                        {tickets.map((t) => (
                            <li key={t.id}>
                                <Link
                                    href={`/support/${t.id}`}
                                    className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]"
                                >
                                    <span
                                        className={cn(
                                            'size-2 shrink-0 rounded-full',
                                            t.unread
                                                ? 'bg-gc-indigo'
                                                : 'bg-transparent',
                                        )}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-white">
                                            #{t.id} · {t.subject}
                                        </span>
                                        <span className="block truncate text-xs text-white/45">
                                            {tr(t.category_label)} ·{' '}
                                            {formatDate(t.updated_at)}
                                        </span>
                                    </span>
                                    <StatusPill status={t.status} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
}

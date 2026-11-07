import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Star } from 'lucide-react';
import { useState } from 'react';
import {
    ScreenshotPicker,
    StatusPill,
    Thread,
} from '@/components/support/support-ui';
import type {
    TicketCard,
    TicketMessage,
} from '@/components/support/support-ui';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Звернення: листування з підтримкою, відповідь, закриття й оцінка. */
export default function SupportTicketPage({
    ticket,
    messages,
}: {
    ticket: TicketCard;
    messages: TicketMessage[];
}) {
    const form = useForm<{ body: string; files: File[] }>({
        body: '',
        files: [],
    });
    const [rating, setRating] = useState(ticket.rating ?? 0);

    return (
        <>
            <Head title={`#${ticket.id} · ${ticket.subject}`} />
            <div className="mx-auto max-w-[760px] space-y-4">
                <Link
                    href="/support"
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Мої звернення')}
                </Link>
                <div className="glass rounded-2xl p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="font-display text-lg font-semibold text-white">
                                #{ticket.id} · {ticket.subject}
                            </h1>
                            <p className="text-xs text-white/45">
                                {tr(ticket.category_label)}
                            </p>
                        </div>
                        <StatusPill status={ticket.status} />
                    </div>
                    <div className="mt-5">
                        <Thread messages={messages} mineIsStaff={false} />
                    </div>
                </div>

                {ticket.status === 'closed' && (
                    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                        <p className="text-sm text-white/70">
                            {tr('Як вам допомогли?')}
                        </p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    aria-label={tr('{n} з 5', { n })}
                                    onClick={() => {
                                        setRating(n);
                                        router.post(
                                            `/support/${ticket.id}/rate`,
                                            { rating: n },
                                            { preserveScroll: true },
                                        );
                                    }}
                                    className="p-1"
                                >
                                    <Star
                                        className={cn(
                                            'size-6 transition',
                                            n <= rating
                                                ? 'fill-amber-300 text-amber-300'
                                                : 'text-white/30',
                                        )}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(`/support/${ticket.id}/reply`, {
                            forceFormData: true,
                            preserveScroll: true,
                            onSuccess: () => form.reset(),
                        });
                    }}
                    className="glass space-y-3 rounded-2xl p-4"
                >
                    <textarea
                        value={form.data.body}
                        onChange={(e) => form.setData('body', e.target.value)}
                        rows={3}
                        maxLength={5000}
                        placeholder={
                            ticket.status === 'closed'
                                ? tr('Написати — і звернення відкриється знову')
                                : tr('Ваша відповідь')
                        }
                        className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    {form.errors.body && (
                        <p className="text-xs text-red-300">
                            {form.errors.body}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <ScreenshotPicker
                            files={form.data.files}
                            onChange={(files) => form.setData('files', files)}
                        />
                        <div className="ml-auto flex gap-2">
                            {ticket.status !== 'closed' && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.post(
                                            `/support/${ticket.id}/close`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="h-10 rounded-xl px-4 text-sm text-white/60 hover:text-white"
                                >
                                    {tr('Питання вирішено')}
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    form.data.body.trim().length < 2
                                }
                                className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-40"
                            >
                                {tr('Надіслати')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

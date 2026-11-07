import { Link } from '@inertiajs/react';
import { ChevronDown, MessageSquareText, Sparkles, Wand2 } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { TextSkeleton } from '@/components/gc/skeletons';
import { api, ApiError } from '@/lib/api';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type FamilyChatData = {
    id: number;
    today: number;
    latest: { id: number; name: string; body: string; at: string | null }[];
    ai: boolean;
};

const NAME_TONES = ['text-sky-400', 'text-amber-400', 'text-emerald-400'];

/** Сталий колір імені: той самий автор — той самий тон. */
function nameTone(name: string): string {
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return NAME_TONES[sum % NAME_TONES.length];
}

const time = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleTimeString('uk-UA', {
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

/**
 * Чат сім'ї на огляді штабу: скільки написали сьогодні, кнопка «Зробити ШІ-підсумок»
 * (розгортає 3–6 пунктів про домовленості) і останні повідомлення.
 */
export function FamilyChatCard({
    chat,
    tag,
}: {
    chat: FamilyChatData;
    tag: string;
}) {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (!next || summary || busy) return;
        setBusy(true);
        setError(null);
        void api<{ summary: string }>('POST', `/messages/${chat.id}/ai/summary`)
            .then((data) => setSummary(data.summary))
            .catch((e: unknown) =>
                setError(
                    e instanceof ApiError
                        ? e.message
                        : tr('ШІ зараз недоступний.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    const points = (summary ?? '')
        .split('\n')
        .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
        .filter(Boolean);

    return (
        <section className="gc-solid rounded-[22px] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
                <MessageSquareText className="size-5 shrink-0 text-sky-400" />
                <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-white sm:text-base">
                    {tr('Чат сім’ї {tag}', { tag })}
                </h2>
                <span className="shrink-0 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-400">
                    {tr('{n} {word} сьогодні', {
                        n: chat.today,
                        word: plural(chat.today, [
                            tr('повідомлення'),
                            tr('повідомлення'),
                            tr('повідомлень'),
                        ]),
                    })}
                </span>
            </div>

            {chat.ai && (
                <>
                    <button
                        type="button"
                        onClick={toggle}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 rounded-2xl bg-sky-500/10 px-4 py-3 text-left transition hover:bg-sky-500/15"
                    >
                        <Wand2 className="size-5 shrink-0 text-sky-400" />
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-sky-400">
                                {tr('Зробити ШІ-підсумок чату')}
                            </span>
                            <span className="block truncate text-xs text-white/55">
                                {tr(
                                    'Останні ~80 повідомлень коротко: про що домовились',
                                )}
                            </span>
                        </span>
                        <ChevronDown
                            className={cn(
                                'size-4 shrink-0 text-sky-400 transition',
                                open && 'rotate-180',
                            )}
                        />
                    </button>
                    <AnimatePresence initial={false}>
                        {open && (
                            <m.div
                                initial={
                                    reduce ? false : { opacity: 0, height: 0 }
                                }
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={
                                    reduce
                                        ? undefined
                                        : { opacity: 0, height: 0 }
                                }
                                className="overflow-hidden"
                            >
                                <div className="gc-solid-2 mt-3 rounded-2xl p-4">
                                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-sky-400">
                                        <Sparkles className="size-3.5" />
                                        {tr('Коротке зведення від ШІ')}
                                    </p>
                                    {busy ? (
                                        <TextSkeleton lines={3} />
                                    ) : error ? (
                                        <p className="text-sm text-red-400">
                                            {error}
                                        </p>
                                    ) : (
                                        <ul className="space-y-1.5 text-sm leading-relaxed text-white/80">
                                            {points.map((point, i) => (
                                                <li
                                                    key={i}
                                                    className="flex gap-2"
                                                >
                                                    <span className="text-white/40">
                                                        •
                                                    </span>
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <p className="mt-2 text-[11px] text-white/40">
                                        {tr('ШІ може помилятися.')}
                                    </p>
                                </div>
                            </m.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {chat.latest.length > 0 && (
                <div className="mt-3 space-y-2">
                    {chat.latest.map((msg) => (
                        <div
                            key={msg.id}
                            className="gc-solid-2 rounded-2xl px-4 py-3"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span
                                    className={cn(
                                        'truncate text-sm font-bold',
                                        nameTone(msg.name),
                                    )}
                                >
                                    {msg.name}
                                </span>
                                <span className="shrink-0 text-xs text-white/40">
                                    {time(msg.at)}
                                </span>
                            </div>
                            <p className="mt-1 text-sm break-words text-white/80">
                                {msg.body}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <Link
                href={`/messages/${chat.id}`}
                className="mt-3 inline-flex text-xs font-semibold text-sky-400 hover:text-sky-400"
            >
                {tr('Відкрити чат')}
            </Link>
        </section>
    );
}

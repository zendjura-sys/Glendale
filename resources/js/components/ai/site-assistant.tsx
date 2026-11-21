import { Link } from '@inertiajs/react';
import {
    BookOpen,
    LoaderCircle,
    MessageCircleQuestion,
    Send,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Fragment, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

type Source = { title: string; url: string };
type Turn = {
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
};

/** Рядок відповіді: посилання виду [Назва](/help/…) стають переходами, решта — текстом. */
function Rich({ text }: { text: string }) {
    const parts = text.split(/(\[[^\]]+\]\(\/[^)\s]+\))/g);

    return (
        <>
            {parts.map((part, i) => {
                const link = part.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/);

                return link ? (
                    <Link
                        key={i}
                        href={link[2]}
                        className="text-primary underline-offset-2 hover:underline"
                    >
                        {link[1]}
                    </Link>
                ) : (
                    <Fragment key={i}>{part.replace(/\*\*/g, '')}</Fragment>
                );
            })}
        </>
    );
}

/**
 * Помічник по сайту: питання словами — відповідь ШІ за статтями довідки з посиланнями.
 * Гостям і без ключа ШІ — добірка статей на тему питання.
 */
export function SiteAssistant() {
    const reduce = useReducedMotion();
    const [turns, setTurns] = useState<Turn[]>([]);
    const [question, setQuestion] = useState('');
    const [busy, setBusy] = useState(false);

    const ask = async () => {
        const text = question.trim();
        if (text.length < 2 || busy) return;
        const history = turns.map(({ role, content }) => ({ role, content }));
        setTurns((list) => [...list, { role: 'user', content: text }]);
        setQuestion('');
        setBusy(true);
        try {
            const res = await api<{ answer: string; sources: Source[] }>(
                'POST',
                '/help-assistant',
                { question: text, history },
            );
            setTurns((list) => [
                ...list,
                {
                    role: 'assistant',
                    content: res.answer,
                    sources: res.sources,
                },
            ]);
        } catch (e) {
            setTurns((list) => [
                ...list,
                {
                    role: 'assistant',
                    content:
                        e instanceof Error && e.message
                            ? e.message
                            : tr(
                                  'Не вдалося отримати відповідь. Спробуйте ще раз.',
                              ),
                },
            ]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="gc-solid mb-8 rounded-2xl p-4" data-site-assistant>
            <div className="mb-3 flex items-center gap-2.5">
                <MessageCircleQuestion className="size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-white">
                        {tr('Помічник по сайту')}
                    </h2>
                    <p className="text-xs text-white/50">
                        {tr(
                            'Запитайте словами, як щось зробити, — помічник відповість за статтями довідки.',
                        )}
                    </p>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {turns.map((turn, i) => (
                    <m.div
                        key={i}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={
                            turn.role === 'user'
                                ? 'mb-2 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary/20 px-3.5 py-2 text-sm text-white'
                                : 'mb-3 max-w-[95%] text-sm leading-relaxed whitespace-pre-line text-white/85'
                        }
                    >
                        {turn.role === 'assistant' ? (
                            <Rich text={turn.content} />
                        ) : (
                            turn.content
                        )}
                        {turn.sources && turn.sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {turn.sources.map((s) => (
                                    <Link
                                        key={s.url}
                                        href={s.url}
                                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-xs text-white/75 hover:text-white"
                                    >
                                        <BookOpen className="size-3.5 text-primary" />
                                        {s.title}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </m.div>
                ))}
            </AnimatePresence>
            {busy && (
                <p className="mb-3 flex items-center gap-2 text-sm text-white/50">
                    <LoaderCircle
                        className={reduce ? 'size-4' : 'size-4 animate-spin'}
                    />
                    {tr('Шукаю в довідці…')}
                </p>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    ask();
                }}
                className="flex gap-2"
            >
                <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={500}
                    placeholder={tr('Напр.: як взяти зміну в сім’ї?')}
                    aria-label={tr('Питання помічнику')}
                    className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3.5 text-sm text-white placeholder:text-white/40"
                />
                <button
                    type="submit"
                    disabled={busy || question.trim().length < 2}
                    aria-label={tr('Запитати')}
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white transition disabled:opacity-40"
                >
                    <Send className="size-4" />
                </button>
            </form>
        </section>
    );
}

import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { BookPlus, Loader2, SpellCheck } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
    type TextareaHTMLAttributes,
} from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Помилка від /admin/spellcheck: позиції — у символах JavaScript (UTF-16). */
export type SpellIssue = {
    offset: number;
    length: number;
    word: string;
    suggestions: string[];
    rule: 'spelling' | 'grammar';
    message: string;
};

type Response = {
    issues: SpellIssue[];
    engine: 'hunspell' | 'languagetool';
    available: boolean;
    can_add: boolean;
};

const key = (i: SpellIssue) => `${i.offset}:${i.word}`;

/**
 * Перевірка орфографії тексту адміністрації (Hunspell + LanguageTool на сервері)
 * із затримкою після набору. Відповіді на застарілий текст відкидаються.
 */
export function useSpellcheck(
    text: string,
    { delay = 700, lang }: { delay?: number; lang?: 'uk' | 'en' } = {},
) {
    const [issues, setIssues] = useState<SpellIssue[]>([]);
    const [loading, setLoading] = useState(false);
    const [canAdd, setCanAdd] = useState(false);
    const [ignored, setIgnored] = useState<string[]>([]);
    const request = useRef(0);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const id = ++request.current;
        if (text.trim().length < 3) {
            setIssues([]);
            setLoading(false);

            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const result = await api<Response>(
                    'POST',
                    '/admin/spellcheck',
                    {
                        text,
                        lang,
                    },
                );
                if (id === request.current) {
                    setIssues(result.issues);
                    setCanAdd(result.can_add);
                }
            } catch {
                // Перевірка — підказка, а не перешкода: помилку мовчки пропускаємо.
                if (id === request.current) setIssues([]);
            } finally {
                if (id === request.current) setLoading(false);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [text, lang, delay, refresh]);

    const visible = issues.filter(
        (i) => !ignored.includes(i.word.toLowerCase()),
    );

    /** Новий текст із заміною; null — текст уже змінився в цьому місці. */
    const apply = useCallback(
        (issue: SpellIssue, suggestion: string): string | null => {
            if (
                text.slice(issue.offset, issue.offset + issue.length) !==
                issue.word
            ) {
                return null;
            }
            const delta = suggestion.length - issue.length;
            // Одразу зсуваємо решту підкреслень, не чекаючи нової перевірки.
            setIssues((list) =>
                list
                    .filter((i) => key(i) !== key(issue))
                    .map((i) =>
                        i.offset > issue.offset
                            ? { ...i, offset: i.offset + delta }
                            : i,
                    ),
            );

            return (
                text.slice(0, issue.offset) +
                suggestion +
                text.slice(issue.offset + issue.length)
            );
        },
        [text],
    );

    const ignore = (word: string) =>
        setIgnored((list) => [...list, word.toLowerCase()]);

    const addWord = async (word: string) => {
        try {
            await api('POST', '/admin/spellcheck/words', { word });
            ignore(word);
            toast.success(tr('Слово «{word}» додано до словника.', { word }));
            setRefresh((n) => n + 1);
        } catch (error) {
            toast.error((error as Error).message);
        }
    };

    return { issues: visible, loading, canAdd, apply, ignore, addWord };
}

type Spell = ReturnType<typeof useSpellcheck>;

/** Список «Можливі помилки» з варіантами виправлення в один клік. */
export function SpellcheckHints({
    spell,
    onApply,
    className,
}: {
    spell: Spell;
    onApply: (value: string) => void;
    className?: string;
}) {
    const reduce = useReducedMotion();

    return (
        <AnimatePresence initial={false}>
            {spell.issues.length > 0 && (
                <m.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.18 }}
                    className={cn(
                        'mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-xs',
                        className,
                    )}
                    role="status"
                >
                    <p className="mb-1.5 flex items-center gap-1.5 font-medium text-white/60">
                        <SpellCheck className="size-3.5 text-gc-blue" />
                        {tr('Можливі помилки')}
                        <span className="text-white/35">
                            {spell.issues.length}
                        </span>
                        {spell.loading && (
                            <Loader2 className="size-3 animate-spin text-white/35" />
                        )}
                    </p>
                    <ul className="grid gap-1.5">
                        {spell.issues.slice(0, 12).map((issue) => (
                            <li
                                key={key(issue)}
                                className="flex flex-wrap items-center gap-1.5"
                            >
                                <span
                                    className={cn(
                                        'font-medium text-white/85 underline decoration-wavy underline-offset-4',
                                        issue.rule === 'grammar'
                                            ? 'decoration-amber-400/80'
                                            : 'decoration-rose-400/80',
                                    )}
                                    title={issue.message}
                                >
                                    {issue.word}
                                </span>
                                {issue.rule === 'grammar' && (
                                    <span className="text-white/40">
                                        {issue.message}
                                    </span>
                                )}
                                {issue.suggestions.slice(0, 4).map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => {
                                            const next = spell.apply(issue, s);
                                            if (next !== null) onApply(next);
                                        }}
                                        className="rounded-lg bg-gc-blue/10 px-2 py-0.5 text-gc-sky transition hover:bg-gc-blue/20 hover:text-white"
                                    >
                                        {s}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => spell.ignore(issue.word)}
                                    className="rounded-lg px-1.5 py-0.5 text-white/35 transition hover:text-white/70"
                                >
                                    {tr('Пропустити')}
                                </button>
                                {spell.canAdd && issue.rule === 'spelling' && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            spell.addWord(issue.word)
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-white/35 transition hover:text-white/70"
                                        title={tr('Додати до словника')}
                                    >
                                        <BookPlus className="size-3" />
                                        <span className="sr-only sm:not-sr-only">
                                            {tr('У словник')}
                                        </span>
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </m.div>
            )}
        </AnimatePresence>
    );
}

/** Підкреслення помилок «під» текстом поля: прозорий текст, видно лише хвилясту лінію. */
function Underlines({
    text,
    issues,
    className,
    scrollTop,
}: {
    text: string;
    issues: SpellIssue[];
    className?: string;
    scrollTop: number;
}) {
    const parts: ReactNode[] = [];
    let pos = 0;
    for (const issue of [...issues].sort((a, b) => a.offset - b.offset)) {
        if (issue.offset < pos || issue.offset + issue.length > text.length) {
            continue;
        }
        parts.push(text.slice(pos, issue.offset));
        parts.push(
            <span
                key={key(issue)}
                className={cn(
                    'underline decoration-wavy decoration-[1.5px] underline-offset-[5px]',
                    issue.rule === 'grammar'
                        ? 'decoration-amber-400/80'
                        : 'decoration-rose-400/80',
                )}
            >
                {text.slice(issue.offset, issue.offset + issue.length)}
            </span>,
        );
        pos = issue.offset + issue.length;
    }
    parts.push(text.slice(pos));

    return (
        <div
            aria-hidden
            className={cn(
                'pointer-events-none absolute inset-0 overflow-hidden border border-transparent break-words whitespace-pre-wrap text-transparent',
                className,
            )}
        >
            <div style={{ transform: `translateY(${-scrollTop}px)` }}>
                {parts}
                {'​'}
            </div>
        </div>
    );
}

/**
 * Поле для текстів адміністрації з перевіркою орфографії: підкреслює помилки
 * й показує під полем варіанти виправлення. className — для самого textarea
 * (відступи й шрифт підкреслень беруться з textClassName, щоб збігалися).
 */
export function SpellcheckTextarea({
    value,
    onValueChange,
    className,
    textClassName = 'px-3.5 py-3 text-sm',
    containerClassName,
    lang,
    ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
    value: string;
    onValueChange: (value: string) => void;
    textClassName?: string;
    containerClassName?: string;
    lang?: 'uk' | 'en';
}) {
    const spell = useSpellcheck(value, { lang });
    const [scrollTop, setScrollTop] = useState(0);

    return (
        <div className={containerClassName}>
            <div className="relative">
                <textarea
                    {...props}
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                    spellCheck={false}
                    className={cn(className, textClassName)}
                />
                <Underlines
                    text={value}
                    issues={spell.issues}
                    scrollTop={scrollTop}
                    className={cn('rounded-xl', textClassName)}
                />
            </div>
            <SpellcheckHints spell={spell} onApply={onValueChange} />
        </div>
    );
}

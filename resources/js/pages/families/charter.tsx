import { useForm } from '@inertiajs/react';
import { CircleCheck, ClipboardCheck, Plus, Scale, Trash2 } from 'lucide-react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Panel,
    btnGhost,
    btnPrimary,
    textareaClass,
} from '@/components/families/ui';
import { inputClass } from '@/components/servers/server-form';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FamilyShellProps } from '@/types';

type QuizItem = { q: string; options: string[]; correct: number };

type Props = FamilyShellProps & {
    text: string | null;
    quiz: { q: string; options: string[] }[];
    pass: number;
    edit: { text: string; quiz: QuizItem[]; pass: number } | null;
};

/** Статут сім’ї: текст для всіх і тест, який кандидат проходить перед заявкою. */
export default function FamilyCharter(props: Props) {
    const { text, quiz, pass, edit } = props;

    return (
        <FamilyShell {...props} title={tr('Статут')}>
            <Panel title={tr('Статут сім’ї')} icon={Scale}>
                {text ? (
                    <div
                        className="text-sm leading-relaxed whitespace-pre-line text-white/85"
                        data-charter-text
                    >
                        {text}
                    </div>
                ) : (
                    <Empty
                        icon={Scale}
                        text={tr('Лідер ще не написав статут')}
                    />
                )}
                {quiz.length > 0 && (
                    <p className="mt-4 flex items-center gap-2 text-xs text-white/50">
                        <ClipboardCheck className="size-4 text-primary" />
                        {tr(
                            'Перед заявкою кандидат проходить тест за статутом: {n} питань, потрібно {pass}% правильних.',
                            { n: quiz.length, pass },
                        )}
                    </p>
                )}
            </Panel>
            {edit && <CharterEditor initial={edit} slug={props.family.slug} />}
        </FamilyShell>
    );
}

function CharterEditor({
    initial,
    slug,
}: {
    initial: { text: string; quiz: QuizItem[]; pass: number };
    slug: string;
}) {
    const form = useForm<{ text: string; quiz: QuizItem[]; pass: number }>(
        initial,
    );
    const setItem = (i: number, patch: Partial<QuizItem>) =>
        form.setData(
            'quiz',
            form.data.quiz.map((item, n) =>
                n === i ? { ...item, ...patch } : item,
            ),
        );

    return (
        <Panel title={tr('Редагувати статут і тест')} icon={ClipboardCheck}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.put(`/f/${slug}/settings/charter`, {
                        preserveScroll: true,
                    });
                }}
                className="space-y-4"
                data-charter-editor
            >
                <textarea
                    value={form.data.text}
                    onChange={(e) => form.setData('text', e.target.value)}
                    rows={8}
                    placeholder={tr(
                        'Правила сім’ї: поведінка, звіти, склад, покарання…',
                    )}
                    className={textareaClass}
                    aria-label={tr('Текст статуту')}
                />
                <div className="space-y-3" data-charter-quiz>
                    <p className="text-sm font-semibold text-white">
                        {tr('Тест при вступі')}
                    </p>
                    {form.data.quiz.map((item, i) => (
                        <div
                            key={i}
                            className="gc-solid-2 space-y-2 rounded-xl p-3"
                        >
                            <div className="flex gap-2">
                                <input
                                    value={item.q}
                                    onChange={(e) =>
                                        setItem(i, { q: e.target.value })
                                    }
                                    placeholder={tr('Питання')}
                                    className={inputClass}
                                    maxLength={200}
                                />
                                <button
                                    type="button"
                                    aria-label={tr('Прибрати питання')}
                                    onClick={() =>
                                        form.setData(
                                            'quiz',
                                            form.data.quiz.filter(
                                                (_, n) => n !== i,
                                            ),
                                        )
                                    }
                                    className={btnGhost}
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                            {item.options.map((option, o) => (
                                <label
                                    key={o}
                                    className="flex items-center gap-2"
                                >
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={item.correct === o}
                                        aria-label={tr('Правильна відповідь')}
                                        onClick={() =>
                                            setItem(i, { correct: o })
                                        }
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-lg transition',
                                            item.correct === o
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'bg-white/[0.05] text-white/30 hover:text-white/60',
                                        )}
                                    >
                                        <CircleCheck className="size-4" />
                                    </button>
                                    <input
                                        value={option}
                                        onChange={(e) =>
                                            setItem(i, {
                                                options: item.options.map(
                                                    (v, n) =>
                                                        n === o
                                                            ? e.target.value
                                                            : v,
                                                ),
                                            })
                                        }
                                        placeholder={tr('Варіант {n}', {
                                            n: o + 1,
                                        })}
                                        className={inputClass}
                                        maxLength={120}
                                    />
                                </label>
                            ))}
                            {item.options.length < 4 && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setItem(i, {
                                            options: [...item.options, ''],
                                        })
                                    }
                                    className="text-xs font-medium text-primary"
                                >
                                    {tr('+ варіант')}
                                </button>
                            )}
                        </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                        {form.data.quiz.length < 10 && (
                            <button
                                type="button"
                                onClick={() =>
                                    form.setData('quiz', [
                                        ...form.data.quiz,
                                        {
                                            q: '',
                                            options: ['', ''],
                                            correct: 0,
                                        },
                                    ])
                                }
                                className={btnGhost}
                            >
                                <Plus className="size-4" />
                                {tr('Додати питання')}
                            </button>
                        )}
                        <label className="flex items-center gap-2 text-sm text-white/70">
                            {tr('Прохідний бал')}
                            <select
                                value={form.data.pass}
                                onChange={(e) =>
                                    form.setData('pass', Number(e.target.value))
                                }
                                className="input-glass h-10 rounded-xl px-2 text-sm text-white"
                            >
                                {[50, 60, 70, 80, 90, 100].map((n) => (
                                    <option key={n} value={n}>
                                        {n}%
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {Object.values(form.errors)[0] && (
                        <p className="text-sm text-red-400">
                            {Object.values(form.errors)[0]}
                        </p>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={form.processing}
                    className={btnPrimary}
                >
                    {tr('Зберегти статут')}
                </button>
            </form>
        </Panel>
    );
}

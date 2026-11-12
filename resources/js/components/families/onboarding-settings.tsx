import { useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ClipboardList,
    ListChecks,
    Plus,
    Trash2,
} from 'lucide-react';
import { Panel, btnGhost, btnPrimary } from '@/components/families/ui';
import { Toggle } from '@/components/gc/admin';
import { inputClass } from '@/components/servers/server-form';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Question = { id: string; text: string; required: boolean };
export type Step = { id: string; title: string; url: string | null };

const MAX_QUESTIONS = 6;
const MAX_STEPS = 10;

/** Переставити елемент списку на одну позицію вгору чи вниз. */
function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= list.length) {
        return list;
    }
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];

    return next;
}

function RowTools({
    index,
    count,
    onMove,
    onRemove,
}: {
    index: number;
    count: number;
    onMove: (dir: -1 | 1) => void;
    onRemove: () => void;
}) {
    const tool =
        'grid size-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white disabled:opacity-30';

    return (
        <div className="flex shrink-0 items-center">
            <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(-1)}
                className={tool}
                aria-label={tr('Вище')}
            >
                <ArrowUp className="size-3.5" />
            </button>
            <button
                type="button"
                disabled={index === count - 1}
                onClick={() => onMove(1)}
                className={tool}
                aria-label={tr('Нижче')}
            >
                <ArrowDown className="size-3.5" />
            </button>
            <button
                type="button"
                onClick={onRemove}
                className={tool}
                aria-label={tr('Видалити')}
            >
                <Trash2 className="size-3.5" />
            </button>
        </div>
    );
}

/** Налаштування сім’ї → анкета для заявки й чек-лист новачка. */
export function OnboardingSettings({
    action,
    initial,
}: {
    action: string;
    initial: { questions: Question[]; steps: Step[] };
}) {
    const form = useForm({
        questions: initial.questions,
        steps: initial.steps,
    });
    const errors = form.errors as Record<string, string>;
    const firstError = Object.values(errors)[0];
    const setQ = (i: number, patch: Partial<Question>) =>
        form.setData(
            'questions',
            form.data.questions.map((q, j) =>
                j === i ? { ...q, ...patch } : q,
            ),
        );
    const setS = (i: number, patch: Partial<Step>) =>
        form.setData(
            'steps',
            form.data.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
        );

    return (
        <Panel
            title={tr('Анкета й старт новачка')}
            icon={ClipboardList}
            actions={
                <button
                    type="button"
                    disabled={form.processing || !form.isDirty}
                    onClick={() => form.put(action, { preserveScroll: true })}
                    className={btnPrimary}
                >
                    {tr('Зберегти')}
                </button>
            }
        >
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-white">
                        {tr('Анкета для заявки')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Кандидат відповідає на ці питання, коли подає заявку. Відповіді бачать офіцери у вкладці «Заявки».',
                        )}
                    </p>
                    {form.data.questions.map((q, i) => (
                        <div
                            key={q.id || `new-${i}`}
                            className="gc-solid-2 flex flex-wrap items-center gap-2 rounded-2xl p-2"
                        >
                            <input
                                value={q.text}
                                maxLength={160}
                                onChange={(e) =>
                                    setQ(i, { text: e.target.value })
                                }
                                placeholder={tr(
                                    'Напр. Скільки годин на день граєте?',
                                )}
                                aria-label={tr('Питання {n}', { n: i + 1 })}
                                className={cn(
                                    inputClass,
                                    'h-10 min-w-0 flex-1',
                                )}
                            />
                            <label className="flex items-center gap-2 text-xs text-white/60">
                                {tr('Обов’язкове')}
                                <Toggle
                                    checked={q.required}
                                    onChange={(v) => setQ(i, { required: v })}
                                    label={tr('Обов’язкове')}
                                />
                            </label>
                            <RowTools
                                index={i}
                                count={form.data.questions.length}
                                onMove={(d) =>
                                    form.setData(
                                        'questions',
                                        move(form.data.questions, i, d),
                                    )
                                }
                                onRemove={() =>
                                    form.setData(
                                        'questions',
                                        form.data.questions.filter(
                                            (_, j) => j !== i,
                                        ),
                                    )
                                }
                            />
                        </div>
                    ))}
                    {form.data.questions.length < MAX_QUESTIONS && (
                        <button
                            type="button"
                            onClick={() =>
                                form.setData('questions', [
                                    ...form.data.questions,
                                    { id: '', text: '', required: true },
                                ])
                            }
                            className={cn(btnGhost, 'h-9')}
                        >
                            <Plus className="size-4" /> {tr('Додати питання')}
                        </button>
                    )}
                </section>

                <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                        <ListChecks className="size-4 text-emerald-400" />
                        {tr('Чек-лист новачка')}
                    </h3>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Після вступу новачок бачить ці кроки на огляді сім’ї й відмічає виконані. Коли пройде все — офіцерам прийде сповіщення.',
                        )}
                    </p>
                    {form.data.steps.map((s, i) => (
                        <div
                            key={s.id || `new-${i}`}
                            className="gc-solid-2 flex flex-wrap items-center gap-2 rounded-2xl p-2"
                        >
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-xs font-semibold text-white/60 tabular-nums">
                                {i + 1}
                            </span>
                            <input
                                value={s.title}
                                maxLength={120}
                                onChange={(e) =>
                                    setS(i, { title: e.target.value })
                                }
                                placeholder={tr('Напр. Прочитати статут')}
                                aria-label={tr('Крок {n}', { n: i + 1 })}
                                className={cn(
                                    inputClass,
                                    'h-10 min-w-0 flex-1',
                                )}
                            />
                            <input
                                value={s.url ?? ''}
                                maxLength={300}
                                onChange={(e) =>
                                    setS(i, { url: e.target.value || null })
                                }
                                placeholder={tr('Посилання (необов’язково)')}
                                aria-label={tr('Посилання кроку {n}', {
                                    n: i + 1,
                                })}
                                className={cn(
                                    inputClass,
                                    'h-10 min-w-0 basis-full sm:basis-48',
                                )}
                            />
                            <RowTools
                                index={i}
                                count={form.data.steps.length}
                                onMove={(d) =>
                                    form.setData(
                                        'steps',
                                        move(form.data.steps, i, d),
                                    )
                                }
                                onRemove={() =>
                                    form.setData(
                                        'steps',
                                        form.data.steps.filter(
                                            (_, j) => j !== i,
                                        ),
                                    )
                                }
                            />
                        </div>
                    ))}
                    {form.data.steps.length < MAX_STEPS && (
                        <button
                            type="button"
                            onClick={() =>
                                form.setData('steps', [
                                    ...form.data.steps,
                                    { id: '', title: '', url: null },
                                ])
                            }
                            className={cn(btnGhost, 'h-9')}
                        >
                            <Plus className="size-4" /> {tr('Додати крок')}
                        </button>
                    )}
                </section>
            </div>
            {firstError && (
                <p className="mt-3 text-xs text-rose-300">{firstError}</p>
            )}
        </Panel>
    );
}

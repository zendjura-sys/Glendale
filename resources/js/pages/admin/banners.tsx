import { Head, router, useForm } from '@inertiajs/react';
import { Crown, FlaskConical, Pause, Play, Plus, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Tone = 'indigo' | 'sky' | 'emerald' | 'amber' | 'rose';

type Variant = {
    id: number;
    label: string;
    title: string;
    text: string | null;
    cta: string;
    url: string;
    tone: Tone;
    weight: number;
    impressions: number;
    clicks: number;
    ctr: number;
    lift: number | null;
    confidence: number | null;
};

type Banner = {
    id: number;
    name: string;
    placement: string;
    status: 'draft' | 'running' | 'stopped';
    winner_id: number | null;
    created_at: string;
    variants: Variant[];
};

type Props = {
    banners: Banner[];
    placements: Record<string, string>;
    tones: Tone[];
};

type DraftVariant = {
    title: string;
    text: string;
    cta: string;
    url: string;
    tone: Tone;
    weight: number;
};

const TONE_DOT: Record<Tone, string> = {
    indigo: 'bg-indigo-500',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
};

const STATUS: Record<Banner['status'], { label: string; className: string }> = {
    draft: { label: 'Чернетка', className: 'bg-white/[0.08] text-white/70' },
    running: {
        label: 'Іде тест',
        className: 'bg-emerald-500/15 text-emerald-300',
    },
    stopped: { label: 'Зупинено', className: 'bg-white/[0.08] text-white/50' },
};

const blank = (tone: Tone): DraftVariant => ({
    title: '',
    text: '',
    cta: '',
    url: '/',
    tone,
    weight: 50,
});

/** Упевненість словами: 95%+ — можна обирати переможця. */
function verdict(v: Variant): string | null {
    if (v.confidence === null || v.lift === null) return null;
    if (v.confidence >= 95)
        return v.lift > 0 ? tr('Краще за A — можна обирати') : tr('Гірше за A');

    return tr('Поки замало даних');
}

/** Адмінка → Банери й A/B: варіанти, ваги, CTR, упевненість, запуск і переможець. */
export default function Banners({ banners, placements, tones }: Props) {
    const form = useForm<{
        name: string;
        placement: string;
        variants: DraftVariant[];
    }>({
        name: '',
        placement: Object.keys(placements)[0] ?? 'feed',
        variants: [blank('indigo'), blank('sky')],
    });

    const setVariant = (i: number, patch: Partial<DraftVariant>) =>
        form.setData(
            'variants',
            form.data.variants.map((v, k) =>
                k === i ? { ...v, ...patch } : v,
            ),
        );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/banners', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    const status = (b: Banner, next: 'running' | 'stopped') =>
        router.put(
            `/admin/banners/${b.id}/status`,
            { status: next },
            { preserveScroll: true },
        );
    const winner = (b: Banner, v: Variant) => {
        if (
            !window.confirm(
                tr('Зробити варіант {label} єдиним для всіх?', {
                    label: v.label,
                }),
            )
        )
            return;
        router.put(
            `/admin/banners/${b.id}/winner/${v.id}`,
            {},
            { preserveScroll: true },
        );
    };
    const remove = (b: Banner) => {
        if (!window.confirm(tr('Видалити банер «{name}»?', { name: b.name })))
            return;
        router.delete(`/admin/banners/${b.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Банери й A/B — Адмін-панель')} />
            <PageHeader
                title={tr('Банери й A/B-тести')}
                description={tr(
                    'Кожна людина стабільно бачить один варіант. Показ рахується раз на добу, клік — один на людину. Обирайте переможця, коли упевненість 95% і більше.',
                )}
            />

            <form
                onSubmit={submit}
                className="gc-solid mb-6 space-y-3 rounded-2xl p-4"
            >
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder={tr('Назва тесту (бачить лише команда)')}
                        maxLength={80}
                        className="h-10"
                    />
                    <select
                        value={form.data.placement}
                        onChange={(e) =>
                            form.setData('placement', e.target.value)
                        }
                        className="input-glass h-10 rounded-xl px-3 text-sm text-white"
                    >
                        {Object.entries(placements).map(([k, label]) => (
                            <option key={k} value={k}>
                                {tr(label)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                    {form.data.variants.map((v, i) => (
                        <fieldset
                            key={i}
                            className="gc-solid-2 space-y-2 rounded-2xl p-3"
                        >
                            <legend className="px-1 text-xs font-bold text-white/60">
                                {tr('Варіант {label}', {
                                    label: String.fromCharCode(65 + i),
                                })}
                            </legend>
                            <Input
                                value={v.title}
                                onChange={(e) =>
                                    setVariant(i, { title: e.target.value })
                                }
                                placeholder={tr('Заголовок')}
                                maxLength={80}
                                className="h-9 border border-white/10"
                            />
                            <Input
                                value={v.text}
                                onChange={(e) =>
                                    setVariant(i, { text: e.target.value })
                                }
                                placeholder={tr('Текст (необов’язково)')}
                                maxLength={200}
                                className="h-9 border border-white/10"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    value={v.cta}
                                    onChange={(e) =>
                                        setVariant(i, { cta: e.target.value })
                                    }
                                    placeholder={tr('Кнопка')}
                                    maxLength={30}
                                    className="h-9 border border-white/10"
                                />
                                <Input
                                    value={v.url}
                                    onChange={(e) =>
                                        setVariant(i, { url: e.target.value })
                                    }
                                    placeholder="/pricing"
                                    className="h-9 border border-white/10"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    {tones.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            aria-label={t}
                                            onClick={() =>
                                                setVariant(i, { tone: t })
                                            }
                                            className={cn(
                                                'size-6 rounded-full ring-offset-2 ring-offset-[#0b1020]',
                                                TONE_DOT[t],
                                                v.tone === t &&
                                                    'ring-2 ring-white',
                                            )}
                                        />
                                    ))}
                                </div>
                                <label className="ml-auto flex items-center gap-2 text-xs text-white/55">
                                    {tr('Вага')}
                                    <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={v.weight}
                                        onChange={(e) =>
                                            setVariant(i, {
                                                weight:
                                                    Number(e.target.value) || 1,
                                            })
                                        }
                                        className="input-glass h-8 w-16 rounded-lg px-2 text-sm text-white"
                                    />
                                </label>
                                {form.data.variants.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            form.setData(
                                                'variants',
                                                form.data.variants.filter(
                                                    (_, k) => k !== i,
                                                ),
                                            )
                                        }
                                        aria-label={tr('Прибрати варіант')}
                                        className="text-white/40 hover:text-white"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        </fieldset>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    {form.data.variants.length < 4 && (
                        <button
                            type="button"
                            onClick={() =>
                                form.setData('variants', [
                                    ...form.data.variants,
                                    blank(
                                        tones[
                                            form.data.variants.length %
                                                tones.length
                                        ],
                                    ),
                                ])
                            }
                            className="gc-solid-2 inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-white/80"
                        >
                            <Plus className="size-4" />
                            {tr('Ще варіант')}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={form.processing || !form.data.name.trim()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        <FlaskConical className="size-4" />
                        {tr('Створити тест')}
                    </button>
                </div>
                {Object.values(form.errors).length > 0 && (
                    <p className="text-sm text-rose-300">
                        {Object.values(form.errors)[0]}
                    </p>
                )}
            </form>

            {banners.length === 0 ? (
                <EmptyState
                    icon={FlaskConical}
                    title={tr('Тестів ще не було')}
                    text={tr('Створіть банер із двома варіантами вище.')}
                />
            ) : (
                <div className="space-y-4">
                    {banners.map((b) => (
                        <section
                            key={b.id}
                            className="gc-solid rounded-2xl p-4"
                        >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-white">
                                    {b.name}
                                </h2>
                                <span
                                    className={cn(
                                        'rounded-lg px-2 py-1 text-xs font-semibold',
                                        STATUS[b.status].className,
                                    )}
                                >
                                    {tr(STATUS[b.status].label)}
                                </span>
                                <span className="text-xs text-white/40">
                                    {formatDate(b.created_at)}
                                </span>
                                {b.status !== 'running' ? (
                                    <button
                                        type="button"
                                        onClick={() => status(b, 'running')}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-white"
                                    >
                                        <Play className="size-4" />
                                        {tr('Запустити')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => status(b, 'stopped')}
                                        className="gc-solid-2 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/80"
                                    >
                                        <Pause className="size-4" />
                                        {tr('Зупинити')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => remove(b)}
                                    aria-label={tr('Видалити')}
                                    className="grid size-9 place-items-center rounded-xl text-white/40 hover:bg-white/[0.06] hover:text-white"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-white/45">
                                            <th className="pb-2 font-medium">
                                                {tr('Варіант')}
                                            </th>
                                            <th className="px-3 pb-2 text-right font-medium">
                                                {tr('Вага')}
                                            </th>
                                            <th className="px-3 pb-2 text-right font-medium">
                                                {tr('Покази')}
                                            </th>
                                            <th className="px-3 pb-2 text-right font-medium">
                                                {tr('Кліки')}
                                            </th>
                                            <th className="px-3 pb-2 text-right font-medium">
                                                CTR
                                            </th>
                                            <th className="px-3 pb-2 text-right font-medium">
                                                {tr('Проти A')}
                                            </th>
                                            <th className="pb-2" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.06]">
                                        {b.variants.map((v) => (
                                            <tr key={v.id}>
                                                <td className="py-2.5 pr-3">
                                                    <span className="flex items-center gap-2">
                                                        <span
                                                            className={cn(
                                                                'grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold text-white',
                                                                TONE_DOT[
                                                                    v.tone
                                                                ],
                                                            )}
                                                        >
                                                            {v.label}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block truncate font-semibold text-white">
                                                                {v.title}
                                                            </span>
                                                            <span className="block truncate text-xs text-white/45">
                                                                {v.cta} →{' '}
                                                                {v.url}
                                                            </span>
                                                        </span>
                                                        {b.winner_id ===
                                                            v.id && (
                                                            <Crown className="size-4 shrink-0 text-amber-300" />
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-white/60 tabular-nums">
                                                    {v.weight}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-white/80 tabular-nums">
                                                    {v.impressions}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-white/80 tabular-nums">
                                                    {v.clicks}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">
                                                    {v.ctr}%
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-xs">
                                                    {v.lift !== null ? (
                                                        <span className="block">
                                                            <span
                                                                className={cn(
                                                                    'font-semibold tabular-nums',
                                                                    v.lift >= 0
                                                                        ? 'text-emerald-300'
                                                                        : 'text-rose-300',
                                                                )}
                                                            >
                                                                {v.lift > 0
                                                                    ? '+'
                                                                    : ''}
                                                                {v.lift}%
                                                            </span>
                                                            <span className="block text-white/45">
                                                                {(v.confidence ??
                                                                    0) >= 99
                                                                    ? tr(
                                                                          'упевненість 99%+',
                                                                      )
                                                                    : tr(
                                                                          'упевненість {p}%',
                                                                          {
                                                                              p:
                                                                                  v.confidence ??
                                                                                  0,
                                                                          },
                                                                      )}{' '}
                                                                · {verdict(v)}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-white/30">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 pl-3 text-right">
                                                    {b.winner_id !== v.id &&
                                                        b.variants.length >
                                                            1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    winner(b, v)
                                                                }
                                                                className="gc-solid-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/80 hover:text-white"
                                                            >
                                                                <Crown className="size-3.5" />
                                                                {tr(
                                                                    'Переможець',
                                                                )}
                                                            </button>
                                                        )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </>
    );
}

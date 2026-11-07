import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Lightbulb, MapPinOff, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader, Toggle } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Entry = { modules: string[]; plugins: string[]; note: string };
type Recommendation = {
    modules: string[];
    plugins: string[];
    reasons: { id: string; label: string; tags: string[] }[];
};
type Feature = {
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    tags: string[];
    group?: string;
};

type Props = {
    countries: { code: string; name: string }[];
    restrictions: Record<string, Entry>;
    modules: Feature[];
    plugins: (Feature & { group: string })[];
    tags: Record<string, string>;
    recommended: Record<string, Recommendation>;
    me: string | null;
};

const flag = (code: string) =>
    String.fromCodePoint(
        0x1f1e6 + code.charCodeAt(0) - 65,
        0x1f1e6 + code.charCodeAt(1) - 65,
    );

const EMPTY: Entry = { modules: [], plugins: [], note: '' };
const NO_RECOMMENDATION: Recommendation = {
    modules: [],
    plugins: [],
    reasons: [],
};

/** Адмінка → Країни → Обмеження: розділи й функції, закриті для відвідувачів із вибраної країни. */
export default function AdminGeoRestrictions({
    countries,
    restrictions,
    modules,
    plugins,
    tags,
    recommended,
    me,
}: Props) {
    const restricted = Object.keys(restrictions);
    const [selected, setSelected] = useState<string | null>(
        restricted[0] ?? me ?? null,
    );
    const [q, setQ] = useState('');
    const form = useForm<Entry>(
        selected ? (restrictions[selected] ?? EMPTY) : EMPTY,
    );
    const byCode = useMemo(
        () => new Map(countries.map((c) => [c.code, c.name])),
        [countries],
    );
    const rec = (selected && recommended[selected]) || NO_RECOMMENDATION;
    const recCount = rec.modules.length + rec.plugins.length;
    const allRecommended =
        recCount > 0 &&
        rec.modules.every((k) => form.data.modules.includes(k)) &&
        rec.plugins.every((k) => form.data.plugins.includes(k));
    const saved = (selected && restrictions[selected]) || EMPTY;
    const dirty =
        [...form.data.modules].sort().join() !==
            [...saved.modules].sort().join() ||
        [...form.data.plugins].sort().join() !==
            [...saved.plugins].sort().join() ||
        form.data.note !== saved.note;

    const found = countries.filter(
        (c) =>
            q === '' ||
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            c.code.toLowerCase() === q.toLowerCase(),
    );

    const pick = (code: string) => {
        setSelected(code);
        form.clearErrors();
        form.setData(restrictions[code] ?? EMPTY);
    };

    const flip = (kind: 'modules' | 'plugins', key: string, on: boolean) =>
        form.setData(
            kind,
            on
                ? [...new Set([...form.data[kind], key])]
                : form.data[kind].filter((k) => k !== key),
        );

    // «Обмежити все рекомендоване»: додає або знімає лише рекомендовані пункти.
    const applyRecommended = (on: boolean) =>
        form.setData({
            ...form.data,
            modules: on
                ? [...new Set([...form.data.modules, ...rec.modules])]
                : form.data.modules.filter((k) => !rec.modules.includes(k)),
            plugins: on
                ? [...new Set([...form.data.plugins, ...rec.plugins])]
                : form.data.plugins.filter((k) => !rec.plugins.includes(k)),
        });

    const groups = [...new Set(plugins.map((p) => p.group))];

    const row = (kind: 'modules' | 'plugins', item: Feature) => {
        const on = form.data[kind].includes(item.key);
        const suggested = rec[kind].includes(item.key);

        return (
            <div
                key={item.key}
                className={cn(
                    'flex items-start gap-3 rounded-2xl px-3 py-2.5',
                    on ? 'bg-rose-500/10' : 'hover:bg-white/[0.04]',
                )}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-white">
                            {tr(item.name)}
                        </span>
                        {suggested && (
                            <span className="rounded-md bg-gc-indigo/20 px-1.5 py-0.5 text-[11px] text-indigo-100">
                                {tr('Рекомендовано')}
                            </span>
                        )}
                        {!item.enabled && (
                            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/45">
                                {tr('Вимкнено для всіх')}
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                        {tr(item.description)}
                    </p>
                    {item.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-white/40"
                                >
                                    {tr(tags[tag] ?? tag)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <Toggle
                    checked={on}
                    onChange={(value) => flip(kind, item.key, value)}
                    label={tr('Обмежити: {name}', { name: tr(item.name) })}
                />
            </div>
        );
    };

    return (
        <>
            <Head title={tr('Обмеження за країнами — адмінка')} />
            <PageHeader
                title={tr('Обмеження за країнами')}
                description={tr(
                    'Відвідувачі з вибраної країни не бачать закритих розділів і функцій — ні на сайті, ні в застосунку. Адміністрацію не обмежуємо. Країну не визначено — обмежень немає.',
                )}
            />
            <Link
                href="/admin/geo"
                className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
            >
                <ArrowLeft className="size-4" /> {tr('Доступ за країнами')}
            </Link>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
                <aside className="space-y-4">
                    <section className="glass rounded-3xl p-4">
                        <h2 className="mb-2 font-display text-sm font-semibold text-white/90">
                            {tr('Країни з обмеженнями')}
                        </h2>
                        {restricted.length === 0 ? (
                            <p className="text-sm text-white/45">
                                {tr(
                                    'Поки що всі розділи доступні в усіх країнах.',
                                )}
                            </p>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {restricted.map((code) => (
                                    <button
                                        key={code}
                                        type="button"
                                        onClick={() => pick(code)}
                                        className={cn(
                                            'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm',
                                            selected === code
                                                ? 'bg-white/[0.08] text-white'
                                                : 'text-white/75 hover:bg-white/[0.05]',
                                        )}
                                    >
                                        <span>{flag(code)}</span>
                                        <span className="flex-1 truncate">
                                            {byCode.get(code) ?? code}
                                        </span>
                                        <span className="text-xs text-white/40 tabular-nums">
                                            {restrictions[code].modules.length +
                                                restrictions[code].plugins
                                                    .length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="glass rounded-3xl p-4">
                        <label className="input-glass mb-2 flex h-10 items-center gap-2 rounded-xl px-3">
                            <Search className="size-4 text-white/40" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={tr('Знайти країну')}
                                className="min-w-0 flex-1 bg-transparent text-sm text-white focus:outline-none"
                            />
                        </label>
                        <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                            {found.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => pick(c.code)}
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm',
                                        selected === c.code
                                            ? 'bg-white/[0.08] text-white'
                                            : 'text-white/70 hover:bg-white/[0.05]',
                                    )}
                                >
                                    <span>{flag(c.code)}</span>
                                    <span className="flex-1 truncate">
                                        {c.name}
                                    </span>
                                    {recommended[c.code] &&
                                        !restrictions[c.code] && (
                                            <Lightbulb
                                                className="size-3.5 text-indigo-200/70"
                                                aria-label={tr(
                                                    'Є рекомендації',
                                                )}
                                            />
                                        )}
                                    <span className="font-mono text-xs text-white/35">
                                        {c.code}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                </aside>

                {selected === null ? (
                    <section className="glass flex flex-col items-center justify-center gap-2 rounded-3xl p-10 text-center">
                        <MapPinOff className="size-8 text-white/30" />
                        <p className="text-sm text-white/55">
                            {tr('Виберіть країну, щоб налаштувати обмеження.')}
                        </p>
                    </section>
                ) : (
                    <div className="space-y-4">
                        <section className="glass rounded-3xl p-4 sm:p-5">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-3xl">
                                    {flag(selected)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="font-display text-lg font-semibold text-white">
                                        {byCode.get(selected) ?? selected}
                                    </h2>
                                    <p className="text-xs text-white/45">
                                        {tr(
                                            'Закрито розділів: {modules}, функцій: {plugins}',
                                            {
                                                modules:
                                                    form.data.modules.length,
                                                plugins:
                                                    form.data.plugins.length,
                                            },
                                        )}
                                    </p>
                                </div>
                            </div>

                            {recCount > 0 && (
                                <div className="mt-4 rounded-2xl bg-gc-indigo/10 p-3">
                                    <p className="flex items-center gap-1.5 text-sm font-medium text-indigo-100">
                                        <Lightbulb className="size-4" />
                                        {tr('Рекомендації')}
                                    </p>
                                    <ul className="mt-1 list-disc pl-5 text-xs text-white/60">
                                        {rec.reasons.map((reason) => (
                                            <li key={reason.id}>
                                                {tr(reason.label)}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mt-1.5 text-[11px] text-white/40">
                                        {tr(
                                            'Це лише підказка: нічого не застосовується без вас. Перевірте актуальні місцеві вимоги.',
                                        )}
                                    </p>
                                    <div className="mt-3 flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            disabled={allRecommended}
                                            onClick={() =>
                                                applyRecommended(true)
                                            }
                                            className="h-9 rounded-xl bg-white/[0.08] px-3 text-sm font-semibold text-white hover:bg-white/[0.12] disabled:opacity-40"
                                        >
                                            {tr('Застосувати рекомендації')}
                                        </button>
                                        <label className="flex items-center gap-2 text-sm text-white/70">
                                            <Toggle
                                                checked={allRecommended}
                                                onChange={applyRecommended}
                                                label={tr(
                                                    'Обмежити все рекомендоване',
                                                )}
                                            />
                                            {tr('Обмежити все рекомендоване')}
                                        </label>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="glass rounded-3xl p-4 sm:p-5">
                            <h3 className="mb-2 font-display text-sm font-semibold text-white/90">
                                {tr('Розділи')}
                            </h3>
                            <div className="grid grid-cols-1 gap-1 xl:grid-cols-2">
                                {modules.map((item) => row('modules', item))}
                            </div>
                        </section>

                        <section className="glass rounded-3xl p-4 sm:p-5">
                            <h3 className="mb-2 font-display text-sm font-semibold text-white/90">
                                {tr('Функції')}
                            </h3>
                            <div className="space-y-4">
                                {groups.map((group) => (
                                    <div key={group}>
                                        <p className="mb-1 px-3 text-xs text-white/40">
                                            {tr(group)}
                                        </p>
                                        <div className="grid grid-cols-1 gap-1 xl:grid-cols-2">
                                            {plugins
                                                .filter(
                                                    (p) => p.group === group,
                                                )
                                                .map((item) =>
                                                    row('plugins', item),
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="glass rounded-3xl p-4 sm:p-5">
                            <label className="mb-1.5 block text-sm text-white/70">
                                {tr('Нотатка (бачать лише адміністратори)')}
                            </label>
                            <textarea
                                value={form.data.note}
                                onChange={(e) =>
                                    form.setData('note', e.target.value)
                                }
                                maxLength={500}
                                rows={2}
                                className="input-glass w-full rounded-xl px-3 py-2 text-sm text-white"
                            />
                            {(form.errors.modules ||
                                form.errors.plugins ||
                                form.errors.note) && (
                                <p className="mt-2 text-xs text-rose-300">
                                    {form.errors.modules ??
                                        form.errors.plugins ??
                                        form.errors.note}
                                </p>
                            )}
                            <button
                                type="button"
                                disabled={!dirty || form.processing}
                                onClick={() =>
                                    form.put(
                                        `/admin/geo/restrictions/${selected}`,
                                        { preserveScroll: true },
                                    )
                                }
                                className="btn-glow mt-4 h-10 w-full rounded-xl text-sm font-semibold disabled:opacity-40"
                            >
                                {tr('Зберегти')}
                            </button>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}

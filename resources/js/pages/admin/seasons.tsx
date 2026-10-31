import { Head, router } from '@inertiajs/react';
import { Eye, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Pill, selectClass } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { LevelTrack, rewardKind } from '@/components/season/level-track';
import type { PassLevel, Reward, Track } from '@/components/season/level-track';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type RawReward = { type: Reward['type']; value: string } | null;

type Props = {
    current: string;
    seasons: { key: string; saved: boolean }[];
    edit: {
        season: {
            key: string;
            title: string;
            theme: string;
            colors: string[];
        };
        max_level: number;
        saved: boolean;
        levels: number[];
        rewards: Record<string, Partial<Record<Track, RawReward>>>;
    };
    themes: Record<string, { name: string; colors: string[] }>;
    catalog: Record<Reward['type'], Reward[]>;
    defaults: { points_per_level: number };
};

const TYPES: Reward['type'][] = [
    'frame',
    'name',
    'badge',
    'header',
    'stickers',
    'xp',
];

export default function AdminSeasons({
    current,
    seasons,
    edit,
    themes,
    catalog,
    defaults,
}: Props) {
    const [title, setTitle] = useState(edit.season.title);
    const [theme, setTheme] = useState(edit.season.theme);
    const [levels, setLevels] = useState<number[]>(edit.levels);
    const [rewards, setRewards] = useState(edit.rewards);
    const [bulk, setBulk] = useState(String(defaults.points_per_level));
    const [preview, setPreview] = useState(3);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Попередній перегляд доріжки — з поточних значень форми.
    const track = useMemo<PassLevel[]>(() => {
        const find = (raw: RawReward | undefined): Reward | null =>
            raw
                ? (catalog[raw.type]?.find((r) => r.value === raw.value) ??
                  null)
                : null;
        let total = 0;

        return levels.map((cost, i) => {
            total += cost;
            const row = rewards[String(i + 1)] ?? {};

            return {
                level: i + 1,
                cost,
                total,
                free: find(row.free),
                plus: find(row.plus),
                free_claimed: false,
                plus_claimed: false,
            };
        });
    }, [levels, rewards, catalog]);

    const setReward = (level: number, which: Track, encoded: string) => {
        const [type, value] = encoded.split(':');
        setRewards((prev) => ({
            ...prev,
            [String(level)]: {
                ...prev[String(level)],
                [which]: encoded
                    ? { type: type as Reward['type'], value }
                    : null,
            },
        }));
    };

    const save = (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        router.put(
            `/admin/seasons/${edit.season.key}`,
            { title, theme, levels, rewards },
            {
                preserveScroll: true,
                onError: (errs) => setErrors(errs),
                onSuccess: () => setErrors({}),
                onFinish: () => setSaving(false),
            },
        );
    };

    const colors = themes[theme]?.colors ?? edit.season.colors;
    const total = levels.reduce((sum, n) => sum + n, 0);

    return (
        <>
            <Head title={tr('Сезони — Адмін-панель')} />
            <PageHeader
                title={tr('Сезони')}
                description={tr(
                    'Сезонний пропуск: тема місяця, очки за рівні й нагороди безкоштовної доріжки та доріжки GameCon+. Очки сезону люди отримують за щоденні завдання.',
                )}
                actions={
                    <select
                        className={selectClass}
                        value={edit.season.key}
                        onChange={(e) =>
                            router.get(
                                '/admin/seasons',
                                { season: e.target.value },
                                { preserveScroll: true },
                            )
                        }
                    >
                        {seasons.map((s) => (
                            <option key={s.key} value={s.key}>
                                {s.key}
                                {s.key === current
                                    ? ` · ${tr('поточний')}`
                                    : ''}
                                {s.saved ? '' : ` · ${tr('типовий')}`}
                            </option>
                        ))}
                    </select>
                }
            />

            <form onSubmit={save} className="space-y-5">
                <section className="glass grid gap-4 rounded-xl p-5 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                        <span className="text-sm text-white/60">
                            {tr('Назва теми сезону')}
                        </span>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                        />
                        <InputError message={errors.title} />
                    </label>
                    <div className="space-y-1.5">
                        <span className="text-sm text-white/60">
                            {tr('Тема')}
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(themes).map(([key, t]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTheme(key)}
                                    className={cn(
                                        'flex h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm text-white',
                                        theme === key
                                            ? 'border-primary'
                                            : 'border-white/10',
                                    )}
                                >
                                    <span
                                        className="size-4 rounded-full"
                                        style={{
                                            backgroundImage: `linear-gradient(135deg, ${t.colors.join(', ')})`,
                                        }}
                                    />
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="glass rounded-xl p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="font-display text-lg font-bold text-white">
                                {tr('Очки за рівні')}
                            </h2>
                            <p className="text-sm text-white/45">
                                {tr('Усього за сезон: {n} очок', { n: total })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={1}
                                className="w-24"
                                value={bulk}
                                onChange={(e) => setBulk(e.target.value)}
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                    setLevels(
                                        levels.map(() =>
                                            Math.max(1, Number(bulk) || 1),
                                        ),
                                    )
                                }
                            >
                                {tr('Для всіх рівнів')}
                            </Button>
                        </div>
                    </div>
                    <InputError message={errors.levels} />
                </section>

                <section className="glass overflow-x-auto rounded-xl p-5">
                    <h2 className="font-display text-lg font-bold text-white">
                        {tr('Нагороди')}
                    </h2>
                    <table className="mt-3 w-full min-w-[640px] text-sm">
                        <thead className="text-left text-xs text-white/45">
                            <tr>
                                <th className="py-2 pr-3 font-medium">
                                    {tr('Рівень')}
                                </th>
                                <th className="py-2 pr-3 font-medium">
                                    {tr('Очок')}
                                </th>
                                <th className="py-2 pr-3 font-medium">
                                    {tr('Безкоштовно')}
                                </th>
                                <th className="py-2 font-medium">GameCon+</th>
                            </tr>
                        </thead>
                        <tbody>
                            {levels.map((cost, i) => {
                                const level = i + 1;
                                const row = rewards[String(level)] ?? {};

                                return (
                                    <tr
                                        key={level}
                                        className="border-t border-white/[0.06]"
                                    >
                                        <td className="py-1.5 pr-3 font-semibold text-white tabular-nums">
                                            {level}
                                        </td>
                                        <td className="py-1.5 pr-3">
                                            <Input
                                                type="number"
                                                min={1}
                                                className="h-9 w-20"
                                                value={cost}
                                                onChange={(e) =>
                                                    setLevels(
                                                        levels.map((n, j) =>
                                                            j === i
                                                                ? Math.max(
                                                                      1,
                                                                      Number(
                                                                          e
                                                                              .target
                                                                              .value,
                                                                      ) || 1,
                                                                  )
                                                                : n,
                                                        ),
                                                    )
                                                }
                                            />
                                        </td>
                                        {(['free', 'plus'] as Track[]).map(
                                            (which) => (
                                                <td
                                                    key={which}
                                                    className="py-1.5 pr-3"
                                                >
                                                    <select
                                                        className={cn(
                                                            selectClass,
                                                            'h-9 w-full',
                                                        )}
                                                        value={
                                                            row[which]
                                                                ? `${row[which]?.type}:${row[which]?.value}`
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            setReward(
                                                                level,
                                                                which,
                                                                e.target.value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            {tr(
                                                                '— без нагороди',
                                                            )}
                                                        </option>
                                                        {TYPES.map((type) =>
                                                            catalog[type]
                                                                ?.length ? (
                                                                <optgroup
                                                                    key={type}
                                                                    label={rewardKind(
                                                                        type,
                                                                    )}
                                                                >
                                                                    {catalog[
                                                                        type
                                                                    ].map(
                                                                        (r) => (
                                                                            <option
                                                                                key={
                                                                                    r.value
                                                                                }
                                                                                value={`${type}:${r.value}`}
                                                                            >
                                                                                {
                                                                                    r.name
                                                                                }
                                                                            </option>
                                                                        ),
                                                                    )}
                                                                </optgroup>
                                                            ) : null,
                                                        )}
                                                    </select>
                                                    <InputError
                                                        message={
                                                            errors[
                                                                `rewards.${level}.${which}`
                                                            ]
                                                        }
                                                    />
                                                </td>
                                            ),
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </section>

                <section className="glass rounded-xl p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <Eye className="size-5 text-primary" />
                            {tr('Попередній перегляд')}
                        </h2>
                        <label className="flex items-center gap-2 text-sm text-white/60">
                            {tr('Пройдено рівнів')}
                            <input
                                type="range"
                                min={0}
                                max={edit.max_level}
                                value={preview}
                                onChange={(e) =>
                                    setPreview(Number(e.target.value))
                                }
                            />
                            <Pill>{preview}</Pill>
                        </label>
                    </div>
                    <div
                        className="mt-3 rounded-xl p-5"
                        style={{
                            backgroundImage: `linear-gradient(120deg, ${colors.join(', ')})`,
                        }}
                    >
                        <div className="font-display text-2xl font-bold text-white">
                            {title || tr('Без назви')}
                        </div>
                    </div>
                    <div className="mt-3">
                        <LevelTrack levels={track} level={preview} plus />
                    </div>
                </section>

                <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                        <Save className="size-4" />
                        {tr('Зберегти сезон')}
                    </Button>
                </div>
            </form>
        </>
    );
}

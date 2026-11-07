import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Radar, Settings2, UsersRound, X } from 'lucide-react';
import { useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { PARTY_PLATFORMS } from '@/components/party/party-card';
import {
    LANGUAGE_LABELS,
    MatchRow,
    SKILL_LABELS,
    TIME_LABELS,
} from '@/components/party/teammates';
import type { TeammateMatch } from '@/components/party/teammates';
import { clockTime } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Option = { slug: string; name: string };

type Profile = {
    games: Option[];
    languages: string[];
    times: string[];
    skill: string | null;
    platform: string | null;
    mic: boolean;
    note: string | null;
    visible: boolean;
    looking_until: string | null;
};

type Props = {
    profile: Profile | null;
    matches: TeammateMatch[];
    game: Option | null;
    parties: { id: number; title: string }[];
    options: {
        games: Option[];
        times: string[];
        skills: string[];
        languages: string[];
        platforms: string[];
    };
};

function Chip({
    on,
    onClick,
    children,
}: {
    on: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={on}
            className={cn(
                'h-8 rounded-chip px-3 text-sm transition',
                on
                    ? 'bg-primary/20 font-medium text-primary'
                    : 'bg-white/[0.05] text-white/65 hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

function ProfileForm({
    profile,
    options,
    onDone,
}: {
    profile: Profile | null;
    options: Props['options'];
    onDone: () => void;
}) {
    const [games, setGames] = useState<Option[]>(profile?.games ?? []);
    const form = useForm({
        languages: profile?.languages ?? ['uk'],
        times: profile?.times ?? [],
        skill: profile?.skill ?? '',
        platform: profile?.platform ?? '',
        mic: profile?.mic ?? false,
        note: profile?.note ?? '',
        visible: profile?.visible ?? true,
    });
    const toggle = (key: 'languages' | 'times', value: string) =>
        form.setData(
            key,
            form.data[key].includes(value)
                ? form.data[key].filter((item) => item !== value)
                : [...form.data[key], value],
        );
    const label = 'mb-2 block text-xs font-medium text-white/55';

    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault();
                form.transform((data) => ({
                    ...data,
                    games: games.map((game) => game.slug),
                    skill: data.skill || null,
                    platform: data.platform || null,
                }));
                form.put('/party/match/profile', {
                    preserveScroll: true,
                    onSuccess: onDone,
                });
            }}
        >
            <div>
                <span className={label}>{tr('У що граєте (до 8)')}</span>
                <div className="flex flex-wrap gap-1.5">
                    {games.map((game) => (
                        <span
                            key={game.slug}
                            className="inline-flex h-8 items-center gap-1 rounded-chip bg-primary/20 pr-1 pl-3 text-sm font-medium text-primary"
                        >
                            {game.name}
                            <button
                                type="button"
                                aria-label={tr('Прибрати')}
                                onClick={() =>
                                    setGames(
                                        games.filter(
                                            (item) => item.slug !== game.slug,
                                        ),
                                    )
                                }
                                className="grid size-6 place-items-center rounded-full hover:bg-white/10"
                            >
                                <X className="size-3.5" />
                            </button>
                        </span>
                    ))}
                    {games.length < 8 && (
                        <select
                            value=""
                            onChange={(e) => {
                                const game = options.games.find(
                                    (item) => item.slug === e.target.value,
                                );
                                if (game) setGames([...games, game]);
                            }}
                            className={cn(selectClass, 'h-8 min-w-0 text-sm')}
                            aria-label={tr('Додати гру')}
                        >
                            <option value="">{tr('+ Додати гру')}</option>
                            {options.games
                                .filter(
                                    (game) =>
                                        !games.some(
                                            (item) => item.slug === game.slug,
                                        ),
                                )
                                .map((game) => (
                                    <option key={game.slug} value={game.slug}>
                                        {game.name}
                                    </option>
                                ))}
                        </select>
                    )}
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <span className={label}>{tr('Коли граєте')}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {options.times.map((time) => (
                            <Chip
                                key={time}
                                on={form.data.times.includes(time)}
                                onClick={() => toggle('times', time)}
                            >
                                {TIME_LABELS[time] ?? time}
                            </Chip>
                        ))}
                    </div>
                </div>
                <div>
                    <span className={label}>{tr('Мови')}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {options.languages.map((lang) => (
                            <Chip
                                key={lang}
                                on={form.data.languages.includes(lang)}
                                onClick={() => toggle('languages', lang)}
                            >
                                {LANGUAGE_LABELS[lang] ?? lang}
                            </Chip>
                        ))}
                    </div>
                </div>
                <div>
                    <span className={label}>{tr('Рівень гри')}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {options.skills.map((skill) => (
                            <Chip
                                key={skill}
                                on={form.data.skill === skill}
                                onClick={() =>
                                    form.setData(
                                        'skill',
                                        form.data.skill === skill ? '' : skill,
                                    )
                                }
                            >
                                {SKILL_LABELS[skill] ?? skill}
                            </Chip>
                        ))}
                    </div>
                </div>
                <div>
                    <span className={label}>{tr('Платформа')}</span>
                    <select
                        value={form.data.platform}
                        onChange={(e) =>
                            form.setData('platform', e.target.value)
                        }
                        className={cn(selectClass, 'h-10 w-full')}
                        aria-label={tr('Платформа')}
                    >
                        <option value="">{tr('Будь-яка')}</option>
                        {options.platforms.map((platform) => (
                            <option key={platform} value={platform}>
                                {PARTY_PLATFORMS()[platform] ?? platform}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <input
                value={form.data.note}
                maxLength={140}
                onChange={(e) => form.setData('note', e.target.value)}
                placeholder={tr(
                    'Пару слів про себе: роль, стиль гри, ранг (необов’язково)',
                )}
                className="input-glass h-10 w-full rounded-control px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={form.data.mic}
                        onChange={(e) => form.setData('mic', e.target.checked)}
                    />
                    {tr('Граю з мікрофоном')}
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={form.data.visible}
                        onChange={(e) =>
                            form.setData('visible', e.target.checked)
                        }
                    />
                    {tr('Показувати мене в підборі')}
                </label>
            </div>
            <button
                type="submit"
                disabled={form.processing}
                className="btn-glow h-10 rounded-control px-5 text-sm font-semibold disabled:opacity-50"
            >
                {tr('Зберегти анкету')}
            </button>
        </form>
    );
}

export default function TeammateMatch({
    profile,
    matches,
    game,
    parties,
    options,
}: Props) {
    const [editing, setEditing] = useState(profile === null);
    const looking = profile?.looking_until !== null && profile !== null;

    return (
        <>
            <Head title={tr('Підбір тиммейтів')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <Link
                    href="/party"
                    className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Пошук паті')}
                </Link>
                <header className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-white">
                            {tr('Підбір тиммейтів')}
                        </h1>
                        <p className="mt-1 max-w-xl text-sm text-white/55">
                            {tr(
                                'Заповніть анкету — і ми покажемо, з ким вам буде найзручніше грати: спільні ігри, мова, час і рівень.',
                            )}
                        </p>
                    </div>
                    {profile && (
                        <button
                            type="button"
                            onClick={() =>
                                router.post(
                                    '/party/match/looking',
                                    { on: !looking },
                                    { preserveScroll: true },
                                )
                            }
                            className={cn(
                                'inline-flex h-10 items-center gap-2 rounded-control px-4 text-sm font-semibold transition',
                                looking
                                    ? 'bg-primary text-white shadow-[0_0_24px_-6px] shadow-primary'
                                    : 'bg-white/[0.08] text-white hover:bg-white/[0.12]',
                            )}
                        >
                            <Radar
                                className={cn(
                                    'size-4',
                                    looking &&
                                        'animate-pulse motion-reduce:animate-none',
                                )}
                            />
                            {looking
                                ? tr('Шукаю до {time}', {
                                      time: clockTime(profile.looking_until!),
                                  })
                                : tr('Шукаю зараз')}
                        </button>
                    )}
                </header>

                <section className="glass rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-display text-lg font-semibold text-white">
                            {tr('Моя анкета')}
                        </h2>
                        {profile && (
                            <button
                                type="button"
                                onClick={() => setEditing(!editing)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm text-white/60 hover:text-white"
                            >
                                <Settings2 className="size-4" />
                                {editing ? tr('Згорнути') : tr('Змінити')}
                            </button>
                        )}
                    </div>
                    {editing ? (
                        <div className="mt-4">
                            <ProfileForm
                                profile={profile}
                                options={options}
                                onDone={() => setEditing(false)}
                            />
                        </div>
                    ) : (
                        profile && (
                            <p className="mt-2 text-sm text-white/60">
                                {[
                                    profile.games
                                        .map((item) => item.name)
                                        .join(', ') || tr('Ігри не вказано'),
                                    profile.skill
                                        ? SKILL_LABELS[profile.skill]
                                        : null,
                                    profile.times
                                        .map((time) => TIME_LABELS[time])
                                        .join(', ')
                                        .toLowerCase() || null,
                                    profile.visible
                                        ? null
                                        : tr('приховано з підбору'),
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                        )
                    )}
                </section>

                {profile && (
                    <section className="glass rounded-xl p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="font-display text-lg font-semibold text-white">
                                {tr('Вам підходять')}
                            </h2>
                            <select
                                value={game?.slug ?? ''}
                                onChange={(e) =>
                                    router.get(
                                        '/party/match',
                                        e.target.value
                                            ? { game: e.target.value }
                                            : {},
                                        { preserveScroll: true },
                                    )
                                }
                                className={cn(selectClass, 'h-9 min-w-0')}
                                aria-label={tr('Гра')}
                            >
                                <option value="">{tr('Усі мої ігри')}</option>
                                {(profile.games.length > 0
                                    ? profile.games
                                    : options.games
                                ).map((item) => (
                                    <option key={item.slug} value={item.slug}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {matches.length === 0 ? (
                            <div className="mt-4">
                                <EmptyState
                                    icon={UsersRound}
                                    title={tr('Поки нікого')}
                                    text={tr(
                                        'Додайте більше ігор в анкету або увімкніть «Шукаю зараз» — інші побачать вас першими.',
                                    )}
                                />
                            </div>
                        ) : (
                            <div className="mt-1 divide-y divide-white/[0.06]">
                                {matches.map((match) => (
                                    <MatchRow
                                        key={match.user.id}
                                        match={match}
                                        parties={parties}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </>
    );
}

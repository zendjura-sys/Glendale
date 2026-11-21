import { Head, Link, router } from '@inertiajs/react';
import {
    BookOpen,
    Clapperboard,
    Gamepad2,
    Home,
    Lightbulb,
    Mic,
    Music2,
    Newspaper,
    Search as SearchIcon,
    Server,
    Shield,
    Trophy,
    User,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Hit = { kind: string; title: string; hint: string; href: string };

const KINDS: Record<string, [LucideIcon, () => string]> = {
    user: [User, () => tr('Люди')],
    post: [Newspaper, () => tr('Записи')],
    community: [Users, () => tr('Спільноти')],
    game: [Gamepad2, () => tr('Ігри')],
    movie: [Clapperboard, () => tr('Кіно')],
    track: [Music2, () => tr('Музика')],
    server: [Server, () => tr('Сервери')],
    clan: [Shield, () => tr('Клани')],
    family: [Home, () => tr('Сім’ї')],
    article: [BookOpen, () => tr('Статті')],
    guide: [Lightbulb, () => tr('Гайди')],
    tournament: [Trophy, () => tr('Турніри')],
    podcast: [Mic, () => tr('Подкасти')],
};

const url = (q: string, type: string | null) =>
    `/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`;

/**
 * Глобальний пошук (№233): одним запитом по всіх розділах, що є в режимі людини.
 * «Усі» — по кілька з кожного розділу, вкладка — один розділ повністю.
 */
export default function Search({
    q,
    type,
    fixed,
    kinds,
    hits,
}: {
    q: string;
    type: string | null;
    fixed: string | null;
    kinds: string[];
    hits: Hit[];
}) {
    const [value, setValue] = useState(q);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (value.trim().length >= 2) {
            router.get(url(value.trim(), type), {}, { preserveState: true });
        }
    };
    const groups = kinds
        .map((kind) => [kind, hits.filter((hit) => hit.kind === kind)] as const)
        .filter(([, list]) => list.length > 0);

    return (
        <>
            <Head title={q ? tr('Пошук: {q}', { q }) : tr('Пошук')} />
            <div className="mx-auto max-w-3xl space-y-3.5">
                <section className="gc-solid rounded-2xl p-3.5 sm:p-5">
                    <form onSubmit={submit} role="search">
                        <label className="relative block">
                            <span className="sr-only">
                                {tr('Пошук по всьому сайту')}
                            </span>
                            <SearchIcon
                                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-white/45"
                                aria-hidden
                            />
                            <input
                                type="search"
                                value={value}
                                onChange={(event) =>
                                    setValue(event.target.value)
                                }
                                placeholder={tr(
                                    'Люди, записи, ігри, кіно, спільноти…',
                                )}
                                autoFocus={q === ''}
                                className="input-glass h-12 w-full rounded-full pr-4 pl-11 text-base"
                            />
                        </label>
                    </form>
                    {fixed && (
                        <p className="mt-3 text-sm text-white/65">
                            {tr('Показано результати для «{fixed}».', {
                                fixed,
                            })}{' '}
                            <span className="text-white/45">
                                {tr('Схоже, запит набрано не в тій розкладці.')}
                            </span>
                        </p>
                    )}
                    {kinds.length > 0 && (
                        <nav
                            className="gc-segment gc-scroll-x mt-3 max-w-full overflow-x-auto"
                            aria-label={tr('Розділи пошуку')}
                        >
                            {[null, ...kinds].map((kind) => (
                                <Link
                                    key={kind ?? 'all'}
                                    href={url(q, kind)}
                                    preserveState
                                    aria-current={
                                        kind === type ? 'page' : undefined
                                    }
                                    className={cn(
                                        'gc-segment__item shrink-0',
                                        kind === type && 'is-active',
                                    )}
                                >
                                    {kind ? KINDS[kind]?.[1]() : tr('Усі')}
                                </Link>
                            ))}
                        </nav>
                    )}
                </section>

                {q.length >= 2 && hits.length === 0 && (
                    <p className="gc-solid rounded-2xl p-6 text-center text-sm text-white/60">
                        {tr(
                            'За «{q}» нічого не знайшлося. Спробуйте коротше слово чи інше написання.',
                            { q },
                        )}
                    </p>
                )}

                {groups.map(([kind, list]) => {
                    const [Icon, label] = KINDS[kind] ?? [
                        SearchIcon,
                        () => kind,
                    ];
                    return (
                        <section
                            key={kind}
                            className="gc-solid rounded-2xl p-2 sm:p-3"
                            aria-labelledby={`s-${kind}`}
                        >
                            <h2
                                id={`s-${kind}`}
                                className="flex items-center justify-between px-2 pt-1 pb-2 text-sm font-semibold text-white/80"
                            >
                                {label()}
                                {type === null && (
                                    <Link
                                        href={url(q, kind)}
                                        preserveState
                                        className="text-xs font-medium text-[var(--gc-accent)] hover:underline"
                                    >
                                        {tr('Усі в розділі')}
                                    </Link>
                                )}
                            </h2>
                            <ul>
                                {list.map((hit) => (
                                    <li key={`${hit.kind}-${hit.href}`}>
                                        <Link
                                            href={hit.href}
                                            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5"
                                        >
                                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/70">
                                                <Icon
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-white">
                                                    {hit.title}
                                                </span>
                                                <span className="block truncate text-xs text-white/50">
                                                    {tr(hit.hint)}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </>
    );
}

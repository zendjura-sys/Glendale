import { Head, Link } from '@inertiajs/react';
import { Check, Copy, Gift, Share2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

type Props = {
    link: string;
    total: number;
    active: number;
    xp: number;
    ladder: { target: number; reached: boolean }[];
    people: (UserCard & { active: boolean })[];
};

/** Нагорода за кожну сходинку — так само, як бейджі в Achievements. */
const REWARDS = (): Record<number, string> => ({
    1: tr('Бейдж «Запросив друга»'),
    5: tr('Бейдж «Збирач команди»'),
    10: tr('+300 XP до рівня'),
    25: tr('Бейдж «Амбасадор GameCon»'),
});

export default function Invite({
    link,
    total,
    active,
    xp,
    ladder,
    people,
}: Props) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        void navigator.clipboard?.writeText(link);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    };
    const share = () => {
        if (typeof navigator.share === 'function') {
            void navigator
                .share({
                    title: 'GameCon',
                    text: tr('Приєднуйся до мене на GameCon!'),
                    url: link,
                })
                .catch(() => undefined);
        } else {
            copy();
        }
    };

    return (
        <>
            <Head title={tr('Запросити друзів')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <section className="glass rounded-3xl p-5 sm:p-6">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <UserPlus className="size-6 text-gc-lilac-300" />
                        {tr('Запросити друзів')}
                    </h1>
                    <p className="mt-1 text-sm text-white/55">
                        {tr(
                            'Надішліть посилання: хто зареєструється за ним, одразу стане вашим другом. За кожного, хто підтвердить пошту, — 30 XP і бейджі.',
                        )}
                    </p>
                    <div className="mt-4 flex min-w-0 items-center gap-2 rounded-2xl bg-white/[0.05] p-2 pl-4">
                        <code className="min-w-0 flex-1 truncate font-mono text-sm text-white/85">
                            {link}
                        </code>
                        <button
                            type="button"
                            onClick={copy}
                            aria-label={tr('Копіювати')}
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-white transition hover:bg-white/[0.12]"
                        >
                            {copied ? (
                                <Check className="size-4 text-emerald-300" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={share}
                        className="btn-glow mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto"
                    >
                        <Share2 className="size-4" />
                        {tr('Поділитися')}
                    </button>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                        {(
                            [
                                [tr('Прийшли'), total],
                                [tr('Активні'), active],
                                [tr('Досвіду'), xp],
                            ] as const
                        ).map(([label, value]) => (
                            <div
                                key={label}
                                className="min-w-0 rounded-2xl bg-white/[0.04] px-3 py-2.5"
                            >
                                <div className="font-display text-xl font-bold text-white tabular-nums">
                                    {value}
                                </div>
                                <div className="truncate text-xs text-white/45">
                                    {label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="glass rounded-3xl p-5 sm:p-6">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <Gift className="size-5 text-amber-300" />
                        {tr('Нагороди')}
                    </h2>
                    <ol className="mt-3 space-y-2">
                        {ladder.map((step) => (
                            <li
                                key={step.target}
                                className={cn(
                                    'flex items-center gap-3 rounded-2xl px-4 py-3',
                                    step.reached
                                        ? 'bg-emerald-400/[0.07]'
                                        : 'bg-white/[0.03]',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold',
                                        step.reached
                                            ? 'bg-emerald-400/20 text-emerald-100'
                                            : 'bg-white/[0.06] text-white/60',
                                    )}
                                >
                                    {step.reached ? (
                                        <Check className="size-4" />
                                    ) : (
                                        step.target
                                    )}
                                </span>
                                <span className="min-w-0 flex-1 text-sm text-white/80">
                                    {step.target}{' '}
                                    {plural(step.target, [
                                        'активний друг',
                                        'активні друзі',
                                        'активних друзів',
                                    ])}{' '}
                                    — {REWARDS()[step.target]}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>

                {people.length > 0 && (
                    <section className="glass rounded-3xl p-5">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Ви запросили')}
                        </h2>
                        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                            {people.map((person) => (
                                <li key={person.id}>
                                    <Link
                                        href={`/${person.username}`}
                                        className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.05]"
                                    >
                                        <UserAvatar user={person} size="sm" />
                                        <span className="min-w-0 flex-1 truncate text-sm text-white">
                                            {person.name}
                                        </span>
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                                                person.active
                                                    ? 'bg-emerald-400/10 text-emerald-200'
                                                    : 'bg-white/[0.06] text-white/50',
                                            )}
                                        >
                                            {person.active
                                                ? tr('Активний')
                                                : tr('Чекаємо підтвердження')}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
}

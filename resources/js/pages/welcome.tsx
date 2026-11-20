import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    Crown,
    Heart,
    Layers,
    Lock,
    MessageCircle,
    Mic,
    Newspaper,
    Podcast,
    Phone,
    Sparkles,
    UsersRound,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Seasonal } from '@/components/gc/seasonal';
import { SiteFooter } from '@/components/gc/site-footer';
import { UserAvatar } from '@/components/gc/user-avatar';
import { AppPageButton } from '@/components/guest/app-page-button';
import { GuestHeader } from '@/components/guest/guest-header';
import { GlowPillButton } from '@/components/ui/glow-pill-button';
import { SheenPillButton } from '@/components/ui/sheen-pill-button';
import { compactNumber, plural } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { login, register } from '@/routes';
import type { UserCard } from '@/types';

type Props = {
    stats: { users: number; online: number; posts: number };
    members: UserCard[];
    canRegister: boolean;
    tagline?: string;
};

function Reveal({
    children,
    delay = 0,
    className,
}: {
    children: ReactNode;
    delay?: number;
    className?: string;
}) {
    const reduce = useReducedMotion();

    return (
        <m.div
            initial={reduce ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={motionOr(reduce, { ...RISE, delay })}
            className={className}
        >
            {children}
        </m.div>
    );
}

function MockPost() {
    return (
        <div className="w-[330px] rounded-3xl bg-[#181818] p-4 shadow-[0_16px_40px_rgb(0_0_0_/_0.55)] ring-1 ring-white/10">
            <div className="flex items-center gap-3">
                <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-full bg-[#6d6afe] text-sm font-semibold text-white"
                >
                    СМ
                </span>
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">
                        {tr('Софія Мельник')}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#1ed760]">
                        <span className="size-1.5 rounded-full bg-[#3ee0a8]" />
                        {tr('Зараз онлайн')}
                    </div>
                </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#a7a7a7]">
                {tr(
                    'Дякую всім, хто прийшов на вечірню зустріч 🔥 У п’ятницю — новий ефір, приєднуйтесь!',
                )}
            </p>
            <div
                aria-hidden
                className="relative mt-3 aspect-[17/10] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_70%_20%,#6d6afe_0%,#121212_55%,#0a0a0a_100%)]"
            >
                <Sparkles className="absolute top-5 left-6 size-9 text-[#ffd36b]" />
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-[#a7a7a7]">
                <span className="flex items-center gap-1.5 text-[#f3727f]">
                    <Heart className="size-4 fill-current" /> 248
                </span>
                <span className="flex items-center gap-1.5">
                    <MessageCircle className="size-4" /> 36
                </span>
            </div>
        </div>
    );
}

function MockVoice() {
    return (
        <div className="w-[250px] rounded-3xl bg-[#181818] p-4 shadow-[0_16px_40px_rgb(0_0_0_/_0.55)] ring-1 ring-white/10">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
                <Mic className="size-3.5 text-[#1ed760]" />
                {tr('Вечірня розмова о 20:00')}
            </div>
            <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((i) => (
                    <span
                        key={i}
                        className="size-8 rounded-full bg-[#222] ring-2 ring-[#181818]"
                        style={{
                            background: `linear-gradient(135deg,#6d6afe ${i * 20}%,#1f1f1f)`,
                        }}
                    />
                ))}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-[#1ed760]" />
            </div>
        </div>
    );
}

type Tile = {
    icon: typeof Newspaper;
    title: string;
    text: string;
    className?: string;
    extra?: ReactNode;
};

export default function Welcome({
    stats,
    members,
    canRegister,
    tagline,
}: Props) {
    const reduce = useReducedMotion();
    const tiles: Tile[] = [
        {
            icon: Newspaper,
            title: tr('Стрічка й друзі'),
            text: tr(
                'Пости, фото й відео, реакції й живі обговорення. Хто з друзів поруч — видно одразу.',
            ),
            className: 'lg:col-span-2',
        },
        {
            icon: Mic,
            title: tr('Чати й голос'),
            text: tr(
                'Особисті й групові чати, голосові кімнати й дзвінки — для двох або для всієї компанії.',
            ),
        },
        {
            icon: UsersRound,
            title: tr('Спільноти'),
            text: tr(
                'Свої сторінки з правилами, адмінами й подіями. Знайди однодумців або збери власне коло.',
            ),
            extra: (
                <div className="mt-4 space-y-1.5" aria-hidden>
                    {[
                        [tr('Вечірні розмови'), 84],
                        [tr('Фото дня'), 41],
                    ].map(([name, pct]) => (
                        <div key={name as string}>
                            <div className="flex justify-between text-[11px] text-[#a7a7a7]">
                                <span className="flex items-center gap-1">
                                    {name}
                                    {pct === 84 && (
                                        <BadgeCheck className="size-3 text-[#6d6afe]" />
                                    )}
                                </span>
                                <span>{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-[#6d6afe]"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            icon: Crown,
            title: tr('Сім’ї та команди'),
            text: tr(
                'Спільний банк, звіти, чергування й події — штаб для тих, хто тримається разом.',
            ),
        },
        {
            icon: Layers,
            title: tr('Твоє лобі'),
            text: tr(
                'Головна збирається з віджетів, які ти розставляєш сам, а живі кнопки підказують, що відбувається просто зараз.',
            ),
            className: 'lg:col-span-2',
        },
        {
            icon: CalendarDays,
            title: tr('Події'),
            text: tr(
                'Зустрічі, ефіри й сезонні події з нагородами для профілю — нагадаємо вчасно.',
            ),
        },
        {
            icon: Podcast,
            title: 'GameCast',
            text: tr(
                'Живі розмовні ефіри: ведучі, гості й слухачі. Формати 1 на 1, 2 на 2 або свій, #теми й питання з залу.',
            ),
            className: 'lg:col-span-2',
        },
        {
            icon: Phone,
            title: tr('Свій номер'),
            text: tr(
                'Внутрішній номер для дзвінків і повідомлень: випадковий — безкоштовно, красивий — на вибір.',
            ),
            extra: (
                <div
                    className="mt-4 flex items-center gap-2 rounded-full bg-white/[0.05] p-2.5 text-xs ring-1 ring-white/10"
                    aria-hidden
                >
                    <Phone className="size-4 shrink-0 text-[#3ee0a8]" />
                    <span className="flex-1 truncate font-medium text-white/80">
                        +777 (01) 777-77-77
                    </span>
                    <span className="rounded-full bg-[#3ee0a8]/15 px-2 py-0.5 font-semibold text-[#3ee0a8]">
                        {tr('Золотий')}
                    </span>
                </div>
            ),
        },
        {
            icon: Lock,
            title: tr('Приватність'),
            text: tr(
                'Закритий профіль, видимість постів, двофакторний вхід і ключі доступу.',
            ),
        },
    ];

    return (
        <>
            <Head title={tr('Соцмережа, де свої поруч')} />
            <SiteBackground />
            <Seasonal />
            <GuestHeader />

            <main id="main-content" className="relative bg-[#0a0a0a]">
                {/* Arena Black hero — Classy Hero / Spotify theater composition */}
                <section className="relative overflow-hidden px-5 pt-28 pb-20 sm:pt-36">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                'radial-gradient(70% 55% at 50% -10%, rgb(61 139 255 / 0.28) 0%, transparent 60%), radial-gradient(40% 40% at 85% 40%, rgb(30 215 96 / 0.08) 0%, transparent 55%)',
                        }}
                    />
                    <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
                        <m.div
                            initial={reduce ? false : { opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, RISE)}
                        >
                            <p className="font-display text-sm font-semibold tracking-[0.22em] text-[#a7a7a7] uppercase">
                                GameCon
                            </p>
                            <h1 className="mt-5 font-display text-[clamp(3rem,7.5vw,5.6rem)] leading-[0.95] font-semibold tracking-[-0.045em] text-white">
                                {tr('Твої люди.')}
                                <br />
                                <span className="text-[#6d6afe]">
                                    {tr('Твоє місце.')}
                                </span>
                            </h1>
                            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-[#a7a7a7]">
                                {tagline ||
                                    tr(
                                        'Друзі, спільноти й сім’ї, живі чати й голосові кімнати, події та ефіри — усе, щоб завжди бути поруч зі своїми.',
                                    )}
                            </p>

                            <div className="mt-10 flex flex-wrap items-center gap-3">
                                {canRegister && (
                                    <GlowPillButton href={register.url()}>
                                        {tr('Створити акаунт')}
                                        <ArrowRight className="size-4" />
                                    </GlowPillButton>
                                )}
                                <SheenPillButton
                                    href={login.url()}
                                    tone="glass"
                                >
                                    {tr('У мене вже є акаунт')}
                                </SheenPillButton>
                                <AppPageButton className="justify-center sm:justify-start" />
                            </div>

                            <div className="mt-10 flex items-center gap-4">
                                <div className="flex -space-x-2.5">
                                    {members.slice(0, 6).map((mb) => (
                                        <UserAvatar
                                            key={mb.id}
                                            user={mb}
                                            size="sm"
                                            showOnline={false}
                                            className="rounded-full border-2 border-[#0a0a0a]"
                                        />
                                    ))}
                                </div>
                                <div className="text-sm leading-tight">
                                    <div className="font-semibold text-white">
                                        {compactNumber(stats.users)}{' '}
                                        {plural(stats.users, [
                                            'учасник',
                                            'учасники',
                                            'учасників',
                                        ])}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[#a7a7a7]">
                                        <span className="size-1.5 rounded-full bg-[#1ed760]" />
                                        {stats.online} {tr('зараз онлайн')}
                                    </div>
                                </div>
                            </div>
                        </m.div>

                        <div className="relative hidden h-[540px] lg:block">
                            <m.div
                                initial={reduce ? false : { opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={motionOr(reduce, {
                                    ...RISE,
                                    delay: 0.12,
                                })}
                                className="absolute top-8 left-6 z-10"
                            >
                                <MockPost />
                            </m.div>
                            <m.div
                                initial={reduce ? false : { opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={motionOr(reduce, {
                                    ...RISE,
                                    delay: 0.22,
                                })}
                                className="absolute top-0 right-0 z-20"
                            >
                                <MockVoice />
                            </m.div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-10">
                    <Reveal className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-[28px] bg-[#121212] py-7 shadow-[0_12px_32px_rgb(0_0_0_/_0.45)] ring-1 ring-white/10">
                        {[
                            {
                                value: compactNumber(stats.users),
                                label: tr('учасників'),
                            },
                            {
                                value: compactNumber(stats.posts),
                                label: tr('публікацій'),
                            },
                            {
                                value: compactNumber(stats.online),
                                label: tr('онлайн зараз'),
                            },
                        ].map((s) => (
                            <div key={s.label} className="text-center">
                                <div className="font-display text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                                    {s.value}
                                </div>
                                <div className="mt-1 text-xs text-[#a7a7a7]">
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </Reveal>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 py-16">
                    <Reveal className="max-w-2xl">
                        <h2 className="font-display text-[clamp(2rem,4vw,3.1rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-white">
                            {tr('Усе для спілкування — в одному місці')}
                        </h2>
                        <p className="mt-3 text-[#a7a7a7]">
                            {tr(
                                'Від першого «привіт» до вечора з усією компанією: чати, голос, спільноти й події.',
                            )}
                        </p>
                    </Reveal>

                    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {tiles.map((t, i) => (
                            <Reveal
                                key={t.title}
                                delay={Math.min(i, 6) * 0.05}
                                className={cn(
                                    'rounded-[24px] bg-[#121212] p-6 shadow-[0_10px_28px_rgb(0_0_0_/_0.4)] ring-1 ring-white/10 transition hover:ring-white/20',
                                    t.className,
                                )}
                            >
                                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#6d6afe]/15 text-[#a4a6ff]">
                                    <t.icon className="size-5" aria-hidden />
                                </span>
                                <h3 className="mt-4 font-display text-lg font-semibold tracking-[-0.03em] text-white">
                                    {t.title}
                                </h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-[#a7a7a7]">
                                    {t.text}
                                </p>
                                {t.extra}
                            </Reveal>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-16">
                    <Reveal className="grid items-center gap-8 rounded-[28px] bg-[#121212] p-8 shadow-[0_12px_32px_rgb(0_0_0_/_0.45)] ring-1 ring-white/10 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
                        <div>
                            <h2 className="font-display text-[clamp(1.7rem,3vw,2.4rem)] font-semibold tracking-[-0.035em] text-white">
                                {tr('Для лідерів спільнот і сімей')}
                            </h2>
                            <ul className="mt-5 space-y-3 text-sm text-[#a7a7a7]">
                                {[
                                    tr(
                                        'Сторінка спільноти з правилами, адмінами, подіями й власною стіною.',
                                    ),
                                    tr(
                                        'Значок перевіреної спільноти й публічний рейтинг сімей.',
                                    ),
                                    tr(
                                        'Штаб сім’ї: анкета новачка, чергування, спільний банк і підсумки сезону однією картинкою.',
                                    ),
                                ].map((line) => (
                                    <li key={line} className="flex gap-3">
                                        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#6d6afe]" />
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex flex-col items-start gap-3 lg:items-end">
                            <span className="flex items-center gap-2 text-sm text-[#a7a7a7]">
                                <UsersRound className="size-4" />
                                {tr('Безкоштовно для спільнот і сімей')}
                            </span>
                            {canRegister && (
                                <SheenPillButton
                                    href={register.url()}
                                    tone="primary"
                                >
                                    {tr('Створити спільноту')}
                                </SheenPillButton>
                            )}
                        </div>
                    </Reveal>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-24">
                    <Reveal className="relative overflow-hidden rounded-[32px] px-8 py-16 text-center sm:px-16">
                        <div
                            data-on-dark
                            className="absolute inset-0 bg-[#121212]"
                        />
                        <div
                            aria-hidden
                            className="absolute inset-0"
                            style={{
                                background:
                                    'radial-gradient(80% 80% at 50% 0%, rgb(61 139 255 / 0.35) 0%, transparent 55%)',
                            }}
                        />
                        <div data-on-dark className="relative">
                            <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.04em] text-white">
                                {tr('Твої вже тут')}
                            </h2>
                            <p className="mx-auto mt-3 max-w-md text-[#a7a7a7]">
                                {tr(
                                    'Реєстрація займає хвилину. Без реклами в стрічці друзів.',
                                )}
                            </p>
                            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                                {canRegister && (
                                    <SheenPillButton
                                        href={register.url()}
                                        tone="primary"
                                    >
                                        {tr('Приєднатися безкоштовно')}
                                    </SheenPillButton>
                                )}
                                <AppPageButton onDark />
                            </div>
                        </div>
                    </Reveal>
                </section>
            </main>

            <SiteFooter className="py-8" />
        </>
    );
}

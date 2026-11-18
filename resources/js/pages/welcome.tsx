import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    Crown,
    Gamepad2,
    Gift,
    Heart,
    Layers,
    Lock,
    MessageCircle,
    Mic,
    Newspaper,
    Podcast,
    Server,
    Trophy,
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
                    className="flex size-10 items-center justify-center rounded-full bg-[#3d8bff] text-sm font-semibold text-white"
                >
                    СМ
                </span>
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">
                        {tr('Софія Мельник')}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#1ed760]">
                        <Gamepad2 className="size-3" />
                        {tr('Грає в GTA V RP')}
                    </div>
                </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#a7a7a7]">
                {tr(
                    'Сім’я взяла бізвар! Дякую всім, хто був на зборі 🔥 У п’ятницю — турнір, записуйтесь.',
                )}
            </p>
            <div
                aria-hidden
                className="relative mt-3 aspect-[17/10] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_70%_20%,#3d8bff_0%,#121212_55%,#0a0a0a_100%)]"
            >
                <Trophy className="absolute top-5 left-6 size-9 text-[#ffd36b]" />
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
                {tr('Голосовий «Рейд о 20:00»')}
            </div>
            <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((i) => (
                    <span
                        key={i}
                        className="size-8 rounded-full bg-[#222] ring-2 ring-[#181818]"
                        style={{
                            background: `linear-gradient(135deg,#3d8bff ${i * 20}%,#1f1f1f)`,
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

function MockCards() {
    return (
        <div className="flex gap-2">
            {['N', 'R', 'U'].map((r, i) => (
                <div
                    key={r}
                    className="flex h-28 w-20 flex-col justify-between rounded-2xl bg-[#1f1f1f] p-2 shadow-[0_12px_28px_rgb(0_0_0_/_0.5)] ring-1 ring-white/10"
                    style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
                >
                    <span className="text-[10px] font-bold text-[#3d8bff]">
                        {r}
                    </span>
                    <span className="text-[11px] font-semibold text-white/80">
                        GC
                    </span>
                </div>
            ))}
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
                'Пости, моменти з ігор, реакції й обговорення. Хто з друзів зараз грає — видно одразу.',
            ),
            className: 'lg:col-span-2',
        },
        {
            icon: Mic,
            title: tr('Чати й голос'),
            text: tr(
                'Особисті й групові чати, голосові кімнати, дзвінки й трансляції для команди.',
            ),
        },
        {
            icon: Server,
            title: tr('Сервери GTA RP'),
            text: tr(
                'Каталог серверів з онлайном наживо, голосування, відгуки й перевірені сервери.',
            ),
            extra: (
                <div className="mt-4 space-y-1.5" aria-hidden>
                    {[
                        ['Quant RP', 84],
                        ['Ukraine GTA 5', 41],
                    ].map(([name, pct]) => (
                        <div key={name as string}>
                            <div className="flex justify-between text-[11px] text-[#a7a7a7]">
                                <span className="flex items-center gap-1">
                                    {name}
                                    {pct === 84 && (
                                        <BadgeCheck className="size-3 text-[#3d8bff]" />
                                    )}
                                </span>
                                <span>{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-[#3d8bff]"
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
            title: tr('Сім’ї, гільдії й клани'),
            text: tr(
                'Звіти, банк і склад, зміни й події, рейтинг сезону — штаб твоєї команди.',
            ),
        },
        {
            icon: Layers,
            title: tr('Колекційні картки'),
            text: tr(
                'Персонажі ігор і світів — 16 рангів від N до U. Набір щодня, картки за гру, обмін з друзями.',
            ),
            className: 'lg:col-span-2',
            extra: (
                <div className="mt-4 flex justify-end">
                    <MockCards />
                </div>
            ),
        },
        {
            icon: CalendarDays,
            title: tr('Турніри й події'),
            text: tr(
                'Сітки турнірів, ігрові вечори, сезонні події з нагородами для профілю.',
            ),
        },
        {
            icon: Podcast,
            title: 'GameCast',
            text: tr(
                'Живі розмовні ефіри про ігри: ведучі, гості й слухачі. Формати 1 на 1, 2 на 2 або свій, #теми й питання з залу.',
            ),
            className: 'lg:col-span-2',
        },
        {
            icon: Gamepad2,
            title: tr('Ігри й бібліотека'),
            text: tr(
                'Імпорт бібліотеки Steam, список «хочу/граю/пройшов», знижки й безкоштовні роздачі ігор.',
            ),
            extra: (
                <div
                    className="mt-4 flex items-center gap-2 rounded-full bg-white/[0.05] p-2.5 text-xs ring-1 ring-white/10"
                    aria-hidden
                >
                    <Gift className="size-4 shrink-0 text-[#1ed760]" />
                    <span className="flex-1 truncate font-medium text-white/80">
                        {tr('Роздача тижня')}
                    </span>
                    <span className="rounded-full bg-[#1ed760]/15 px-2 py-0.5 font-semibold text-[#1ed760]">
                        −100%
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
            <Head title={tr('Соціальна мережа для гравців')} />
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
                                {tr('Твоя гра.')}
                                <br />
                                <span className="text-[#3d8bff]">
                                    {tr('Твоя команда.')}
                                </span>
                            </h1>
                            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-[#a7a7a7]">
                                {tagline ||
                                    tr(
                                        'Друзі, сервери GTA RP, сім’ї й клани, голосові кімнати, турніри та колекційні картки — усе, що потрібно, щоб грати не самому.',
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
                            <m.div
                                initial={reduce ? false : { opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={motionOr(reduce, {
                                    ...RISE,
                                    delay: 0.32,
                                })}
                                className="absolute right-8 bottom-6 z-20"
                            >
                                <MockCards />
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
                            {tr('Усе для гри разом — в одному місці')}
                        </h2>
                        <p className="mt-3 text-[#a7a7a7]">
                            {tr(
                                'Від першого «го катку?» до турніру сім’ї: чати, сервери, команди й нагороди.',
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
                                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#3d8bff]/15 text-[#7eb6ff]">
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
                                {tr('Для власників серверів і лідерів сімей')}
                            </h2>
                            <ul className="mt-5 space-y-3 text-sm text-[#a7a7a7]">
                                {[
                                    tr(
                                        'Віджет для сайту сервера: онлайн наживо, топ сімей, кнопка голосування.',
                                    ),
                                    tr(
                                        'Значок перевіреного сервера й публічний рейтинг сімей.',
                                    ),
                                    tr(
                                        'Штаб сім’ї: анкета новачка, зміни й чергування, підсумки сезону картинкою для Discord.',
                                    ),
                                ].map((line) => (
                                    <li key={line} className="flex gap-3">
                                        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#3d8bff]" />
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex flex-col items-start gap-3 lg:items-end">
                            <span className="flex items-center gap-2 text-sm text-[#a7a7a7]">
                                <UsersRound className="size-4" />
                                {tr('Безкоштовно для серверів і спільнот')}
                            </span>
                            {canRegister && (
                                <SheenPillButton
                                    href={register.url()}
                                    tone="primary"
                                >
                                    {tr('Додати свій сервер')}
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
                                {tr('Твоя команда вже тут')}
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

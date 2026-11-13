import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    Crown,
    Gamepad2,
    Heart,
    Layers,
    Lock,
    MessageCircle,
    Mic,
    Newspaper,
    Server,
    Sparkles,
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

/** Поява блоку під час прокручування (з урахуванням «менше руху»). */
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
            initial={reduce ? false : { opacity: 0, y: 18 }}
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
        <div className="glass-strong w-[330px] rounded-2xl p-4 shadow-[0_30px_80px_-30px_rgb(10_132_255/0.6)]">
            <div className="flex items-center gap-3">
                {/* Макет без сторонніх картинок: перша сторінка не ходить на чужі сервери. */}
                <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-white"
                >
                    СМ
                </span>
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">
                        {tr('Софія Мельник')}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                        <Gamepad2 className="size-3" />
                        {tr('Грає в GTA V RP')}
                    </div>
                </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/75">
                {tr(
                    'Сім’я взяла бізвар! Дякую всім, хто був на зборі 🔥 У п’ятницю — турнір, записуйтесь.',
                )}
            </p>
            <div
                aria-hidden
                className="relative mt-3 aspect-[17/10] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_75%_25%,#38bdf8_0,#4f46e5_38%,#1e1b4b_70%,#0b1220_100%)]"
            >
                <div className="absolute inset-x-6 bottom-5 h-2 rounded-full bg-white/20" />
                <div className="absolute bottom-5 left-6 h-2 w-2/3 rounded-full bg-white/80" />
                <Trophy className="absolute top-5 left-6 size-9 text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.7)]" />
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                <span className="flex items-center gap-1.5 text-rose-400">
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
        <div className="glass-strong w-[250px] rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/80">
                <Mic className="size-3.5 text-emerald-400" />
                {tr('Голосовий «Рейд о 20:00»')}
            </div>
            <div className="flex -space-x-2">
                {[
                    'from-sky-400 to-blue-600',
                    'from-emerald-400 to-teal-600',
                    'from-violet-400 to-indigo-600',
                    'from-amber-300 to-orange-500',
                ].map((tone, i) => (
                    <span
                        key={tone}
                        aria-hidden
                        className={cn(
                            'size-9 rounded-full border-2 border-[#0b1220] bg-gradient-to-br',
                            tone,
                            i === 1 &&
                                'ring-2 ring-emerald-400 ring-offset-1 ring-offset-transparent',
                        )}
                    />
                ))}
                <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#0b1220] bg-white/10 text-[11px] font-semibold text-white">
                    +6
                </span>
            </div>
            <div className="mt-3 flex items-end gap-0.5" aria-hidden>
                {[6, 14, 9, 18, 11, 7, 15, 10, 5, 12, 16, 8].map((h, i) => (
                    <span
                        key={i}
                        className="w-1.5 rounded-full bg-emerald-400/70"
                        style={{ height: h }}
                    />
                ))}
            </div>
        </div>
    );
}

/** Три колекційні картки віялом без нахилу (як у розділі карток). */
function MockCards() {
    const cards = [
        { rank: 'SR', ring: '#a855f7', name: tr('Снайпер клану'), letter: 'S' },
        {
            rank: 'U',
            ring: '#fde047',
            name: tr('Легенда сервера'),
            letter: 'L',
        },
        { rank: 'S', ring: '#f59e0b', name: tr('Лідер сім’ї'), letter: 'K' },
    ];

    return (
        <div className="flex items-end" aria-hidden>
            {cards.map((c, i) => (
                <div
                    key={c.rank}
                    className={cn(
                        'relative aspect-[5/7] w-24 rounded-xl bg-[#0b1220] p-[3px]',
                        i > 0 && '-ml-7',
                        i === 1 && 'z-10 mb-3 w-28',
                    )}
                    style={{
                        backgroundImage: `linear-gradient(160deg, ${c.ring}, #0b1220 55%, ${c.ring})`,
                        boxShadow: `0 8px 24px ${c.ring}66`,
                    }}
                >
                    <div className="flex size-full flex-col justify-between rounded-[10px] bg-[#0b1220] p-2 text-white">
                        <span
                            className="w-fit rounded bg-black/60 px-1 text-[10px] font-black"
                            style={{ color: c.ring }}
                        >
                            {c.rank}
                        </span>
                        <span className="text-center font-display text-3xl font-black text-white/15">
                            {c.letter}
                        </span>
                        <span className="text-[10px] leading-tight font-semibold">
                            {c.name}
                        </span>
                    </div>
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
                        <div key={name}>
                            <div className="flex justify-between text-[11px] text-white/55">
                                <span className="flex items-center gap-1">
                                    {name}
                                    {pct === 84 && (
                                        <BadgeCheck className="size-3 text-sky-400" />
                                    )}
                                </span>
                                <span>{pct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
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

            <main id="main-content" className="relative">
                <section className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 px-5 pt-32 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-40">
                    <m.div
                        initial={reduce ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={motionOr(reduce, RISE)}
                    >
                        <span className="glass inline-flex items-center gap-2 rounded-chip px-3.5 py-1.5 text-xs font-medium text-white/75">
                            <Sparkles className="size-3.5 text-sky-400" />
                            {tagline || tr('Соцмережа для тих, хто грає разом')}
                        </span>
                        <h1 className="mt-6 font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-[1.02] font-extrabold tracking-tight text-white">
                            {tr('Твоя гра.')}
                            <br />
                            {tr('Твоя команда.')}
                        </h1>
                        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/60">
                            {tr(
                                'Друзі, сервери GTA RP, сім’ї й клани, голосові кімнати, турніри та колекційні картки — усе, що потрібно, щоб грати не самому.',
                            )}
                        </p>

                        <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                            {canRegister && (
                                <Link
                                    href={register()}
                                    className="btn-glow group inline-flex h-13 items-center justify-center gap-2 rounded-2xl px-7 text-[15px] font-semibold"
                                >
                                    {tr('Створити акаунт')}
                                    <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                                </Link>
                            )}
                            <Link
                                href={login()}
                                className="glass inline-flex h-13 items-center justify-center rounded-2xl px-7 text-[15px] font-semibold text-white/85 transition hover:text-white"
                            >
                                {tr('У мене вже є акаунт')}
                            </Link>
                        </div>
                        <AppPageButton className="mt-4" />

                        <div className="mt-9 flex items-center gap-4">
                            <div className="flex -space-x-2.5">
                                {members.slice(0, 6).map((mb) => (
                                    <UserAvatar
                                        key={mb.id}
                                        user={mb}
                                        size="sm"
                                        showOnline={false}
                                        className="rounded-full border-2 border-background"
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
                                <div className="flex items-center gap-1.5 text-white/50">
                                    <span className="size-1.5 rounded-full bg-emerald-400" />
                                    {stats.online} {tr('зараз онлайн')}
                                </div>
                            </div>
                        </div>
                    </m.div>

                    <div className="relative hidden h-[540px] lg:block">
                        <div className="absolute inset-0 m-auto size-[440px] rounded-full bg-sky-500/20 blur-[100px]" />
                        <m.div
                            initial={reduce ? false : { opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, {
                                ...RISE,
                                delay: 0.1,
                            })}
                            className="absolute top-8 left-6 z-10"
                        >
                            <MockPost />
                        </m.div>
                        <m.div
                            initial={reduce ? false : { opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, {
                                ...RISE,
                                delay: 0.2,
                            })}
                            className="absolute top-0 right-0 z-20"
                        >
                            <MockVoice />
                        </m.div>
                        <m.div
                            initial={reduce ? false : { opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={motionOr(reduce, {
                                ...RISE,
                                delay: 0.3,
                            })}
                            className="absolute right-8 bottom-6 z-20"
                        >
                            <MockCards />
                        </m.div>
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-10">
                    <Reveal className="glass grid grid-cols-3 divide-x divide-white/[0.08] rounded-2xl py-6">
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
                                <div className="font-display text-3xl font-bold text-white sm:text-4xl">
                                    {s.value}
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </Reveal>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 py-16">
                    <Reveal className="max-w-2xl">
                        <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] leading-tight font-bold text-white">
                            {tr('Усе для гри разом — в одному місці')}
                        </h2>
                        <p className="mt-3 text-white/55">
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
                                    'glass rounded-2xl p-6',
                                    t.className,
                                )}
                            >
                                <span className="flex size-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                                    <t.icon className="size-5" aria-hidden />
                                </span>
                                <h3 className="mt-4 text-lg font-semibold text-white">
                                    {t.title}
                                </h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                                    {t.text}
                                </p>
                                {t.extra}
                            </Reveal>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-16">
                    <Reveal className="glass-strong grid items-center gap-8 rounded-3xl p-8 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
                        <div>
                            <h2 className="font-display text-[clamp(1.6rem,3vw,2.3rem)] font-bold text-white">
                                {tr('Для власників серверів і лідерів сімей')}
                            </h2>
                            <ul className="mt-5 space-y-3 text-sm text-white/70">
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
                                        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-sky-400" />
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex flex-col items-start gap-3 lg:items-end">
                            <span className="flex items-center gap-2 text-sm text-white/60">
                                <UsersRound className="size-4" />
                                {tr('Безкоштовно для серверів і спільнот')}
                            </span>
                            {canRegister && (
                                <Link
                                    href={register()}
                                    className="btn-glow inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold"
                                >
                                    {tr('Додати свій сервер')}
                                </Link>
                            )}
                        </div>
                    </Reveal>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-24">
                    <Reveal className="relative overflow-hidden rounded-3xl px-8 py-14 text-center sm:px-16">
                        <div
                            data-on-dark
                            className="absolute inset-0"
                            style={{
                                background:
                                    'radial-gradient(120% 140% at 0% 0%, #2563eb 0%, transparent 55%), radial-gradient(90% 120% at 100% 100%, #4f46e5 0%, transparent 60%), #0b1220',
                            }}
                        />
                        <div data-on-dark className="relative">
                            <h2 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold text-white">
                                {tr('Твоя команда вже тут')}
                            </h2>
                            <p className="mx-auto mt-3 max-w-md text-white/70">
                                {tr(
                                    'Реєстрація займає хвилину. Без реклами в стрічці друзів.',
                                )}
                            </p>
                            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                                {canRegister && (
                                    <Link
                                        href={register()}
                                        className="inline-flex h-13 items-center gap-2 rounded-2xl bg-white px-8 text-[15px] font-semibold text-[#0b1220]"
                                    >
                                        {tr('Приєднатися безкоштовно')}
                                    </Link>
                                )}
                                <AppPageButton />
                            </div>
                        </div>
                    </Reveal>
                </section>
            </main>

            <SiteFooter className="py-8" />
        </>
    );
}

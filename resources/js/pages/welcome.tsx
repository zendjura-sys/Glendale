import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarDays,
    Clapperboard,
    Gamepad2,
    Heart,
    ImageIcon,
    MessageCircle,
    Music2,
    Newspaper,
    ShieldCheck,
    Sparkles,
    UsersRound,
} from 'lucide-react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Seasonal } from '@/components/gc/seasonal';
import { Logo } from '@/components/gc/logo';
import { PlayStoreLink } from '@/components/gc/play-store';
import { UserAvatar } from '@/components/gc/user-avatar';
import { compactNumber, plural } from '@/lib/format';
import { login, register } from '@/routes';
import type { UserCard } from '@/types';
import { tr } from '@/lib/i18n';
import { SiteFooter } from '@/components/gc/site-footer';

type Props = {
    stats: { users: number; online: number; posts: number };
    members: UserCard[];
    canRegister: boolean;
    tagline?: string;
};

const FEATURES = [
    {
        icon: Newspaper,
        title: tr('Розумна стрічка'),
        text: tr(
            'Пости друзів і цікаве від спільноти — з фото, реакціями й обговореннями.',
        ),
        tone: 'from-gc-blue to-gc-indigo',
    },
    {
        icon: UsersRound,
        title: tr('Друзі та підписники'),
        text: tr(
            'Заявки, спільні друзі, рекомендації — як ти звик, тільки красивіше.',
        ),
        tone: 'from-gc-indigo to-gc-purple',
    },
    {
        icon: MessageCircle,
        title: tr('Повідомлення'),
        text: tr('Миттєві чати, голосові та групові розмови.'),
        tone: 'from-gc-cyan to-gc-blue',
    },
    {
        icon: Gamepad2,
        title: tr('Ігри та клани'),
        text: tr('Збирай команду, турніри, рейтинги та ігрові профілі.'),
        tone: 'from-gc-purple to-gc-pink',
    },
    {
        icon: Clapperboard,
        title: tr('Кінопортал'),
        text: tr('Тисячі фільмів і серіалів — дивись і обговорюй з друзями.'),
        tone: 'from-gc-pink to-gc-coral',
    },
    {
        icon: ShieldCheck,
        title: tr('Приватність'),
        text: tr('Закритий профіль, видимість постів, 2FA та ключі доступу.'),
        tone: 'from-gc-mint to-gc-cyan',
    },
];

function MockPost() {
    return (
        <div className="glass-strong w-[340px] animate-float rounded-2xl p-4 shadow-[0_30px_80px_-30px_rgb(79_70_229/0.7)]">
            <div className="flex items-center gap-3">
                {/* Макет без сторонніх картинок: перша сторінка не ходить на чужі сервери. */}
                <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-gc-pink to-gc-purple text-sm font-bold text-white ring-2 ring-gc-indigo/60"
                >
                    СМ
                </span>
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">
                        {tr('Софія Мельник')}
                    </div>
                    <div className="text-xs text-white/40">
                        {tr('2 хв тому')}
                    </div>
                </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/75">
                {tr(
                    "Нарешті пройшли рейд усією командою! Хто з нами в п'ятницю? 🔥",
                )}
            </p>
            <div
                aria-hidden
                className="relative mt-3 aspect-[17/10] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_70%_30%,#ff9d5c_0,#c2417a_32%,#3b1d6e_62%,#0d1030_100%)]"
            >
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(170deg,transparent_40%,#0b0d24_41%)] opacity-90" />
                <div className="absolute bottom-[38%] left-[18%] size-10 rounded-full bg-[#ffd9a8] shadow-[0_0_40px_#ffb36b]" />
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                <span className="flex items-center gap-1.5 text-[#ff7ad9]">
                    <Heart className="size-4 fill-current" /> 248
                </span>
                <span className="flex items-center gap-1.5">
                    <MessageCircle className="size-4" /> 36
                </span>
            </div>
        </div>
    );
}

function MockChat() {
    return (
        <div className="glass-strong w-[260px] animate-float rounded-2xl p-4 [animation-delay:-2.5s]">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/80">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />{' '}
                {tr('Команда «Нова Хвиля»')}
            </div>
            <div className="space-y-2 text-[12px]">
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-white/80">
                    {tr('Збираємось о 20:00?')}
                </div>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gradient-brand px-3 py-2 text-white">
                    {tr('Так! Я вже в лобі 🎮')}
                </div>
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-white/80">
                    {tr('Беру мікрофон 🎧')}
                </div>
            </div>
        </div>
    );
}

function MockMovie() {
    return (
        <div className="glass-strong flex w-[250px] animate-float items-center gap-3 rounded-2xl p-3 [animation-delay:-5s]">
            <span
                aria-hidden
                className="h-[72px] w-[52px] shrink-0 rounded-lg bg-[linear-gradient(160deg,#1d2b64_0%,#7a1fa2_55%,#ff6b3d_100%)]"
            />
            <div className="min-w-0">
                <div className="text-xs font-medium text-[#ff9de6]">
                    {tr('Дивляться зараз')}
                </div>
                <div className="truncate text-sm font-semibold text-white">
                    {tr('Нічне місто')}
                </div>
                <div className="mt-1 flex -space-x-1.5">
                    {[
                        'from-gc-blue to-gc-cyan',
                        'from-gc-mint to-gc-blue',
                        'from-gc-purple to-gc-pink',
                    ].map((tone) => (
                        <span
                            key={tone}
                            aria-hidden
                            className={`size-5 rounded-full border border-[#0c1024] bg-gradient-to-br ${tone}`}
                        />
                    ))}
                    <span className="pl-3 text-xs text-white/45">
                        {tr('+12 друзів')}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function Welcome({
    stats,
    members,
    canRegister,
    tagline,
}: Props) {
    return (
        <>
            <Head title={tr('Соціальна мережа для геймерів і кіноманів')} />
            <SiteBackground />
            <Seasonal />

            <header className="fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
                <div className="liquid-glass liquid-glass--dense mx-2 mt-2 flex h-14 items-center gap-3 rounded-2xl px-3 sm:mx-3 sm:px-4 xl:mx-auto xl:max-w-[1240px]">
                    {/* На вузьких екранах (чи з великим системним шрифтом) — лише знак, щоб кнопки не вилазили за край. */}
                    <Logo compact className="min-[400px]:hidden" />
                    <Logo className="max-[399px]:hidden" />
                    <nav className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <Link
                            href={login()}
                            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium whitespace-nowrap text-white/75 transition hover:bg-white/[0.06] hover:text-white sm:px-4"
                        >
                            {tr('Увійти')}
                        </Link>
                        {canRegister && (
                            <Link
                                href={register()}
                                className="btn-glow inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap sm:px-4"
                            >
                                {tr('Реєстрація')}
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <main id="main-content" className="relative">
                <section className="mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 px-5 pt-32 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-40">
                    <div className="animate-rise">
                        <span className="glass inline-flex items-center gap-2 rounded-chip px-3.5 py-1.5 text-xs font-medium text-white/75">
                            <Sparkles className="size-3.5 text-gc-violet-300" />
                            {tagline || tr('Соціальна мережа нового покоління')}
                        </span>
                        <h1 className="mt-6 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[1.02] font-extrabold tracking-tight text-white">
                            {tr('Грай. Дивись.')}
                            <br />
                            <span className="text-gradient">
                                {tr('Спілкуйся.')}
                            </span>
                        </h1>
                        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/55">
                            {tr(
                                'GameCon — місце, де живуть твої друзі, команди, улюблені ігри та кіно. Знайоме з першого кліку, неймовірне з першого погляду.',
                            )}
                        </p>

                        {/* Телефон: кнопки однакової ширини одна під одною, значок Google Play по центру. */}
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
                                className="glass inline-flex h-13 items-center justify-center rounded-2xl px-7 text-[15px] font-semibold text-white/85 transition hover:border-white/20 hover:text-white"
                            >
                                {tr('У мене вже є акаунт')}
                            </Link>
                            <PlayStoreLink className="mt-1 justify-self-center sm:mt-0" />
                        </div>

                        <div className="mt-10 flex items-center gap-4">
                            <div className="flex -space-x-2.5">
                                {members.slice(0, 6).map((m) => (
                                    <UserAvatar
                                        key={m.id}
                                        user={m}
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
                                <div className="flex items-center gap-1.5 text-white/45">
                                    <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
                                    {stats.online} {tr('зараз онлайн')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative hidden h-[560px] lg:block">
                        <div className="absolute inset-0 m-auto size-[460px] rounded-full bg-gradient-brand opacity-25 blur-[90px]" />
                        <div className="absolute top-6 left-8 z-10">
                            <MockPost />
                        </div>
                        <div className="absolute top-0 right-0 z-20">
                            <MockChat />
                        </div>
                        <div className="absolute right-6 bottom-10 z-20">
                            <MockMovie />
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-10">
                    <div className="glass grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl py-6">
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
                                <div className="text-gradient font-display text-3xl font-bold sm:text-4xl">
                                    {s.value}
                                </div>
                                <div className="mt-1 text-xs text-white/40">
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 py-20">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] leading-tight font-bold text-white">
                            {tr('Усе, що ти любиш,')}{' '}
                            <span className="text-gradient">
                                {tr('в одному місці')}
                            </span>
                        </h2>
                        <p className="mt-4 text-white/50">
                            {tr(
                                'Модульна платформа: нові розділи вмикаються без зупинки сайту.',
                            )}
                        </p>
                    </div>

                    <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map(({ icon: Icon, title, text, tone }) => (
                            <div
                                key={title}
                                className="glass group relative overflow-hidden rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15"
                            >
                                <div
                                    className={`absolute -top-16 -right-16 size-40 rounded-full bg-gradient-to-br ${tone} opacity-0 blur-3xl transition duration-500 group-hover:opacity-40`}
                                />
                                <span
                                    className={`relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} shadow-[0_10px_30px_-10px_rgb(109_93_252/0.9)]`}
                                >
                                    <Icon
                                        aria-hidden
                                        className="size-[22px] text-white"
                                    />
                                </span>
                                <h3 className="relative mt-5 flex items-center gap-2 text-lg font-semibold text-white">
                                    {title}
                                </h3>
                                <p className="relative mt-2 text-sm leading-relaxed text-white/50">
                                    {text}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-white/40">
                        {[
                            { icon: ImageIcon, label: tr('Фотоальбоми') },
                            { icon: Music2, label: tr('Музика') },
                            { icon: CalendarDays, label: tr('Події') },
                            { icon: UsersRound, label: tr('Спільноти') },
                        ].map(({ icon: Icon, label }) => (
                            <span
                                key={label}
                                className="glass inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5"
                            >
                                <Icon className="size-3.5" /> {label}
                            </span>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-24">
                    <div className="gradient-border glass-strong relative overflow-hidden rounded-2xl px-8 py-14 text-center sm:px-16">
                        <div className="absolute inset-0 bg-gradient-brand opacity-[0.12]" />
                        <h2 className="relative font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold text-white">
                            {tr('Твоя команда вже тут')}
                        </h2>
                        <p className="relative mx-auto mt-3 max-w-md text-white/55">
                            {tr(
                                'Реєстрація займає хвилину. Без реклами в стрічці друзів.',
                            )}
                        </p>
                        {canRegister && (
                            <Link
                                href={register()}
                                className="btn-glow relative mt-8 inline-flex h-13 items-center gap-2 rounded-2xl px-8 text-[15px] font-semibold text-white"
                            >
                                {tr('Приєднатися безкоштовно')}{' '}
                                <ArrowRight className="size-4" />
                            </Link>
                        )}
                    </div>
                </section>
            </main>

            <SiteFooter className="py-8" />
        </>
    );
}

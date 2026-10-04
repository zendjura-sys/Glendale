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
import { Aurora } from '@/components/gc/aurora';
import { Logo } from '@/components/gc/logo';
import { PlayStoreLink } from '@/components/gc/play-store';
import { UserAvatar } from '@/components/gc/user-avatar';
import { compactNumber, plural } from '@/lib/format';
import { login, register } from '@/routes';
import type { UserCard } from '@/types';

type Props = {
    stats: { users: number; online: number; posts: number };
    members: UserCard[];
    canRegister: boolean;
    tagline?: string;
};

const FEATURES = [
    {
        icon: Newspaper,
        title: 'Розумна стрічка',
        text: 'Пости друзів і цікаве від спільноти — з фото, реакціями й обговореннями.',
        tone: 'from-[#4f8bff] to-[#6d5dfc]',
    },
    {
        icon: UsersRound,
        title: 'Друзі та підписники',
        text: 'Заявки, спільні друзі, рекомендації — як ти звик, тільки красивіше.',
        tone: 'from-[#6d5dfc] to-[#a855f7]',
    },
    {
        icon: MessageCircle,
        title: 'Повідомлення',
        text: 'Миттєві чати, голосові та групові розмови.',
        tone: 'from-[#38e1ff] to-[#4f8bff]',
        soon: true,
    },
    {
        icon: Gamepad2,
        title: 'Ігри та клани',
        text: 'Збирай команду, турніри, рейтинги та ігрові профілі.',
        tone: 'from-[#a855f7] to-[#f04fd8]',
        soon: true,
    },
    {
        icon: Clapperboard,
        title: 'Кінопортал',
        text: 'Тисячі фільмів і серіалів — дивись і обговорюй з друзями.',
        tone: 'from-[#f04fd8] to-[#ff8a5c]',
        soon: true,
    },
    {
        icon: ShieldCheck,
        title: 'Приватність',
        text: 'Закритий профіль, видимість постів, 2FA та ключі доступу.',
        tone: 'from-[#22d3a6] to-[#38e1ff]',
    },
];

function MockPost() {
    return (
        <div className="glass-strong w-[340px] animate-float rounded-3xl p-4 shadow-[0_30px_80px_-30px_rgb(79_70_229/0.7)]">
            <div className="flex items-center gap-3">
                <img
                    src="https://randomuser.me/api/portraits/women/44.jpg"
                    alt=""
                    className="size-10 rounded-full object-cover ring-2 ring-[#6d5dfc]/60"
                />
                <div className="leading-tight">
                    <div className="text-sm font-semibold text-white">
                        Софія Мельник
                    </div>
                    <div className="text-[11px] text-white/40">2 хв тому</div>
                </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-white/75">
                Нарешті пройшли рейд усією командою! Хто з нами в п'ятницю? 🔥
            </p>
            <img
                src="https://picsum.photos/seed/gc-raid/680/400"
                alt=""
                className="mt-3 aspect-[17/10] w-full rounded-2xl object-cover"
            />
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
        <div className="glass-strong w-[260px] animate-float rounded-3xl p-4 [animation-delay:-2.5s]">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/80">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" />{' '}
                Команда «Нова Хвиля»
            </div>
            <div className="space-y-2 text-[12px]">
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-white/80">
                    Збираємось о 20:00?
                </div>
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gradient-brand px-3 py-2 text-white">
                    Так! Я вже в лобі 🎮
                </div>
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.07] px-3 py-2 text-white/80">
                    Беру мікрофон 🎧
                </div>
            </div>
        </div>
    );
}

function MockMovie() {
    return (
        <div className="glass-strong flex w-[250px] animate-float items-center gap-3 rounded-2xl p-3 [animation-delay:-5s]">
            <img
                src="https://picsum.photos/seed/gc-movie/120/170"
                alt=""
                className="h-[72px] w-[52px] rounded-lg object-cover"
            />
            <div className="min-w-0">
                <div className="text-[11px] font-medium tracking-wider text-[#ff9de6] uppercase">
                    Дивляться зараз
                </div>
                <div className="truncate text-sm font-semibold text-white">
                    Нічне місто
                </div>
                <div className="mt-1 flex -space-x-1.5">
                    {[21, 33, 47].map((n) => (
                        <img
                            key={n}
                            src={`https://randomuser.me/api/portraits/thumb/men/${n}.jpg`}
                            alt=""
                            className="size-5 rounded-full border border-[#0c1024]"
                        />
                    ))}
                    <span className="pl-3 text-[11px] text-white/45">
                        +12 друзів
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
            <Head title="Соціальна мережа для геймерів і кіноманів" />
            <Aurora intense />

            <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.05] bg-[#05070f]/50 backdrop-blur-2xl">
                <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-5">
                    <Logo />
                    <nav className="ml-auto flex items-center gap-2">
                        <Link
                            href={login()}
                            className="rounded-xl px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                        >
                            Увійти
                        </Link>
                        {canRegister && (
                            <Link
                                href={register()}
                                className="btn-glow rounded-xl px-4 py-2 text-sm font-semibold text-white"
                            >
                                Реєстрація
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <main className="relative">
                <section className="mx-auto grid max-w-[1240px] items-center gap-14 px-5 pt-32 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-40">
                    <div className="animate-rise">
                        <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/75">
                            <Sparkles className="size-3.5 text-[#a58bff]" />
                            {tagline || 'Соціальна мережа нового покоління'}
                        </span>
                        <h1 className="mt-6 font-display text-[clamp(2.6rem,6vw,5rem)] leading-[1.02] font-extrabold tracking-tight text-white">
                            Грай. Дивись.
                            <br />
                            <span className="text-gradient">Спілкуйся.</span>
                        </h1>
                        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/55">
                            GameCon — місце, де живуть твої друзі, команди,
                            улюблені ігри та кіно. Знайоме з першого кліку,
                            неймовірне з першого погляду.
                        </p>

                        <div className="mt-9 flex flex-wrap items-center gap-3">
                            {canRegister && (
                                <Link
                                    href={register()}
                                    className="btn-glow group inline-flex h-13 items-center gap-2 rounded-2xl px-7 text-[15px] font-semibold text-white"
                                >
                                    Створити акаунт
                                    <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                                </Link>
                            )}
                            <Link
                                href={login()}
                                className="glass inline-flex h-13 items-center rounded-2xl px-7 text-[15px] font-semibold text-white/85 transition hover:border-white/20 hover:text-white"
                            >
                                У мене вже є акаунт
                            </Link>
                            <PlayStoreLink />
                        </div>

                        <div className="mt-10 flex items-center gap-4">
                            <div className="flex -space-x-2.5">
                                {members.slice(0, 6).map((m) => (
                                    <UserAvatar
                                        key={m.id}
                                        user={m}
                                        size="sm"
                                        showOnline={false}
                                        className="rounded-full border-2 border-[#05070f]"
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
                                    {stats.online} зараз онлайн
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
                    <div className="glass grid grid-cols-3 divide-x divide-white/[0.06] rounded-3xl py-6">
                        {[
                            {
                                value: compactNumber(stats.users),
                                label: 'учасників',
                            },
                            {
                                value: compactNumber(stats.posts),
                                label: 'публікацій',
                            },
                            {
                                value: compactNumber(stats.online),
                                label: 'онлайн зараз',
                            },
                        ].map((s) => (
                            <div key={s.label} className="text-center">
                                <div className="text-gradient font-display text-3xl font-bold sm:text-4xl">
                                    {s.value}
                                </div>
                                <div className="mt-1 text-xs tracking-wider text-white/40 uppercase">
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 py-20">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] leading-tight font-bold text-white">
                            Усе, що ти любиш,{' '}
                            <span className="text-gradient">
                                в одному місці
                            </span>
                        </h2>
                        <p className="mt-4 text-white/50">
                            Модульна платформа: нові розділи вмикаються без
                            зупинки сайту.
                        </p>
                    </div>

                    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map(
                            ({ icon: Icon, title, text, tone, soon }) => (
                                <div
                                    key={title}
                                    className="glass group relative overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15"
                                >
                                    <div
                                        className={`absolute -top-16 -right-16 size-40 rounded-full bg-gradient-to-br ${tone} opacity-0 blur-3xl transition duration-500 group-hover:opacity-40`}
                                    />
                                    <span
                                        className={`relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} shadow-[0_10px_30px_-10px_rgb(109_93_252/0.9)]`}
                                    >
                                        <Icon className="size-[22px] text-white" />
                                    </span>
                                    <h3 className="relative mt-5 flex items-center gap-2 text-lg font-semibold text-white">
                                        {title}
                                        {soon && (
                                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-white/45">
                                                Скоро
                                            </span>
                                        )}
                                    </h3>
                                    <p className="relative mt-2 text-sm leading-relaxed text-white/50">
                                        {text}
                                    </p>
                                </div>
                            ),
                        )}
                    </div>

                    <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-white/40">
                        {[
                            { icon: ImageIcon, label: 'Фотоальбоми' },
                            { icon: Music2, label: 'Музика' },
                            { icon: CalendarDays, label: 'Події' },
                            { icon: UsersRound, label: 'Спільноти' },
                        ].map(({ icon: Icon, label }) => (
                            <span
                                key={label}
                                className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                            >
                                <Icon className="size-3.5" /> {label}
                            </span>
                        ))}
                    </div>
                </section>

                <section className="mx-auto max-w-[1240px] px-5 pb-24">
                    <div className="gradient-border glass-strong relative overflow-hidden rounded-[32px] px-8 py-14 text-center sm:px-16">
                        <div className="absolute inset-0 bg-gradient-brand opacity-[0.12]" />
                        <h2 className="relative font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold text-white">
                            Твоя команда вже тут
                        </h2>
                        <p className="relative mx-auto mt-3 max-w-md text-white/55">
                            Реєстрація займає хвилину. Без реклами в стрічці
                            друзів.
                        </p>
                        {canRegister && (
                            <Link
                                href={register()}
                                className="btn-glow relative mt-8 inline-flex h-13 items-center gap-2 rounded-2xl px-8 text-[15px] font-semibold text-white"
                            >
                                Приєднатися безкоштовно{' '}
                                <ArrowRight className="size-4" />
                            </Link>
                        )}
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-white/30">
                <Link href="/terms" className="hover:text-white">
                    Умови
                </Link>
                <span className="px-2 text-white/20">·</span>
                <Link href="/privacy" className="hover:text-white">
                    Конфіденційність
                </Link>
                <p className="mt-2">
                    © {new Date().getFullYear()} GameCon · Соціальна мережа
                    нового покоління
                </p>
            </footer>
        </>
    );
}

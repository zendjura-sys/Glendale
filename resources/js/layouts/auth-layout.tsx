import { Link, usePage } from '@inertiajs/react';
import {
    Clapperboard,
    Gamepad2,
    MessageCircle,
    Sparkles,
    UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Aurora } from '@/components/gc/aurora';
import { Logo } from '@/components/gc/logo';

const FEATURES = [
    {
        icon: UsersRound,
        title: 'Друзі та спільноти',
        text: 'Знаходь своїх людей за інтересами',
    },
    {
        icon: MessageCircle,
        title: 'Стрічка й обговорення',
        text: 'Пости, фото, коментарі та реакції',
    },
    { icon: Gamepad2, title: 'Ігри', text: 'Команди, турніри та ігрові клани' },
    {
        icon: Clapperboard,
        title: 'Кіно й серіали',
        text: 'Дивись разом з друзями',
    },
];

function Showcase() {
    return (
        <div className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
            <Link href="/" className="relative z-10 w-fit">
                <Logo />
            </Link>

            <div className="relative z-10 max-w-xl">
                <span className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white/75">
                    <Sparkles className="size-3.5 text-[#a58bff]" />
                    Соціальна мережа нового покоління
                </span>
                <h2 className="font-display text-[clamp(2.4rem,4.2vw,4rem)] leading-[1.05] font-bold tracking-tight text-white">
                    Твій всесвіт{' '}
                    <span className="text-gradient">ігор, кіно</span> та друзів
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/55">
                    Спілкуйся, діліться моментами, збирай команду і відкривай
                    нове — все в одному місці.
                </p>

                <div className="mt-10 grid grid-cols-2 gap-3">
                    {FEATURES.map(({ icon: Icon, title, text }, i) => (
                        <div
                            key={title}
                            className="glass animate-rise rounded-2xl p-4"
                            style={{ animationDelay: `${120 + i * 90}ms` }}
                        >
                            <span className="mb-3 flex size-9 items-center justify-center rounded-xl bg-gradient-brand shadow-[0_8px_24px_-8px_rgb(109_93_252/0.9)]">
                                <Icon className="size-[18px] text-white" />
                            </span>
                            <div className="text-sm font-semibold text-white">
                                {title}
                            </div>
                            <div className="mt-0.5 text-xs leading-snug text-white/45">
                                {text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="relative z-10 flex items-center gap-4 text-xs text-white/35">
                <div className="flex -space-x-2">
                    {[12, 32, 45, 64, 68].map((n, i) => (
                        <img
                            key={n}
                            src={`https://randomuser.me/api/portraits/thumb/${i % 2 ? 'women' : 'men'}/${n}.jpg`}
                            alt=""
                            className="size-8 rounded-full border-2 border-[#05070f] object-cover"
                            loading="lazy"
                        />
                    ))}
                </div>
                Приєднуйся до спільноти GameCon
            </div>

            <div className="pointer-events-none absolute top-1/2 right-[-12%] size-[520px] -translate-y-1/2 animate-float rounded-full border border-white/[0.06]" />
            <div className="pointer-events-none absolute top-1/2 right-[-4%] size-[360px] -translate-y-1/2 animate-float rounded-full border border-white/[0.05] [animation-delay:-3s]" />
        </div>
    );
}

export default function AuthLayout({
    title = '',
    description = '',
    children,
}: {
    title?: string;
    description?: string;
    children: ReactNode;
}) {
    const { site } = usePage().props;

    return (
        <div className="relative flex min-h-dvh">
            <Aurora intense />
            <Showcase />

            <div className="flex w-full items-center justify-center p-5 sm:p-8 lg:w-[540px] lg:shrink-0 xl:w-[600px]">
                <div className="w-full max-w-[420px]">
                    <Link
                        href="/"
                        className="mb-8 flex justify-center lg:hidden"
                    >
                        <Logo />
                    </Link>

                    <div className="gradient-border glass-strong animate-rise rounded-[28px] p-7 shadow-[0_30px_80px_-30px_rgb(79_70_229/0.55)] sm:p-9">
                        <div className="mb-7">
                            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                                {title}
                            </h1>
                            {description && (
                                <p className="mt-2 text-sm leading-relaxed text-white/50">
                                    {description}
                                </p>
                            )}
                        </div>
                        {children}
                    </div>

                    <p className="mt-6 text-center text-[11px] leading-relaxed text-white/30">
                        <span className="mb-1 flex flex-wrap items-center justify-center gap-x-3">
                            <Link href="/policy" className="hover:text-white/60">
                                Політика
                            </Link>
                            <Link href="/terms" className="hover:text-white/60">
                                Умови
                            </Link>
                            <Link
                                href="/child-safety"
                                className="hover:text-white/60"
                            >
                                Безпека дітей
                            </Link>
                        </span>
                        © {new Date().getFullYear()} {site?.name ?? 'GameCon'}
                    </p>
                </div>
            </div>
        </div>
    );
}

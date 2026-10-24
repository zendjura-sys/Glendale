import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, House, RotateCw } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { LogoMark } from '@/components/gc/logo';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';

/**
 * Сторінка помилки (403, 404, 410, 429, 500, 503) у стилі сайту.
 * Рендериться й тоді, коли спільних даних сторінки немає (маршрут не знайдено), тож бере лише status.
 */
function texts(status: number): { title: string; text: string } {
    switch (status) {
        case 403:
            return {
                title: tr('Немає доступу'),
                text: tr(
                    'Ця сторінка закрита для вас. Можливо, треба увійти іншим акаунтом.',
                ),
            };
        case 404:
        case 410:
            return {
                title: tr('Сторінку не знайдено'),
                text: tr('Можливо, її видалили або в посиланні помилка.'),
            };
        case 429:
            return {
                title: tr('Забагато запитів'),
                text: tr('Зачекайте хвилину й спробуйте знову.'),
            };
        case 503:
            return {
                title: tr('Технічні роботи'),
                text: tr(
                    'Ми оновлюємо GameCon. Повертайтеся за кілька хвилин.',
                ),
            };
        default:
            return {
                title: tr('Щось пішло не так'),
                text: tr(
                    'Ми вже знаємо про помилку й виправляємо. Спробуйте оновити сторінку.',
                ),
            };
    }
}

export default function ErrorPage({
    status,
    message,
}: {
    status: number;
    message?: string | null;
}) {
    const reduce = useReducedMotion();
    const base = texts(status);
    const title = base.title;
    // Пояснення від сервера (розділ закритий для країни відвідувача).
    const text = message ? tr(message) : base.text;
    const retry = status === 429 || status >= 500;

    return (
        <main className="flex min-h-dvh items-center justify-center px-4 py-10">
            <Head title={`${status} · ${title}`} />
            <m.section
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionOr(reduce, RISE)}
                className="glass w-full max-w-md rounded-2xl p-8 text-center"
            >
                <Link href="/" aria-label="GameCon" className="inline-flex">
                    <LogoMark className="size-12" />
                </Link>
                <p className="mt-6 font-display text-6xl font-extrabold tracking-tight text-white tabular-nums">
                    {status}
                </p>
                <h1 className="mt-3 font-display text-xl font-bold text-white">
                    {title}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {text}
                </p>
                <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                    {retry ? (
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="btn-glow inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
                        >
                            <RotateCw className="size-4" />
                            {tr('Оновити сторінку')}
                        </button>
                    ) : (
                        <Link
                            href="/"
                            className="btn-glow inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
                        >
                            <House className="size-4" />
                            {tr('На головну')}
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-5 text-sm font-medium text-white/80 transition hover:bg-white/[0.1]"
                    >
                        <ArrowLeft className="size-4" />
                        {tr('Назад')}
                    </button>
                </div>
            </m.section>
        </main>
    );
}

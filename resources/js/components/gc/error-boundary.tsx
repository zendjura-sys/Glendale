import { House, RotateCw } from 'lucide-react';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { LogoMark } from '@/components/gc/logo';
import { tr } from '@/lib/i18n';

/**
 * Запобіжник: помилка в одному компоненті не гасить увесь сайт у порожній екран.
 * Без fallback показує картку «Щось пішло не так» (як сторінка помилки); fallback={null} — тихо ховає блок.
 */
export class ErrorBoundary extends Component<
    { children: ReactNode; fallback?: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error(error, info.componentStack);
    }

    render(): ReactNode {
        if (!this.state.failed) {
            return this.props.children;
        }

        return this.props.fallback !== undefined ? (
            this.props.fallback
        ) : (
            <CrashCard />
        );
    }
}

/** Без Inertia й анімацій: має відмалюватися, навіть коли зламалося саме це. */
function CrashCard() {
    return (
        <main className="flex min-h-dvh items-center justify-center px-4 py-10">
            <section
                role="alert"
                className="glass w-full max-w-md rounded-3xl p-8 text-center"
            >
                <a href="/" aria-label="GameCon" className="inline-flex">
                    <LogoMark className="size-12" />
                </a>
                <h1 className="mt-6 font-display text-xl font-bold text-white">
                    {tr('Щось пішло не так')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {tr(
                        'Ми вже знаємо про помилку й виправляємо. Спробуйте оновити сторінку.',
                    )}
                </p>
                <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="btn-glow inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
                    >
                        <RotateCw className="size-4" />
                        {tr('Оновити сторінку')}
                    </button>
                    <a
                        href="/"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-5 text-sm font-medium text-white/80 transition hover:bg-white/[0.1]"
                    >
                        <House className="size-4" />
                        {tr('На головну')}
                    </a>
                </div>
            </section>
        </main>
    );
}

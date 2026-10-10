import { BellOff, BellRing } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useWebPush } from '@/lib/web-push';

/** Кнопка-перемикач у шапці списку сповіщень. */
export function WebPushButton() {
    const push = useWebPush();
    if (!push.supported || push.permission === 'denied') return null;
    const label = push.subscribed
        ? tr('Вимкнути сповіщення в браузері')
        : tr('Сповіщення в браузері');

    return (
        <button
            type="button"
            disabled={push.busy}
            onClick={() => (push.subscribed ? push.disable() : push.enable())}
            title={label}
            aria-label={label}
            aria-pressed={push.subscribed}
            className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition disabled:opacity-50',
                push.subscribed
                    ? 'text-white/50 hover:bg-white/[0.06] hover:text-white'
                    : 'bg-gc-indigo/20 text-[#c4b5fd] hover:bg-gc-indigo/30',
            )}
        >
            {push.subscribed ? (
                <BellOff className="size-3.5" />
            ) : (
                <BellRing className="size-3.5" />
            )}
            {!push.subscribed && tr('У браузері')}
        </button>
    );
}

/** Картка в налаштуваннях: стан і пояснення, якщо браузер не дозволяє. */
export function WebPushSettings() {
    const push = useWebPush();
    let hint: string;
    if (!push.supported) {
        hint = tr(
            'Цей браузер не підтримує сповіщення сайту. На iPhone спершу додайте сайт на головний екран.',
        );
    } else if (push.permission === 'denied') {
        hint = tr(
            'Сповіщення заблоковані в налаштуваннях браузера для цього сайту. Дозвольте їх там і поверніться сюди.',
        );
    } else if (push.subscribed) {
        hint = tr(
            'Увімкнено на цьому пристрої: лайки, коментарі, заявки й повідомлення приходитимуть, навіть коли вкладку закрито.',
        );
    } else {
        hint = tr(
            'Отримуйте сповіщення сайту, навіть коли вкладку закрито. Налаштовується окремо на кожному пристрої.',
        );
    }

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-white/60">{hint}</p>
            {push.supported && push.permission !== 'denied' && (
                <button
                    type="button"
                    disabled={push.busy}
                    onClick={() =>
                        push.subscribed ? push.disable() : push.enable()
                    }
                    className={cn(
                        'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto',
                        push.subscribed
                            ? 'bg-white/[0.06] text-white'
                            : 'btn-glow',
                    )}
                >
                    {push.subscribed ? (
                        <BellOff className="size-4" />
                    ) : (
                        <BellRing className="size-4" />
                    )}
                    {push.subscribed ? tr('Вимкнути') : tr('Увімкнути')}
                </button>
            )}
            {push.error && (
                <p className="text-xs text-rose-300">{push.error}</p>
            )}
        </div>
    );
}

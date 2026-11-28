import { BellOff, BellRing } from 'lucide-react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { needsHomeScreen, useWebPush } from '@/lib/web-push';
import { useState } from 'react';

/** Кнопка-перемикач у шапці списку сповіщень. */
export function WebPushButton() {
    const push = useWebPush();
    const [howTo, setHowTo] = useState(false);
    // iPhone у Safari: замість кнопки — як додати сайт на головний екран (№230).
    if (needsHomeScreen()) {
        return (
            <span className="relative">
                <button
                    type="button"
                    onClick={() => setHowTo((v) => !v)}
                    aria-expanded={howTo}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gc-indigo/20 px-2.5 text-xs font-medium text-[#c4b5fd] transition hover:bg-gc-indigo/30"
                >
                    <BellRing className="size-3.5" />
                    {tr('Як увімкнути')}
                </button>
                {howTo && <IosHowTo />}
            </span>
        );
    }
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
                    ? 'text-white/50 hover:bg-[var(--gc-l3)] hover:text-white'
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
    if (needsHomeScreen()) {
        hint = tr(
            'На iPhone сповіщення сайту працюють, коли GameCon додано на головний екран: «Поділитися» → «На початковий екран», відкрийте GameCon з іконки й увімкніть тут.',
        );
    } else if (!push.supported) {
        hint = tr(
            'Цей браузер не підтримує сповіщення сайту. Спробуйте Chrome, Edge, Firefox чи Safari.',
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
                        push.subscribed ? 'gc-solid-2 text-white' : 'btn-glow',
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
            {push.error && <p className="text-xs text-red-400">{push.error}</p>}
        </div>
    );
}

/** Три кроки для iPhone: додати GameCon на головний екран і ввімкнути сповіщення. */
function IosHowTo() {
    return (
        <ol className="absolute top-full right-0 z-50 mt-2 w-72 list-decimal space-y-1.5 rounded-2xl bg-[var(--gc-l1)] p-4 pl-8 text-sm text-[var(--gc-text)] shadow-xl ring-1 ring-[var(--gc-hairline)]">
            <li>{tr('Натисніть «Поділитися» внизу Safari.')}</li>
            <li>{tr('Оберіть «На початковий екран» і «Додати».')}</li>
            <li>
                {tr(
                    'Відкрийте GameCon з іконки на екрані й натисніть «У браузері» в сповіщеннях.',
                )}
            </li>
        </ol>
    );
}

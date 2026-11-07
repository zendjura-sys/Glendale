import { Link, usePage } from '@inertiajs/react';
import { Shield, ShieldCheck, Siren } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { duration } from '@/components/alerts/alert-utils';
import type { AlertPrefs, AlertState } from '@/components/alerts/alert-utils';

/**
 * Плашка тривоги для людей з України: коли в обраній області тривога — таймер,
 * кнопка «В укритті» й перехід на мапу. Стан оновлюється раз на 30 с.
 */
export function AlertBanner() {
    const available = usePage().props.airAlerts === true;
    const component = usePage().component;
    const reduce = useReducedMotion();
    const [data, setData] = useState<
        (AlertState & { prefs: AlertPrefs }) | null
    >(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!available) return;
        const load = () =>
            api<AlertState & { prefs: AlertPrefs }>('GET', '/alerts/state')
                .then(setData)
                .catch(() => undefined);
        void load();
        const poll = window.setInterval(load, 30_000);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => {
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [available]);

    const region = data?.regions.find((r) => r.slug === data.prefs.region);
    const show = available && component !== 'alerts/index' && region?.active;

    const shelter = () =>
        api<{ prefs: AlertPrefs }>('PUT', '/alerts/preferences', {
            shelter: !data?.prefs.shelter,
        })
            .then((d) => setData((s) => (s ? { ...s, prefs: d.prefs } : s)))
            .catch(() => undefined);

    return (
        <AnimatePresence>
            {show && region && (
                <m.div
                    initial={reduce ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-white"
                    role="alert"
                >
                    <Siren className="size-5 shrink-0 text-red-400" />
                    <span className="min-w-0 flex-1">
                        <b>{tr('Повітряна тривога')}</b> · {region.name} ·{' '}
                        <span className="tabular-nums">
                            {duration(region.started_at, now)}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={shelter}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/15"
                    >
                        {data?.prefs.shelter ? (
                            <ShieldCheck className="size-4 text-emerald-300" />
                        ) : (
                            <Shield className="size-4" />
                        )}
                        {data?.prefs.shelter
                            ? tr('Я в укритті')
                            : tr('В укритті')}
                    </button>
                    <Link
                        href="/alerts"
                        className="text-xs font-semibold text-red-600 underline underline-offset-4 dark:text-red-400"
                    >
                        {tr('Мапа')}
                    </Link>
                </m.div>
            )}
        </AnimatePresence>
    );
}

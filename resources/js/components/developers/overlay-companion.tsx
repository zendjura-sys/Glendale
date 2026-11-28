import { RotateCcw } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Toggle } from '@/components/gc/admin';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Prefs = {
    preset?: string;
    layout?: string;
    density?: number;
    gamepad?: boolean;
    streamer?: boolean;
};

type State = {
    enabled: boolean;
    prefs: Prefs | [];
    allowed: string[];
    defaults: { layout: string; modules: string[]; density: number };
    presets: string[];
};

/**
 * Компаньйон оверлею: те саме, що шестерня в грі (набір віджетів, розкладка, щільність, геймпад,
 * режим стрімера), але з сайту чи телефона. Що змінювати можна, вирішує розробник гри.
 */
export function OverlayCompanion({ appId }: { appId: number }) {
    const reduce = useReducedMotion();
    const [state, setState] = useState<State | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const url = `/settings/connected-apps/${appId}/overlay-prefs`;

    useEffect(() => {
        api<{ data: State }>('GET', url)
            .then((r) => setState(r.data))
            .catch(() =>
                toast.error(tr('Не вдалося завантажити налаштування')),
            );
    }, [url]);

    if (!state) {
        return (
            <div className="space-y-2 pt-1" aria-busy>
                <span className="skeleton block h-9 rounded-xl" />
                <span className="skeleton block h-9 rounded-xl" />
            </div>
        );
    }

    const prefs: Prefs = Array.isArray(state.prefs) ? {} : state.prefs;
    const can = (key: string) => state.allowed.includes(key);
    // Одразу локально, на сервер — з паузою (повзунок шле багато змін).
    const save = (patch: Prefs) => {
        setState({ ...state, prefs: { ...prefs, ...patch } });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            api<{ data: State }>('PUT', url, { prefs: patch })
                .then((r) => setState(r.data))
                .catch(() => toast.error(tr('Не вдалося зберегти')));
        }, 400);
    };
    const reset = () =>
        api<{ data: State }>('DELETE', url).then((r) => {
            setState(r.data);
            toast.success(tr('Повернули вигляд, який задала гра'));
        });

    const presets: [string, string][] = [
        ['minimal', tr('Мінімум')],
        ['standard', tr('Стандарт')],
        ['full', tr('Усе')],
    ];
    const layouts: [string, string][] = [
        ['unified', tr('Одним вікном')],
        ['separate', tr('Окремо')],
        ['custom', tr('Як у грі')],
    ];
    const density = prefs.density ?? state.defaults.density;

    return (
        <AnimatePresence initial={!reduce}>
            <m.div
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-3 pt-1"
                data-overlay-companion
            >
                <Row label={tr('Що видно в грі')} locked={!can('modules')}>
                    <Seg
                        value={prefs.preset ?? ''}
                        options={presets}
                        disabled={!can('modules')}
                        onChange={(v) => save({ preset: v })}
                    />
                </Row>
                <Row label={tr('Розділи')} locked={!can('modules')}>
                    <Seg
                        value={prefs.layout ?? ''}
                        options={layouts}
                        disabled={!can('modules')}
                        onChange={(v) => save({ layout: v })}
                    />
                </Row>
                <Row
                    label={tr('Щільність скла: {n} %', { n: density })}
                    locked={!can('density')}
                >
                    <input
                        type="range"
                        min={60}
                        max={100}
                        value={density}
                        disabled={!can('density')}
                        onChange={(e) =>
                            save({ density: Number(e.target.value) })
                        }
                        aria-label={tr('Щільність скла')}
                        className="w-full accent-[var(--color-primary)] disabled:opacity-40 sm:w-56"
                    />
                </Row>
                <Row
                    label={tr('Геймпад відкриває панель')}
                    locked={!can('hotkeys')}
                >
                    <Toggle
                        checked={prefs.gamepad ?? true}
                        disabled={!can('hotkeys')}
                        onChange={(v) => save({ gamepad: v })}
                        label={tr('Геймпад відкриває панель')}
                    />
                </Row>
                <Row
                    label={tr('Режим стрімера')}
                    hint={tr(
                        'Ховає імена й повідомлення від глядачів трансляції',
                    )}
                >
                    <Toggle
                        checked={prefs.streamer ?? false}
                        onChange={(v) => save({ streamer: v })}
                        label={tr('Режим стрімера')}
                    />
                </Row>
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 justify-self-start rounded-lg px-2 py-1 text-xs font-medium text-white/60 hover:bg-white/[0.06] hover:text-white"
                >
                    <RotateCcw className="size-3.5" />
                    {tr('Скинути до вигляду гри')}
                </button>
            </m.div>
        </AnimatePresence>
    );
}

function Row({
    label,
    hint,
    locked,
    children,
}: {
    label: string;
    hint?: string;
    locked?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="min-w-0 flex-1 text-sm text-white/75">
                {label}
                {(hint || locked) && (
                    <span className="block text-xs text-white/40">
                        {locked
                            ? tr('Розробник гри не дозволяє це змінювати')
                            : hint}
                    </span>
                )}
            </span>
            {children}
        </div>
    );
}

function Seg({
    value,
    options,
    disabled,
    onChange,
}: {
    value: string;
    options: [string, string][];
    disabled?: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <div
            role="radiogroup"
            className={cn(
                'flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-xl bg-white/[0.05] p-1',
                disabled && 'opacity-40',
            )}
        >
            {options.map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={value === key}
                    disabled={disabled}
                    onClick={() => onChange(key)}
                    className={cn(
                        'h-8 shrink-0 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition',
                        value === key
                            ? 'bg-primary text-white'
                            : 'text-white/60 hover:text-white',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

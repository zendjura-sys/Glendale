import { router } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Gamepad2,
    MessageCircle,
    Mic,
    Music,
    Shield,
    Trophy,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Toggle } from '@/components/gc/admin';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type OverlayConfig = {
    enabled: boolean;
    accent: string;
    logo_url: string | null;
    title: string | null;
    side: 'left' | 'right' | 'top';
    offset: number;
    hotkey: string;
    gamepad: boolean;
    swipe: boolean;
    hide_when_busy: boolean;
    theme: 'dark' | 'light' | 'auto';
    radius: number;
    opacity: number;
    toasts:
        | 'top-right'
        | 'top-left'
        | 'bottom-right'
        | 'bottom-left'
        | 'top'
        | 'off';
    tabs: string[];
};

const TABS: { key: string; label: string; icon: LucideIcon }[] = [
    { key: 'friends', label: 'Друзі', icon: Users },
    { key: 'chat', label: 'Чат', icon: MessageCircle },
    { key: 'voice', label: 'Голос', icon: Mic },
    { key: 'groups', label: 'Клан', icon: Shield },
    { key: 'music', label: 'Музика', icon: Music },
    { key: 'achievements', label: 'Досягнення', icon: Trophy },
];

const ACCENTS = [
    '#4f7cff',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#a855f7',
    '#06b6d4',
];

/** Налаштування оверлею GameCon SDK для однієї гри з живим попереднім переглядом. */
export function OverlayEditor({
    appId,
    appName,
    initial,
    onClose,
}: {
    appId: number;
    appName: string;
    initial: OverlayConfig;
    onClose: () => void;
}) {
    const [cfg, setCfg] = useState<OverlayConfig>(initial);
    const [busy, setBusy] = useState(false);
    const set = <K extends keyof OverlayConfig>(
        key: K,
        value: OverlayConfig[K],
    ) => setCfg((c) => ({ ...c, [key]: value }));
    const toggleTab = (key: string) =>
        set(
            'tabs',
            cfg.tabs.includes(key)
                ? cfg.tabs.filter((t) => t !== key)
                : TABS.map((t) => t.key).filter(
                      (t) => t === key || cfg.tabs.includes(t),
                  ),
        );
    const save = () =>
        router.put(`/developers/apps/${appId}/overlay`, cfg, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });

    return (
        <div className="space-y-4">
            <OverlayPreview cfg={cfg} appName={appName} />
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr('Оверлей у грі')}>
                    <Toggle
                        checked={cfg.enabled}
                        onChange={(v) => set('enabled', v)}
                        label={tr('Оверлей у грі')}
                    />
                </Field>
                <Field label={tr('Тема')}>
                    <Segmented
                        value={cfg.theme}
                        onChange={(v) => set('theme', v)}
                        options={[
                            ['dark', tr('Темна')],
                            ['light', tr('Світла')],
                            ['auto', tr('Як у системі')],
                        ]}
                    />
                </Field>
                <Field label={tr('Колір акценту')}>
                    <div className="flex items-center gap-1.5">
                        {ACCENTS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                aria-label={c}
                                onClick={() => set('accent', c)}
                                className={cn(
                                    'size-6 rounded-full ring-offset-2 ring-offset-transparent transition',
                                    cfg.accent.toLowerCase() === c &&
                                        'ring-2 ring-white/80',
                                )}
                                style={{ background: c }}
                            />
                        ))}
                        <input
                            type="color"
                            value={cfg.accent}
                            onChange={(e) => set('accent', e.target.value)}
                            aria-label={tr('Свій колір')}
                            className="size-7 cursor-pointer rounded-md bg-transparent"
                        />
                    </div>
                </Field>
                <Field label={tr('Де «крапля»')}>
                    <Segmented
                        value={cfg.side}
                        onChange={(v) => set('side', v)}
                        options={[
                            ['left', tr('Ліворуч')],
                            ['top', tr('Згори')],
                            ['right', tr('Праворуч')],
                        ]}
                    />
                </Field>
                <Field label={tr('Положення на краю: {n}%', { n: cfg.offset })}>
                    <input
                        type="range"
                        min={5}
                        max={95}
                        value={cfg.offset}
                        onChange={(e) => set('offset', +e.target.value)}
                        className="w-full"
                        style={{ accentColor: cfg.accent }}
                    />
                </Field>
                <Field label={tr('Заокруглення: {n}px', { n: cfg.radius })}>
                    <input
                        type="range"
                        min={0}
                        max={32}
                        value={cfg.radius}
                        onChange={(e) => set('radius', +e.target.value)}
                        className="w-full"
                        style={{ accentColor: cfg.accent }}
                    />
                </Field>
                <Field
                    label={tr('Непрозорість панелі: {n}%', { n: cfg.opacity })}
                >
                    <input
                        type="range"
                        min={60}
                        max={100}
                        value={cfg.opacity}
                        onChange={(e) => set('opacity', +e.target.value)}
                        className="w-full"
                        style={{ accentColor: cfg.accent }}
                    />
                </Field>
                <Field label={tr('Гаряча клавіша (ПК)')}>
                    <input
                        value={cfg.hotkey}
                        onChange={(e) => set('hotkey', e.target.value)}
                        placeholder="Shift+Tab"
                        className="gc-solid-2 h-9 w-full rounded-lg px-3 font-mono text-sm text-white outline-none"
                    />
                </Field>
                <Field label={tr('Назва в панелі')}>
                    <input
                        value={cfg.title ?? ''}
                        onChange={(e) => set('title', e.target.value || null)}
                        placeholder={appName}
                        maxLength={40}
                        className="gc-solid-2 h-9 w-full rounded-lg px-3 text-sm text-white outline-none"
                    />
                </Field>
                <Field label={tr('Логотип гри (https, квадратний)')}>
                    <input
                        value={cfg.logo_url ?? ''}
                        onChange={(e) =>
                            set('logo_url', e.target.value || null)
                        }
                        placeholder="https://…/logo.png"
                        className="gc-solid-2 h-9 w-full rounded-lg px-3 text-sm text-white outline-none"
                    />
                </Field>
                <Field label={tr('Сповіщення в грі')}>
                    <select
                        value={cfg.toasts}
                        onChange={(e) =>
                            set(
                                'toasts',
                                e.target.value as OverlayConfig['toasts'],
                            )
                        }
                        className="gc-solid-2 h-9 w-full rounded-lg px-2 text-sm text-white outline-none"
                    >
                        <option value="top-right">
                            {tr('Згори праворуч')}
                        </option>
                        <option value="top-left">{tr('Згори ліворуч')}</option>
                        <option value="top">{tr('Згори по центру')}</option>
                        <option value="bottom-right">
                            {tr('Знизу праворуч')}
                        </option>
                        <option value="bottom-left">
                            {tr('Знизу ліворуч')}
                        </option>
                        <option value="off">{tr('Не показувати')}</option>
                    </select>
                </Field>
                <div className="space-y-2 sm:col-span-2">
                    <p className="text-xs text-white/50">{tr('Вкладки')}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {TABS.map(({ key, label, icon: Icon }) => {
                            const on = cfg.tabs.includes(key);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleTab(key)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition',
                                        on
                                            ? 'text-white'
                                            : 'gc-solid-2 text-white/45',
                                    )}
                                    style={
                                        on
                                            ? { background: `${cfg.accent}33` }
                                            : undefined
                                    }
                                >
                                    <Icon className="size-3.5" />
                                    {tr(label)}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Check
                        checked={cfg.gamepad}
                        onChange={(v) => set('gamepad', v)}
                        label={tr(
                            'Кнопка «Додому» на геймпаді відкриває оверлей',
                        )}
                    />
                    <Check
                        checked={cfg.swipe}
                        onChange={(v) => set('swipe', v)}
                        label={tr('Свайп від краю на телефонах і планшетах')}
                    />
                    <Check
                        checked={cfg.hide_when_busy}
                        onChange={(v) => set('hide_when_busy', v)}
                        label={tr(
                            'Ховати «краплю» в бою (гра викликає setBusy(true))',
                        )}
                    />
                </div>
            </div>
            <p className="text-xs text-white/40">
                {tr(
                    'Ігри підхоплюють вигляд при запуску. У коді гри будь-яке значення можна перевизначити.',
                )}
            </p>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]"
                >
                    {tr('Закрити')}
                </button>
                <button
                    type="button"
                    disabled={busy || cfg.tabs.length === 0}
                    onClick={save}
                    className="btn-glow rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
                >
                    {tr('Зберегти оверлей')}
                </button>
            </div>
        </div>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="gc-solid-2 flex min-w-0 flex-col gap-2 rounded-xl p-3">
            <span className="text-xs text-white/50">{label}</span>
            {children}
        </label>
    );
}

function Check({
    checked,
    onChange,
    label,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3 text-sm text-white/75">
            <span>{label}</span>
            <Toggle checked={checked} onChange={onChange} label={label} />
        </div>
    );
}

function Segmented<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: [T, string][];
}) {
    return (
        <div className="flex rounded-lg bg-white/[0.05] p-0.5">
            {options.map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={cn(
                        'flex-1 rounded-md px-2 py-1 text-xs transition',
                        value === key
                            ? 'bg-white/15 text-white'
                            : 'text-white/50 hover:text-white/80',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

/** Як оверлей виглядатиме в грі: «крапля» зі стрілкою на краю екрана, панель, сповіщення. */
export function OverlayPreview({
    cfg,
    appName,
}: {
    cfg: OverlayConfig;
    appName: string;
}) {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(true);
    const light = cfg.theme === 'light';
    const tabs = TABS.filter((t) => cfg.tabs.includes(t.key));
    const panelBg = light
        ? `rgba(248,250,252,${cfg.opacity / 100})`
        : `rgba(12,16,28,${cfg.opacity / 100})`;
    const ink = light ? '#0f172a' : '#ffffff';
    const sub = light ? 'rgba(15,23,42,.55)' : 'rgba(255,255,255,.55)';
    const top = cfg.side === 'top';
    const Arrow = top
        ? ChevronDown
        : (cfg.side === 'left') !== open
          ? ChevronRight
          : ChevronLeft;

    // «Крапля»: виступає з краю, круглий бік — усередину екрана.
    const drop: React.CSSProperties = top
        ? {
              left: `${cfg.offset}%`,
              top: 0,
              transform: 'translateX(-50%)',
              width: 56,
              height: 26,
              borderRadius: '0 0 999px 999px',
          }
        : {
              [cfg.side]: 0,
              top: `${cfg.offset}%`,
              transform: 'translateY(-50%)',
              width: 26,
              height: 56,
              borderRadius:
                  cfg.side === 'left' ? '0 999px 999px 0' : '999px 0 0 999px',
          };
    const panelPos: React.CSSProperties = top
        ? ({ top: 34, left: '50%', x: '-50%' } as React.CSSProperties)
        : ({ [cfg.side]: 34, top: '50%', y: '-50%' } as React.CSSProperties);
    const toastPos: Record<string, React.CSSProperties> = {
        'top-right': { top: 12, right: 12 },
        'top-left': { top: 12, left: 12 },
        top: { top: 12, left: '50%', transform: 'translateX(-50%)' },
        'bottom-right': { bottom: 12, right: 12 },
        'bottom-left': { bottom: 12, left: 12 },
    };

    return (
        <div
            className="relative aspect-video w-full overflow-hidden rounded-2xl"
            style={{
                background:
                    'radial-gradient(120% 90% at 70% 20%, #1e2a4a 0%, #0b1020 55%, #05070d 100%)',
                opacity: cfg.enabled ? 1 : 0.5,
            }}
        >
            {/* умовна гра: HUD-заглушки */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 opacity-40">
                {[0, 1, 2, 3, 4].map((i) => (
                    <span
                        key={i}
                        className="size-7 rounded-md border border-white/20 bg-white/5"
                    />
                ))}
            </div>
            <div className="absolute right-3 bottom-3 h-1.5 w-24 overflow-hidden rounded-full bg-white/10 opacity-60">
                <span className="block h-full w-2/3 bg-emerald-400/70" />
            </div>
            <p className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] tracking-wide text-white/25">
                {tr('Попередній перегляд у грі')}
            </p>

            {cfg.toasts !== 'off' && (
                <div
                    className="absolute flex items-center gap-2 px-3 py-2 text-[11px] shadow-lg"
                    style={{
                        ...toastPos[cfg.toasts],
                        background: panelBg,
                        color: ink,
                        borderRadius: Math.max(8, cfg.radius - 6),
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <Trophy
                        className="size-3.5"
                        style={{ color: cfg.accent }}
                    />
                    {tr('Досягнення: «Перша перемога»')}
                </div>
            )}

            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label={tr('Відкрити оверлей')}
                className="absolute z-10 grid place-items-center text-white shadow-lg"
                style={{ ...drop, background: cfg.accent }}
            >
                <Arrow className="size-4" />
            </button>

            <AnimatePresence>
                {open && (
                    <m.div
                        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="absolute w-[min(60%,260px)] space-y-2 p-3 shadow-2xl"
                        style={{
                            ...panelPos,
                            background: panelBg,
                            color: ink,
                            borderRadius: cfg.radius,
                            backdropFilter: 'blur(18px)',
                        }}
                    >
                        <div className="flex items-center gap-2">
                            {cfg.logo_url ? (
                                <img
                                    src={cfg.logo_url}
                                    alt=""
                                    className="size-6 rounded-md object-cover"
                                />
                            ) : (
                                <span
                                    className="grid size-6 place-items-center rounded-md text-white"
                                    style={{ background: cfg.accent }}
                                >
                                    <Gamepad2 className="size-3.5" />
                                </span>
                            )}
                            <span className="truncate text-xs font-semibold">
                                {cfg.title || appName}
                            </span>
                            <span
                                className="ml-auto text-[9px]"
                                style={{ color: sub }}
                            >
                                GameCon
                            </span>
                        </div>
                        <div className="flex gap-1">
                            {tabs.map(({ key, icon: Icon }, i) => (
                                <span
                                    key={key}
                                    className="grid h-6 flex-1 place-items-center rounded-md"
                                    style={{
                                        background:
                                            i === 0
                                                ? `${cfg.accent}40`
                                                : 'transparent',
                                        color: i === 0 ? cfg.accent : sub,
                                    }}
                                >
                                    <Icon className="size-3.5" />
                                </span>
                            ))}
                        </div>
                        {[
                            ['Сашко', 'У матчі · 12:40'],
                            ['Марта', 'У лобі'],
                            ['Дмитро', 'Онлайн'],
                        ].map(([name, status]) => (
                            <div
                                key={name}
                                className="flex items-center gap-2 text-[11px]"
                            >
                                <span className="size-5 rounded-full bg-white/20" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate">
                                        {name}
                                    </span>
                                    <span
                                        className="block truncate text-[9px]"
                                        style={{ color: sub }}
                                    >
                                        {tr(status)}
                                    </span>
                                </span>
                                <span
                                    className="rounded-full px-2 py-0.5 text-[9px] text-white"
                                    style={{ background: cfg.accent }}
                                >
                                    {tr('Покликати')}
                                </span>
                            </div>
                        ))}
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}

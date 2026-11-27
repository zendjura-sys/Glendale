import { House, LayoutGrid, Maximize2, Minimize2, Minus, PictureInPicture2, Settings, Square, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NotchToggle } from '@/components/NotchedCard';
import { IconButton } from '@/components/ui';
import { ToastHost } from '@/components/kit';
import { PlayerBar } from '@/components/PlayerBar';
import { HomeCarousels } from '@/components/HomeCarousels';
import { useLayout, useSettings } from '@/lib/layout';
import { useNav } from '@/lib/nav';
import { resolvePage } from '@/pages';
import { useMe } from '@/lib/me';
import { availableModules, defaultSize } from '@/modules/registry';
import { SettingsPanel } from './Settings';

/**
 * Режим А — одне безрамочне вікно: тонкий док-рейл ліворуч, своя панель із зоною перетягування,
 * кнопками вікна й Mode-Switch Toggle, а всередині — Bento-сітка обраних модулів.
 */
export function UnifiedView() {
    const layout = useLayout();
    const [settings, saveSettings] = useSettings();
    const { me, sections, plugins } = useMe();
    const [panel, setPanel] = useState(false);
    const modules = availableModules(sections, plugins).filter((m) => settings?.modules.includes(m.id));
    const nav = useNav();
    const page = nav.path ? resolvePage(nav.path) : null;

    return (
        <div className="relative flex h-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.10),transparent_45%),radial-gradient(120%_120%_at_100%_100%,rgba(168,85,247,0.14),transparent_50%)] bg-obsidian-solid/80 ring-1 ring-white/10 backdrop-blur-2xl">
            {/* Док-рейл: великі кнопки з підписом-підказкою праворуч і позначкою активного розділу. */}
            <nav className="drag flex w-[76px] shrink-0 flex-col items-center gap-1.5 border-r border-white/5 py-4">
                <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-violet text-base font-black text-obsidian-solid">G</div>
                <RailButton label="Головна" active={!nav.path} onClick={nav.close}>
                    <House size={21} strokeWidth={1.6} />
                </RailButton>
                <div className="my-1 h-px w-8 bg-white/10" />
                <div className="flex min-h-0 flex-col items-center gap-1.5 overflow-y-auto">
                    {modules.map((m) => (
                        <RailButton
                            key={m.id}
                            label={m.title}
                            active={!!m.page && !!nav.path?.startsWith(m.page)}
                            onClick={() => (m.page ? nav.go(m.page) : (nav.close(), window.setTimeout(() => document.getElementById(`module-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)))}
                        >
                            <m.icon size={21} strokeWidth={1.6} />
                        </RailButton>
                    ))}
                </div>
                <div className="flex-1" />
                <RailButton label="Налаштування" onClick={() => setPanel(true)}>
                    <Settings size={21} strokeWidth={1.6} />
                </RailButton>
            </nav>
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Панель вікна. */}
                <header className="drag flex h-11 shrink-0 items-center gap-3 pl-4">
                    <span className="text-sm font-semibold tracking-wide text-white/80">GameCon</span>
                    {me && <span className="truncate text-xs text-white/40">· {me.name}</span>}
                    <div className="flex-1" />
                    <span className="text-xs text-white/50">Режим віджетів</span>
                    <div className="h-6 w-11">
                        <NotchToggle on={layout?.mode === 'widgets'} label="Перемкнути в режим віджетів" onChange={(on) => void window.gamecon.layout.setMode(on ? 'widgets' : 'unified')} />
                    </div>
                    <div className="flex h-full">
                        <button type="button" className="grid h-full w-12 place-items-center text-white/60 hover:bg-white/10" onClick={() => void window.gamecon.window.minimize()} aria-label="Згорнути">
                            <Minus size={14} strokeWidth={1.5} />
                        </button>
                        <button type="button" className="grid h-full w-12 place-items-center text-white/60 hover:bg-white/10" onClick={() => void window.gamecon.window.toggleMaximize()} aria-label="Розгорнути">
                            <Square size={12} strokeWidth={1.5} />
                        </button>
                        <button type="button" className="grid h-full w-12 place-items-center rounded-tr-[22px] text-white/60 hover:bg-[#c42b1c] hover:text-white" onClick={() => void window.gamecon.window.close()} aria-label="Закрити">
                            <X size={15} strokeWidth={1.5} />
                        </button>
                    </div>
                </header>
                {/* Сторінка розділу (повністю в програмі) — поверх сітки модулів. */}
                {page && <div className="relative min-h-0 flex-1 overflow-hidden"><ToastHost>{page}</ToastHost></div>}
                {/* Bento-сітка модулів. */}
                <main className={`min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4 ${page ? 'hidden' : ''}`}>
                    {/* Угорі головної — каруселі кіно, ігор і музики. */}
                    <HomeCarousels />
                    {modules.length === 0 ? (
                        <button type="button" onClick={() => setPanel(true)} className="mx-auto mt-24 flex items-center gap-2 rounded-xl px-4 py-3 text-white/60 ring-1 ring-white/10 hover:bg-white/5">
                            <LayoutGrid size={16} /> Оберіть модулі в налаштуваннях
                        </button>
                    ) : (
                        <div className="grid grid-flow-dense auto-rows-[104px] grid-cols-12 gap-3">
                            {modules.map((m) => {
                                const size = settings?.sizes?.[m.id] ?? defaultSize(m);
                                const next = size === 's' ? 'm' : size === 'm' ? 'l' : 's';
                                return (
                                    <div key={m.id} id={`module-${m.id}`} className={SPAN[size]}>
                                        {m.render(
                                            <>
                                                <IconButton label={`Розмір плитки: ${SIZE_LABEL[next]}`} onClick={() => void saveSettings({ sizes: { ...(settings?.sizes ?? {}), [m.id]: next } })}>
                                                    {size === 'l' ? <Minimize2 size={15} strokeWidth={1.6} /> : <Maximize2 size={15} strokeWidth={1.6} />}
                                                </IconButton>
                                                <IconButton label="Відкріпити у віджет" onClick={() => void window.gamecon.layout.detach(m.id)}>
                                                    <PictureInPicture2 size={15} strokeWidth={1.6} />
                                                </IconButton>
                                            </>,
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
                {/* Плеєр — унизу вікна на всіх сторінках, поки щось у черзі. */}
                <PlayerBar hidden={!!nav.path?.startsWith('/music')} />
            </div>
            {panel && <SettingsPanel onClose={() => setPanel(false)} />}
        </div>
    );
}

/** Bento: компактна (1/3 ширини, низька), звичайна (1/3, вища) і велика (2/3, найвища); на вузькому вікні — по половині. */
const SPAN = {
    s: 'col-span-4 row-span-2 max-[1180px]:col-span-6',
    m: 'col-span-4 row-span-4 max-[1180px]:col-span-6',
    l: 'col-span-8 row-span-5 max-[1180px]:col-span-12',
} as const;
const SIZE_LABEL = { s: 'компактна', m: 'звичайна', l: 'велика' } as const;

function RailButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
    const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setTip({ x: r.right + 10, y: r.top + r.height / 2 });
            }}
            onMouseLeave={() => setTip(null)}
            className={`no-drag relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition ${active ? 'bg-white/10 text-white ring-1 ring-neon-cyan/40' : 'text-white/55 hover:bg-white/[0.07] hover:text-white'}`}
        >
            {active && <span className="absolute top-3 -left-[14px] h-6 w-1 rounded-r-full bg-neon-cyan shadow-[0_0_10px_#22d3ee]" />}
            {children}
            {tip && (
                <span style={{ left: tip.x, top: tip.y }} className="pointer-events-none fixed z-[80] -translate-y-1/2 rounded-lg bg-[#0d1018] px-3 py-1.5 text-[13px] whitespace-nowrap text-white/90 shadow-xl ring-1 ring-white/10">
                    {label}
                </span>
            )}
        </button>
    );
}

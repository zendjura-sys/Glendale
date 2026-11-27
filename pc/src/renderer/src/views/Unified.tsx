import { LayoutGrid, Minus, PictureInPicture2, Settings, Square, X } from 'lucide-react';
import { useState } from 'react';
import { NotchToggle } from '@/components/NotchedCard';
import { IconButton } from '@/components/ui';
import { ToastHost } from '@/components/kit';
import { useLayout, useSettings } from '@/lib/layout';
import { useNav } from '@/lib/nav';
import { resolvePage } from '@/pages';
import { useMe } from '@/lib/me';
import { availableModules } from '@/modules/registry';
import { SettingsPanel } from './Settings';

/**
 * Режим А — одне безрамочне вікно: тонкий док-рейл ліворуч, своя панель із зоною перетягування,
 * кнопками вікна й Mode-Switch Toggle, а всередині — Bento-сітка обраних модулів.
 */
export function UnifiedView() {
    const layout = useLayout();
    const [settings] = useSettings();
    const { me, sections, plugins } = useMe();
    const [panel, setPanel] = useState(false);
    const modules = availableModules(sections, plugins).filter((m) => settings?.modules.includes(m.id));
    const nav = useNav();
    const page = nav.path ? resolvePage(nav.path) : null;

    return (
        <div className="relative flex h-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.10),transparent_45%),radial-gradient(120%_120%_at_100%_100%,rgba(168,85,247,0.14),transparent_50%)] bg-obsidian-solid/80 ring-1 ring-white/10 backdrop-blur-2xl">
            {/* Док-рейл. */}
            <nav className="drag flex w-14 shrink-0 flex-col items-center gap-1 border-r border-white/5 py-3">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-violet text-sm font-black text-obsidian-solid">G</div>
                {modules.map((m) => (
                    <IconButton key={m.id} label={m.title} onClick={() => (m.page ? nav.go(m.page) : (nav.close(), document.getElementById(`module-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })))}>
                        <m.icon size={18} strokeWidth={1.5} />
                    </IconButton>
                ))}
                <div className="flex-1" />
                <IconButton label="Налаштування" onClick={() => setPanel(true)}>
                    <Settings size={18} strokeWidth={1.5} />
                </IconButton>
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
                <main className={`min-h-0 flex-1 overflow-y-auto p-4 pt-1 ${page ? 'hidden' : ''}`}>
                    {modules.length === 0 ? (
                        <button type="button" onClick={() => setPanel(true)} className="mx-auto mt-24 flex items-center gap-2 rounded-xl px-4 py-3 text-white/60 ring-1 ring-white/10 hover:bg-white/5">
                            <LayoutGrid size={16} /> Оберіть модулі в налаштуваннях
                        </button>
                    ) : (
                        <div className="grid auto-rows-[400px] grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
                            {modules.map((m) => (
                                <div key={m.id} id={`module-${m.id}`} className={m.wide ? 'col-span-2 max-[760px]:col-span-1' : ''}>
                                    {m.render(
                                        <IconButton label="Відкріпити у віджет" onClick={() => void window.gamecon.layout.detach(m.id)}>
                                            <PictureInPicture2 size={15} strokeWidth={1.5} />
                                        </IconButton>,
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
            {panel && <SettingsPanel onClose={() => setPanel(false)} />}
        </div>
    );
}

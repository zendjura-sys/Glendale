import { LogOut, X } from 'lucide-react';
import { availableModules } from '@/modules/registry';
import { useSettings } from '@/lib/layout';
import { useMe } from '@/lib/me';

/** Налаштування програми: які модулі показувати (лише з увімкнених розділів), оверлей у грі, автозапуск. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
    const [settings, update] = useSettings();
    const { sections, plugins } = useMe();
    if (!settings) return null;
    const modules = availableModules(sections, plugins);
    const toggle = (id: string): void => update({ modules: settings.modules.includes(id) ? settings.modules.filter((m) => m !== id) : [...settings.modules, id] });
    const overlay = [
        ['auto', 'Авто: віджети поверх, коли граю'],
        ['always', 'Завжди поверх (повсякденний оверлей)'],
        ['off', 'Вимкнено'],
    ] as const;
    return (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="no-drag w-[560px] max-w-[92%] rounded-2xl bg-obsidian-solid/95 p-5 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center">
                    <h2 className="flex-1 text-lg font-semibold">Налаштування</h2>
                    <button type="button" onClick={onClose} aria-label="Закрити" className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10">
                        <X size={16} />
                    </button>
                </div>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/50 uppercase">Модулі</h3>
                <p className="mb-2 text-xs text-white/40">Лише розділи, увімкнені вам на GameCon. Обрані — у вікні й у режимі віджетів.</p>
                <div className="mb-5 grid grid-cols-2 gap-1.5">
                    {modules.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 ring-1 ring-white/5 hover:bg-white/5">
                            <input type="checkbox" checked={settings.modules.includes(m.id)} onChange={() => toggle(m.id)} className="accent-[#22d3ee]" />
                            <m.icon size={15} strokeWidth={1.6} className="text-white/60" />
                            <span className="text-sm">{m.title}</span>
                        </label>
                    ))}
                </div>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/50 uppercase">Оверлей</h3>
                <div className="mb-5 space-y-1">
                    {overlay.map(([value, label]) => (
                        <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-white/5">
                            <input type="radio" name="overlay" checked={settings.overlay === value} onChange={() => update({ overlay: value })} className="accent-[#a855f7]" />
                            <span className="text-sm">{label}</span>
                        </label>
                    ))}
                </div>
                <label className="mb-5 flex cursor-pointer items-center gap-2.5 px-3 text-sm">
                    <input type="checkbox" checked={settings.launchAtLogin} onChange={(e) => update({ launchAtLogin: e.target.checked })} className="accent-[#22d3ee]" />
                    Запускати разом із Windows (у трей)
                </label>
                <p className="mb-4 px-3 text-xs text-white/40">Ctrl+Shift+G — показати GameCon · Ctrl+Shift+O — режим віджетів</p>
                <button type="button" onClick={() => void window.gamecon.session.logout()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
                    <LogOut size={15} /> Вийти з акаунта
                </button>
            </div>
        </div>
    );
}

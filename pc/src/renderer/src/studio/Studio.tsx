import {
    ArrowDown,
    ArrowUp,
    Camera,
    Circle,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Lock,
    LockOpen,
    Minus,
    Monitor,
    Palette,
    Plus,
    Radio,
    Square,
    SquareStack,
    Trash2,
    Type,
    Volume2,
    VolumeX,
    X,
    AppWindow,
    Mic,
} from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CaptureSource } from '../../../preload';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { IconButton } from '@/components/ui';
import { api } from '@/lib/api';
import { defaultConfig, type Source, type SourceKind, type StudioConfig, StudioEngine, uid } from './engine';

const KIND: Record<SourceKind, { label: string; icon: typeof Monitor }> = {
    screen: { label: 'Екран', icon: Monitor },
    window: { label: 'Вікно', icon: AppWindow },
    camera: { label: 'Камера', icon: Camera },
    image: { label: 'Картинка', icon: ImageIcon },
    text: { label: 'Текст', icon: Type },
    color: { label: 'Колір', icon: Palette },
};

/**
 * Студія LiveCast — як OBS у GameCon: сцени з плавним переходом, джерела (екран, вікно, камера,
 * картинка, текст, колір) з перетягуванням і зміною розміру просто на превʼю, мікшер звуку
 * (мікрофон і звук системи з індикаторами), ефір у LiveCast, трансляція по RTMP і запис у файл.
 */
export function StudioView() {
    const [config, setConfig] = useState<StudioConfig | null>(null);
    useEffect(() => {
        void window.gamecon.studio.load<StudioConfig>('studio').then((saved) => setConfig(saved?.scenes?.length ? { ...defaultConfig(), ...saved } : defaultConfig()));
    }, []);
    return config ? <Studio initial={config} /> : null;
}

function Studio({ initial }: { initial: StudioConfig }) {
    const engine = useMemo(() => new StudioEngine(initial), [initial]);
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    const [selected, setSelected] = useState<string | null>(null);
    const [picker, setPicker] = useState<'screen' | 'window' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const config = engine.config;
    const scene = engine.scene;
    const source = scene.sources.find((s) => s.id === selected) ?? null;

    // Збереження (з невеликою затримкою) і перемалювання інтерфейсу.
    const save = useRef<number | null>(null);
    const commit = (): void => {
        engine.syncMedia();
        rerender();
        if (save.current) window.clearTimeout(save.current);
        save.current = window.setTimeout(() => void window.gamecon.studio.persist('studio', engine.config), 500);
    };
    useEffect(() => {
        engine.onChange = rerender;
        engine.syncMedia();
        const tick = window.setInterval(rerender, 250); // індикатори звуку, таймер, FPS
        return () => {
            window.clearInterval(tick);
            engine.dispose();
        };
    }, [engine]);
    // Ctrl+1…9 — перемкнути сцену.
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.ctrlKey && /^[1-9]$/.test(e.key)) {
                const target = config.scenes[Number(e.key) - 1];
                if (target) engine.switchScene(target.id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [engine, config.scenes]);

    const addSource = (kind: SourceKind, props: Source['props'] = {}, name?: string): void => {
        const { width, height } = config.output;
        const full = kind === 'screen' || kind === 'window' || kind === 'color';
        const s: Source = {
            id: uid(),
            kind,
            name: name ?? KIND[kind].label,
            visible: true,
            locked: false,
            x: full ? 0 : kind === 'camera' ? width - 520 : width / 4,
            y: full ? 0 : kind === 'camera' ? height - 320 : height / 3,
            w: full ? width : kind === 'camera' ? 480 : width / 2,
            h: full ? height : kind === 'camera' ? 270 : kind === 'text' ? 140 : height / 3,
            props: { fit: kind === 'camera' ? 'cover' : 'contain', ...(kind === 'text' ? { text: 'Новий напис', color: '#ffffff', size: 72, bold: true } : {}), ...(kind === 'color' ? { color: '#0f121c' } : {}), ...props },
        };
        // Тло — знизу, решта — зверху.
        if (kind === 'color') scene.sources.unshift(s);
        else scene.sources.push(s);
        setSelected(s.id);
        commit();
    };

    const pickImage = (): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => addSource('image', { src: String(reader.result), fit: 'contain' }, file.name);
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const addCamera = async (): Promise<void> => {
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        addSource('camera', { deviceId: devices[0]?.deviceId, mirror: true }, devices[0]?.label || 'Камера');
    };

    const move = (dir: -1 | 1): void => {
        if (!source) return;
        const i = scene.sources.indexOf(source);
        const j = i + dir;
        if (j < 0 || j >= scene.sources.length) return;
        [scene.sources[i], scene.sources[j]] = [scene.sources[j], scene.sources[i]];
        commit();
    };

    const run = async (task: () => Promise<unknown>): Promise<void> => {
        setError(null);
        try {
            await task();
        } catch (e) {
            setError((e as Error).message);
        }
        rerender();
    };

    const elapsed = engine.stats.startedAt && (engine.live || engine.rtmp) ? Math.floor((Date.now() - engine.stats.startedAt) / 1000) : 0;
    const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

    return (
        <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] bg-obsidian-solid/90 ring-1 ring-white/10 backdrop-blur-2xl">
            {/* Панель. */}
            <header className="drag flex h-11 shrink-0 items-center gap-3 pl-4">
                <Radio size={16} className="text-neon-cyan" />
                <span className="text-sm font-semibold">Студія LiveCast</span>
                {engine.live && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold">ЕФІР</span>}
                {engine.rtmp && <span className="rounded-full bg-neon-violet px-2 py-0.5 text-[11px] font-bold">RTMP</span>}
                {engine.recording && <span className="flex items-center gap-1 text-[11px] font-bold text-rose-300"><Circle size={9} fill="currentColor" /> REC</span>}
                {(engine.live || engine.rtmp) && <span className="font-mono text-xs text-white/60">{clock}</span>}
                <span className="font-mono text-xs text-white/40">{engine.stats.fps} FPS · {config.output.width}×{config.output.height}</span>
                <div className="flex-1" />
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

            <div className="grid min-h-0 flex-1 grid-cols-[230px_1fr_290px] gap-3 px-3">
                {/* Сцени. */}
                <NotchedCard title="Сцени" subtitle="Ctrl+1…9 — перемкнути" glow="cyan" badge={<NotchBadge>{config.scenes.length}</NotchBadge>} badgeWidth={40}>
                    <ul className="space-y-1">
                        {config.scenes.map((s, i) => (
                            <li key={s.id}>
                                <button
                                    type="button"
                                    onClick={() => engine.switchScene(s.id)}
                                    onDoubleClick={() => {
                                        const name = window.prompt('Назва сцени', s.name);
                                        if (name?.trim()) {
                                            s.name = name.trim();
                                            commit();
                                        }
                                    }}
                                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${s.id === config.active ? 'bg-neon-cyan/15 text-white ring-1 ring-neon-cyan/40' : 'text-white/70 hover:bg-white/5'}`}
                                >
                                    <SquareStack size={14} strokeWidth={1.5} />
                                    <span className="flex-1 truncate">{s.name}</span>
                                    <span className="text-[10px] text-white/30">Ctrl+{i + 1}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-2 flex gap-1">
                        <IconButton
                            label="Додати сцену"
                            onClick={() => {
                                const s = { id: uid(), name: `Сцена ${config.scenes.length + 1}`, sources: [] };
                                config.scenes.push(s);
                                engine.switchScene(s.id);
                                commit();
                            }}
                        >
                            <Plus size={15} />
                        </IconButton>
                        <IconButton
                            label="Видалити сцену"
                            onClick={() => {
                                if (config.scenes.length < 2) return;
                                config.scenes = config.scenes.filter((s) => s.id !== config.active);
                                engine.switchScene(config.scenes[0].id);
                                commit();
                            }}
                        >
                            <Trash2 size={15} />
                        </IconButton>
                    </div>
                    <label className="mt-4 block text-xs text-white/50">
                        Перехід: {config.transition} мс
                        <input type="range" min={0} max={1500} step={50} value={config.transition} onChange={(e) => ((config.transition = Number(e.target.value)), commit())} className="mt-1 w-full accent-[#22d3ee]" />
                    </label>
                </NotchedCard>

                {/* Превʼю. */}
                <Preview engine={engine} selected={selected} onSelect={setSelected} onChange={commit} />

                {/* Джерела й властивості. */}
                <div className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
                    <NotchedCard title="Джерела" subtitle={scene.name} glow="violet" badge={<NotchBadge tone="violet">{scene.sources.length}</NotchBadge>} badgeWidth={40}>
                        <div className="mb-2 grid grid-cols-3 gap-1">
                            <AddButton icon={Monitor} label="Екран" onClick={() => setPicker('screen')} />
                            <AddButton icon={AppWindow} label="Вікно" onClick={() => setPicker('window')} />
                            <AddButton icon={Camera} label="Камера" onClick={() => void addCamera()} />
                            <AddButton icon={ImageIcon} label="Картинка" onClick={pickImage} />
                            <AddButton icon={Type} label="Текст" onClick={() => addSource('text')} />
                            <AddButton icon={Palette} label="Колір" onClick={() => addSource('color')} />
                        </div>
                        <ul className="space-y-0.5">
                            {[...scene.sources].reverse().map((s) => {
                                const Icon = KIND[s.kind].icon;
                                return (
                                    <li key={s.id} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${s.id === selected ? 'bg-neon-violet/15 ring-1 ring-neon-violet/40' : 'hover:bg-white/5'}`}>
                                        <button type="button" onClick={() => setSelected(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]">
                                            <Icon size={13} className="shrink-0 text-white/50" />
                                            <span className={`truncate ${s.visible ? '' : 'text-white/35'}`}>{s.name}</span>
                                        </button>
                                        <IconButton label={s.visible ? 'Сховати' : 'Показати'} onClick={() => ((s.visible = !s.visible), commit())}>
                                            {s.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                                        </IconButton>
                                        <IconButton label={s.locked ? 'Розблокувати' : 'Заблокувати'} onClick={() => ((s.locked = !s.locked), commit())}>
                                            {s.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                                        </IconButton>
                                    </li>
                                );
                            })}
                        </ul>
                    </NotchedCard>
                    {source && (
                        <div className="rounded-2xl bg-obsidian p-3 ring-1 ring-white/10">
                            <div className="mb-2 flex items-center gap-1">
                                <input value={source.name} onChange={(e) => ((source.name = e.target.value), commit())} className="min-w-0 flex-1 rounded-lg bg-white/5 px-2 py-1 text-sm outline-none" />
                                <IconButton label="Вище" onClick={() => move(1)}>
                                    <ArrowUp size={13} />
                                </IconButton>
                                <IconButton label="Нижче" onClick={() => move(-1)}>
                                    <ArrowDown size={13} />
                                </IconButton>
                                <IconButton
                                    label="Видалити джерело"
                                    onClick={() => {
                                        scene.sources = scene.sources.filter((s) => s.id !== source.id);
                                        setSelected(null);
                                        commit();
                                    }}
                                >
                                    <Trash2 size={13} />
                                </IconButton>
                            </div>
                            <Properties source={source} onChange={commit} />
                        </div>
                    )}
                </div>
            </div>

            {/* Мікшер і виходи. */}
            <div className="grid shrink-0 grid-cols-[1fr_1.4fr] gap-3 p-3">
                <div className="rounded-2xl bg-obsidian p-3 ring-1 ring-white/10">
                    <div className="mb-2 text-xs font-semibold tracking-wide text-white/50 uppercase">Мікшер</div>
                    <Channel label="Мікрофон" icon={<Mic size={14} />} level={engine.level('mic')} channel={config.mic} onChange={() => (engine.applyAudio(), commit())} />
                    <Channel label="Звук системи" icon={<Volume2 size={14} />} level={engine.level('desktop')} channel={config.desktop} onChange={() => (engine.applyAudio(), commit())} />
                </div>
                <Outputs engine={engine} onChange={commit} run={run} />
            </div>
            {error && <div className="absolute right-4 bottom-4 z-50 max-w-md rounded-xl bg-rose-500/90 px-4 py-2 text-sm">{error}</div>}
            {picker && (
                <CapturePicker
                    kind={picker}
                    onClose={() => setPicker(null)}
                    onPick={(c) => {
                        setPicker(null);
                        addSource(c.kind, { captureId: c.id }, c.name);
                    }}
                />
            )}
        </div>
    );
}

function AddButton({ icon: Icon, label, onClick }: { icon: typeof Monitor; label: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] text-white/65 ring-1 ring-white/5 hover:bg-white/5 hover:text-white">
            <Icon size={15} strokeWidth={1.5} />
            {label}
        </button>
    );
}

/** Превʼю: полотно виходу в масштабі + рамка обраного джерела з перетягуванням і ручкою розміру. */
function Preview({ engine, selected, onSelect, onChange }: { engine: StudioEngine; selected: string | null; onSelect: (id: string | null) => void; onChange: () => void }) {
    const box = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const { width, height } = engine.config.output;
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        engine.canvas.className = 'absolute inset-0 h-full w-full';
        el.prepend(engine.canvas);
        const observer = new ResizeObserver(() => setScale(el.clientWidth / width));
        observer.observe(el);
        return () => observer.disconnect();
    }, [engine, width]);
    const source = engine.scene.sources.find((s) => s.id === selected);

    const drag = (e: ReactPointerEvent, mode: 'move' | 'resize'): void => {
        if (!source || source.locked) return;
        e.stopPropagation();
        const start = { x: e.clientX, y: e.clientY, sx: source.x, sy: source.y, sw: source.w, sh: source.h };
        const ratio = source.w / source.h;
        const onMove = (ev: PointerEvent): void => {
            const dx = (ev.clientX - start.x) / scale;
            const dy = (ev.clientY - start.y) / scale;
            if (mode === 'move') {
                // Прилипання до країв полотна (12 px).
                const snap = (v: number, size: number, max: number): number => (Math.abs(v) < 12 ? 0 : Math.abs(v + size - max) < 12 ? max - size : v);
                source.x = snap(Math.round(start.sx + dx), source.w, width);
                source.y = snap(Math.round(start.sy + dy), source.h, height);
            } else {
                source.w = Math.max(40, Math.round(start.sw + dx));
                source.h = ev.shiftKey ? Math.max(20, Math.round(start.sh + dy)) : Math.round(source.w / ratio);
            }
            onChange();
        };
        const onUp = (): void => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const pick = (e: ReactPointerEvent<HTMLDivElement>): void => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        const hit = [...engine.scene.sources].reverse().find((s) => s.visible && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
        onSelect(hit?.id ?? null);
        if (hit && !hit.locked) {
            const synthetic = e;
            requestAnimationFrame(() => undefined);
            if (hit.id === selected) drag(synthetic, 'move');
        }
    };

    return (
        <div className="flex min-h-0 items-center justify-center">
            <div ref={box} onPointerDown={pick} className="relative w-full overflow-hidden rounded-xl bg-black shadow-[0_0_60px_rgba(34,211,238,0.12)] ring-1 ring-white/10" style={{ aspectRatio: `${width} / ${height}` }}>
                {source && (
                    <div
                        onPointerDown={(e) => drag(e, 'move')}
                        className={`absolute ring-2 ${source.locked ? 'ring-white/40' : 'cursor-move ring-neon-cyan'}`}
                        style={{ left: source.x * scale, top: source.y * scale, width: source.w * scale, height: source.h * scale }}
                    >
                        {!source.locked && <span onPointerDown={(e) => drag(e, 'resize')} className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-neon-cyan" />}
                    </div>
                )}
            </div>
        </div>
    );
}

function Properties({ source, onChange }: { source: Source; onChange: () => void }) {
    const p = source.props;
    const set = (patch: Partial<Source['props']>): void => {
        Object.assign(p, patch);
        onChange();
    };
    const row = (label: string, control: ReactNode): ReactNode => (
        <label className="mb-1.5 flex items-center gap-2 text-xs text-white/60">
            <span className="w-20 shrink-0">{label}</span>
            {control}
        </label>
    );
    const input = 'min-w-0 flex-1 rounded-lg bg-white/5 px-2 py-1 text-sm text-white outline-none';
    return (
        <div>
            {source.kind === 'text' && (
                <>
                    {row('Текст', <input className={input} value={p.text ?? ''} onChange={(e) => set({ text: e.target.value })} />)}
                    {row('Розмір', <input type="range" min={16} max={240} value={p.size ?? 64} onChange={(e) => set({ size: Number(e.target.value) })} className="flex-1 accent-[#a855f7]" />)}
                    {row('Жирний', <input type="checkbox" checked={!!p.bold} onChange={(e) => set({ bold: e.target.checked })} className="accent-[#a855f7]" />)}
                    {row('Тло', <input type="color" value={p.background ?? '#000000'} onChange={(e) => set({ background: e.target.value })} />)}
                </>
            )}
            {(source.kind === 'text' || source.kind === 'color') && row('Колір', <input type="color" value={p.color ?? '#ffffff'} onChange={(e) => set({ color: e.target.value })} />)}
            {['screen', 'window', 'camera', 'image'].includes(source.kind) &&
                row(
                    'Масштаб',
                    <select className={input} value={p.fit ?? 'contain'} onChange={(e) => set({ fit: e.target.value as 'contain' | 'cover' })}>
                        <option value="contain">Вписати</option>
                        <option value="cover">Заповнити</option>
                    </select>,
                )}
            {source.kind === 'camera' && row('Дзеркало', <input type="checkbox" checked={!!p.mirror} onChange={(e) => set({ mirror: e.target.checked })} className="accent-[#a855f7]" />)}
            <p className="mt-1 text-[11px] text-white/35">
                {source.w}×{source.h} у ({source.x}, {source.y}) · Shift — довільні пропорції
            </p>
        </div>
    );
}

function Channel({ label, icon, level, channel, onChange }: { label: string; icon: ReactNode; level: number; channel: StudioConfig['mic']; onChange: () => void }) {
    return (
        <div className="mb-2 flex items-center gap-2">
            <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-white/70">
                {icon} {label}
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 via-yellow-300 to-rose-500 transition-[width] duration-100" style={{ width: `${channel.muted ? 0 : level * 100}%` }} />
            </div>
            <input type="range" min={0} max={2} step={0.05} value={channel.gain} onChange={(e) => ((channel.gain = Number(e.target.value)), onChange())} className="w-24 accent-[#22d3ee]" aria-label={`Гучність: ${label}`} />
            <IconButton label={channel.muted ? 'Увімкнути' : 'Вимкнути звук'} active={channel.muted} onClick={() => ((channel.muted = !channel.muted), onChange())}>
                {channel.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </IconButton>
        </div>
    );
}

/** Виходи: ефір у LiveCast, RTMP (Twitch / YouTube / свій сервер), запис; якість виходу. */
function Outputs({ engine, onChange, run }: { engine: StudioEngine; onChange: () => void; run: (task: () => Promise<unknown>) => Promise<void> }) {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [saved, setSaved] = useState<string | null>(null);
    const [viewers, setViewers] = useState<number | null>(null);
    const out = engine.config.output;
    const rtmp = engine.config.rtmp;
    useEffect(() => {
        if (!engine.broadcastId) return;
        const id = engine.broadcastId;
        const timer = window.setInterval(() => {
            void api<{ broadcast?: { viewers?: number } }>('GET', `/api/v1/site/livecast/${id}/state`).then((s) => setViewers(s.broadcast?.viewers ?? null), () => undefined);
        }, 10_000);
        return () => window.clearInterval(timer);
    }, [engine.broadcastId]);
    const input = 'min-w-0 rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan/50';
    return (
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-obsidian p-3 ring-1 ring-white/10">
            <div className="flex flex-col gap-1.5">
                <div className="text-xs font-semibold tracking-wide text-white/50 uppercase">Ефір LiveCast</div>
                {engine.live ? (
                    <>
                        <p className="text-sm">{viewers === null ? 'У прямому ефірі' : `Дивляться: ${viewers}`}</p>
                        <button type="button" onClick={() => void run(() => engine.endLive())} className="rounded-lg bg-rose-500/80 py-1.5 text-sm font-semibold hover:bg-rose-500">
                            Завершити ефір
                        </button>
                    </>
                ) : (
                    <>
                        <input className={input} placeholder="Назва ефіру" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
                        <input className={input} placeholder="Гра чи тема (необовʼязково)" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />
                        <button type="button" disabled={title.trim().length < 3} onClick={() => void run(() => engine.goLive(title.trim(), category.trim() || null))} className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-violet py-1.5 text-sm font-semibold text-obsidian-solid disabled:opacity-40">
                            Вийти в ефір
                        </button>
                    </>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="text-xs font-semibold tracking-wide text-white/50 uppercase">RTMP · Twitch / YouTube</div>
                <input className={input} placeholder="rtmp://live.twitch.tv/app" value={rtmp.url} onChange={(e) => ((rtmp.url = e.target.value), onChange())} disabled={engine.rtmp} />
                <input className={input} type="password" placeholder="Ключ трансляції" value={rtmp.key} onChange={(e) => ((rtmp.key = e.target.value), onChange())} disabled={engine.rtmp} />
                <button type="button" disabled={!rtmp.url} onClick={() => void run(() => (engine.rtmp ? engine.stopRtmp() : engine.startRtmp()))} className={`rounded-lg py-1.5 text-sm font-semibold ring-1 disabled:opacity-40 ${engine.rtmp ? 'bg-rose-500/80 ring-rose-400' : 'bg-neon-violet/20 ring-neon-violet/50 hover:bg-neon-violet/30'}`}>
                    {engine.rtmp ? 'Зупинити RTMP' : 'Почати RTMP'}
                </button>
            </div>
            <div className="flex flex-col gap-1.5">
                <div className="text-xs font-semibold tracking-wide text-white/50 uppercase">Запис і якість</div>
                <div className="flex gap-1.5">
                    <select
                        className={`${input} flex-1`}
                        value={`${out.width}x${out.height}`}
                        disabled={engine.live || engine.rtmp || engine.recording}
                        onChange={(e) => {
                            const [w, h] = e.target.value.split('x').map(Number);
                            out.width = w;
                            out.height = h;
                            engine.resize();
                            onChange();
                        }}
                    >
                        <option value="1280x720">720p</option>
                        <option value="1920x1080">1080p</option>
                        <option value="2560x1440">1440p</option>
                    </select>
                    <select className={input} value={out.fps} disabled={engine.live || engine.rtmp || engine.recording} onChange={(e) => ((out.fps = Number(e.target.value)), onChange())}>
                        <option value={30}>30 FPS</option>
                        <option value={60}>60 FPS</option>
                    </select>
                </div>
                <label className="text-xs text-white/50">
                    Бітрейт: {out.bitrate} кбіт/с
                    <input type="range" min={1500} max={12000} step={500} value={out.bitrate} onChange={(e) => ((out.bitrate = Number(e.target.value)), onChange())} className="w-full accent-[#22d3ee]" disabled={engine.live || engine.rtmp} />
                </label>
                <button
                    type="button"
                    onClick={() => void run(async () => (engine.recording ? setSaved(await engine.stopRecording()) : engine.startRecording()))}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold ring-1 ${engine.recording ? 'bg-rose-500/80 ring-rose-400' : 'ring-white/15 hover:bg-white/5'}`}
                >
                    <Circle size={10} fill="currentColor" className="text-rose-400" /> {engine.recording ? 'Зупинити запис' : 'Почати запис'}
                </button>
                {saved && <p className="truncate text-[11px] text-white/40">Збережено: {saved}</p>}
            </div>
        </div>
    );
}

/** Вибір екрана чи вікна для захоплення — мініатюри від Windows. */
function CapturePicker({ kind, onPick, onClose }: { kind: 'screen' | 'window'; onPick: (c: CaptureSource) => void; onClose: () => void }) {
    const [sources, setSources] = useState<CaptureSource[] | null>(null);
    useEffect(() => {
        void window.gamecon.studio.sources().then((all) => setSources(all.filter((s) => s.kind === kind)));
    }, [kind]);
    return (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-[760px] max-w-[92%] rounded-2xl bg-obsidian-solid/95 p-4 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center">
                    <h2 className="flex-1 font-semibold">{kind === 'screen' ? 'Оберіть екран' : 'Оберіть вікно'}</h2>
                    <IconButton label="Закрити" onClick={onClose}>
                        <X size={16} />
                    </IconButton>
                </div>
                <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto">
                    {sources === null && <p className="text-sm text-white/50">Шукаємо…</p>}
                    {sources?.map((s) => (
                        <button key={s.id} type="button" onClick={() => onPick(s)} className="rounded-xl p-2 text-left ring-1 ring-white/10 hover:bg-white/5 hover:ring-neon-cyan/50">
                            <img src={s.thumbnail} alt="" draggable={false} className="aspect-video w-full rounded-lg bg-black object-contain" />
                            <span className="mt-1.5 flex items-center gap-1.5 truncate text-xs">
                                {s.icon && <img src={s.icon} alt="" className="h-4 w-4" />}
                                {s.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

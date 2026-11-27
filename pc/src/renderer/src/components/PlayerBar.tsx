import { ListMusic, Music, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { Cover } from '@/components/kit';
import { mmss, player, usePlayer } from '@/lib/player';

/** Плеєр унизу вікна: обкладинка, назва, керування, прогрес з перемотуванням, гучність, черга. */
export function PlayerBar() {
    const p = usePlayer();
    const [queue, setQueue] = useState(false);
    if (!p.current) return null;
    const t = p.current;
    const pct = p.duration ? (p.time / p.duration) * 100 : 0;
    const btn = 'grid h-10 w-10 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white';
    return (
        <div className="relative border-t border-white/[0.06] bg-black/30 px-4 py-2.5 backdrop-blur-xl">
            {queue && (
                <div className="absolute right-4 bottom-[calc(100%+8px)] z-40 max-h-80 w-80 overflow-y-auto rounded-2xl bg-[#11141f]/95 p-2 shadow-2xl ring-1 ring-white/10">
                    <p className="px-2 py-1 text-xs text-white/45">Черга · {p.queue.length}</p>
                    {p.queue.map((q, i) => (
                        <button key={`${q.key}-${i}`} type="button" onClick={() => player.jump(i)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === p.index ? 'bg-neon-cyan/15 text-white' : 'text-white/70 hover:bg-white/5'}`}>
                            <span className="w-5 text-xs text-white/35">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate">{q.title}</span>
                            <span className="text-xs text-white/35">{q.artist}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <Cover src={t.cover_url} className="h-12 w-12 shrink-0 rounded-lg" fallback={<Music size={18} />} />
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{t.title}</span>
                        <span className="block truncate text-xs text-white/50">{t.artist}</span>
                    </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                        <button type="button" aria-label="Перемішати" title="Перемішати" onClick={() => player.shuffle()} className={`${btn} ${p.shuffle ? '!text-neon-cyan' : ''}`}>
                            <Shuffle size={16} />
                        </button>
                        <button type="button" aria-label="Попередній" onClick={() => player.prev()} className={btn}>
                            <SkipBack size={18} />
                        </button>
                        <button type="button" aria-label={p.playing ? 'Пауза' : 'Грати'} onClick={() => player.toggle()} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black transition hover:scale-105">
                            {p.playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="ml-0.5" />}
                        </button>
                        <button type="button" aria-label="Наступний" onClick={() => player.next()} className={btn}>
                            <SkipForward size={18} />
                        </button>
                        <button type="button" aria-label="Повтор" title="Повтор" onClick={() => player.repeat()} className={`${btn} ${p.repeat !== 'off' ? '!text-neon-cyan' : ''}`}>
                            {p.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                        </button>
                    </div>
                    <div className="flex w-full items-center gap-2 text-[11px] text-white/45">
                        <span className="w-9 text-right">{mmss(p.time)}</span>
                        <div
                            className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/10"
                            onClick={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                player.seek(((e.clientX - r.left) / r.width) * p.duration);
                            }}
                        >
                            <div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9">{mmss(p.duration)}</span>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                    <button type="button" aria-label="Черга" title="Черга" onClick={() => setQueue((v) => !v)} className={`${btn} ${queue ? '!text-neon-cyan' : ''}`}>
                        <ListMusic size={17} />
                    </button>
                    <button type="button" aria-label="Звук" onClick={() => player.volume(p.volume ? 0 : 0.8)} className={btn}>
                        {p.volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
                    </button>
                    <input type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => player.volume(Number(e.target.value))} className="w-28 accent-[#22d3ee]" aria-label="Гучність" />
                </div>
            </div>
        </div>
    );
}

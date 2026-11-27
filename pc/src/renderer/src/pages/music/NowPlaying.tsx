import { Heart, Library, ListMusic, Music, Pause, Play, Radio, Repeat, Repeat1, Search, Shuffle, Shield, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { Cover, useToast } from '@/components/kit';
import { api } from '@/lib/api';
import { mmss, player, type Track, usePlayer } from '@/lib/player';

/** Права панель «Музики»: великий плеєр, під ним швидкі дії й черга. */
export function NowPlaying({ onTab }: { onTab: (tab: 'library' | 'search' | 'charts' | 'radio') => void }) {
    const p = usePlayer();
    const toast = useToast();
    const [liked, setLiked] = useState<Record<number, boolean>>({});
    const t = p.current;
    const pct = p.duration ? (p.time / p.duration) * 100 : 0;
    const station = async (key: string, label: string): Promise<void> => {
        const r = await api<{ tracks: Track[] }>('GET', `/api/v1/site/music/station?key=${encodeURIComponent(key)}`).catch(() => null);
        if (r?.tracks.length) {
            player.play(r.tracks);
            toast(`Грає: ${label}`);
        } else toast('Станція поки порожня.', 'error');
    };
    const favorites = async (): Promise<void> => {
        const r = await api<{ songs: { data: Track[] } }>('GET', '/api/v1/site/music/library/favorites').catch(() => null);
        const list = r?.songs?.data ?? [];
        if (list.length) player.play([...list].sort(() => Math.random() - 0.5));
        else toast('Улюблених треків ще немає — тисніть ♥ біля треку.', 'error');
    };
    const like = async (): Promise<void> => {
        if (!t) return;
        const on = !(liked[t.id] ?? t.favorite);
        setLiked((x) => ({ ...x, [t.id]: on }));
        await api(on ? 'POST' : 'DELETE', `/api/v1/site/music/tracks/${t.id}/favorite`).catch(() => undefined);
    };
    const round = 'grid h-11 w-11 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white';
    const actions: { icon: typeof Radio; label: string; hint: string; run: () => void }[] = [
        { icon: Radio, label: 'Моя хвиля', hint: 'Нескінченно, за смаком', run: () => void station('me', 'Моя хвиля') },
        { icon: Heart, label: 'Улюблене', hint: 'Перемішати ♥', run: () => void favorites() },
        { icon: Shield, label: 'Чарти', hint: 'Топ тижня', run: () => onTab('charts') },
        { icon: Library, label: 'Медіатека', hint: 'Мої треки й плейлисти', run: () => onTab('library') },
        { icon: Search, label: 'Пошук', hint: 'Трек чи виконавець', run: () => onTab('search') },
        { icon: Music, label: 'Радіо', hint: 'Станції за жанрами', run: () => onTab('radio') },
    ];
    return (
        <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-3xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-5 ring-1 ring-white/[0.08]">
                <Cover src={t?.cover_url} className="aspect-square w-full rounded-2xl shadow-2xl ring-1 ring-white/10" fallback={<Music size={56} />} />
                <div className="mt-4 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-bold">{t?.title ?? 'Нічого не грає'}</p>
                        <p className="truncate text-sm text-white/55">{t ? t.artist : 'Оберіть трек, мікс чи станцію'}</p>
                    </div>
                    {t && (
                        <button type="button" aria-label="Улюблене" onClick={() => void like()} className={`${round} ${(liked[t.id] ?? t.favorite) ? '!text-rose-400' : ''}`}>
                            <Heart size={20} fill={(liked[t.id] ?? t.favorite) ? 'currentColor' : 'none'} />
                        </button>
                    )}
                </div>
                <div
                    className="mt-4 h-1.5 cursor-pointer rounded-full bg-white/10"
                    onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        player.seek(((e.clientX - r.left) / r.width) * p.duration);
                    }}
                >
                    <div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-white/45">
                    <span>{mmss(p.time)}</span>
                    <span>{mmss(p.duration)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <button type="button" aria-label="Перемішати" onClick={() => player.shuffle()} className={`${round} ${p.shuffle ? '!text-neon-cyan' : ''}`}>
                        <Shuffle size={18} />
                    </button>
                    <button type="button" aria-label="Попередній" onClick={() => player.prev()} className={round}>
                        <SkipBack size={22} />
                    </button>
                    <button type="button" aria-label={p.playing ? 'Пауза' : 'Грати'} onClick={() => (t ? player.toggle() : void station('me', 'Моя хвиля'))} className="grid h-14 w-14 place-items-center rounded-full bg-white text-black shadow-lg transition hover:scale-105">
                        {p.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button type="button" aria-label="Наступний" onClick={() => player.next()} className={round}>
                        <SkipForward size={22} />
                    </button>
                    <button type="button" aria-label="Повтор" onClick={() => player.repeat()} className={`${round} ${p.repeat !== 'off' ? '!text-neon-cyan' : ''}`}>
                        {p.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                    </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <button type="button" aria-label="Звук" onClick={() => player.volume(p.volume ? 0 : 0.8)} className="text-white/60 hover:text-white">
                        {p.volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
                    </button>
                    <input type="range" min={0} max={1} step={0.01} value={p.volume} onChange={(e) => player.volume(Number(e.target.value))} className="flex-1 accent-[#22d3ee]" aria-label="Гучність" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                    <button key={a.label} type="button" onClick={a.run} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.04] px-3 py-3 text-left ring-1 ring-white/[0.07] transition hover:bg-white/[0.07] hover:ring-neon-cyan/30">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-neon-cyan/25 to-neon-violet/25">
                            <a.icon size={17} />
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{a.label}</span>
                            <span className="block truncate text-[11px] text-white/45">{a.hint}</span>
                        </span>
                    </button>
                ))}
            </div>
            {p.queue.length > 0 && (
                <div className="min-h-0 rounded-2xl bg-white/[0.035] p-3 ring-1 ring-white/[0.07]">
                    <p className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">
                        <ListMusic size={13} /> Далі в черзі
                    </p>
                    {p.queue.slice(p.index + 1, p.index + 8).map((q, i) => (
                        <button key={`${q.key}-${i}`} type="button" onClick={() => player.jump(p.index + 1 + i)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/5">
                            <Cover src={q.cover_url} className="h-9 w-9 shrink-0 rounded-md" fallback={<Music size={13} />} />
                            <span className="min-w-0">
                                <span className="block truncate text-[13px]">{q.title}</span>
                                <span className="block truncate text-[11px] text-white/45">{q.artist}</span>
                            </span>
                        </button>
                    ))}
                    {p.index + 1 >= p.queue.length && <p className="px-1 py-2 text-xs text-white/40">Це останній трек у черзі.</p>}
                </div>
            )}
        </aside>
    );
}

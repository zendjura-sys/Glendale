import { useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@/lib/api';

export function Avatar({ user, size = 36, dot }: { user: Partial<User> | null | undefined; size?: number; dot?: 'online' | 'idle' | null }) {
    // Перша літера імені (без дужок тегу «[SCL] …» і емодзі); картинка не завантажилась — теж літера.
    const letter = ((user?.name ?? '').match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase();
    const [broken, setBroken] = useState(false);
    const dotSize = Math.max(10, Math.round(size / 4.5));
    return (
        <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
            {user?.avatar_url && !broken ? (
                <img src={user.avatar_url} alt="" draggable={false} onError={() => setBroken(true)} className="h-full w-full rounded-full object-cover" />
            ) : (
                <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-neon-blue to-neon-violet font-bold" style={{ fontSize: Math.max(12, size * 0.4) }}>
                    {letter}
                </span>
            )}
            {dot && <span className={`absolute right-0 bottom-0 rounded-full ring-2 ring-obsidian-solid ${dot === 'online' ? 'bg-emerald-400' : 'bg-white/30'}`} style={{ width: dotSize, height: dotSize }} />}
        </span>
    );
}

export function IconButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={`no-drag grid h-9 w-9 place-items-center rounded-xl transition hover:bg-white/10 ${active ? 'text-neon-cyan' : 'text-white/60 hover:text-white'}`}>
            {children}
        </button>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="grid h-full min-h-24 place-items-center px-4 text-center text-sm text-white/45">{children}</div>;
}

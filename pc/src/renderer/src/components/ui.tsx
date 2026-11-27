import type { ReactNode } from 'react';
import type { User } from '@/lib/api';

export function Avatar({ user, size = 36, dot }: { user: Partial<User> | null | undefined; size?: number; dot?: 'online' | 'idle' | null }) {
    // Перша літера імені (без дужок тегу «[SCL] …» і емодзі).
    const letter = ((user?.name ?? '').match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase();
    return (
        <span className="relative shrink-0" style={{ width: size, height: size }}>
            {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" draggable={false} className="h-full w-full rounded-full object-cover" />
            ) : (
                <span className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-neon-blue to-neon-violet text-sm font-bold">{letter}</span>
            )}
            {dot && <span className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-obsidian-solid ${dot === 'online' ? 'bg-emerald-400' : 'bg-white/30'}`} />}
        </span>
    );
}

export function IconButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: ReactNode; active?: boolean }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={`no-drag grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/10 ${active ? 'text-neon-cyan' : 'text-white/60 hover:text-white'}`}>
            {children}
        </button>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="grid h-full min-h-24 place-items-center px-4 text-center text-sm text-white/45">{children}</div>;
}

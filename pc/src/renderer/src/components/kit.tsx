import { ArrowLeft, Loader2, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav';

/* Набір елементів для повних сторінок розділів: шапка з «Назад», вкладки, картки, кнопки, поля, модалки, тости. */

type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastContext = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastHost({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, text, tone }]);
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);
    return (
        <ToastContext.Provider value={push}>
            {children}
            <div className="pointer-events-none absolute right-5 bottom-5 z-[60] flex flex-col items-end gap-2">
                {toasts.map((t) => (
                    <div key={t.id} className={`max-w-sm rounded-xl px-4 py-2.5 text-sm shadow-xl ring-1 backdrop-blur-xl ${t.tone === 'ok' ? 'bg-emerald-500/20 ring-emerald-400/40' : 'bg-rose-500/25 ring-rose-400/40'}`}>
                        {t.text}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/** Дані сторінки сайту через міст /api/v1/site (ті самі контролери, що й на сайті). */
export function useSite<T>(path: string | null): { data: T | null; error: string | null; reload: () => Promise<void>; loading: boolean } {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const reload = useCallback(async () => {
        if (!path) return;
        setLoading(true);
        try {
            setData(await api<T>('GET', `/api/v1/site${path}`));
            setError(null);
        } catch (e) {
            setError((e as Error).message);
        }
        setLoading(false);
    }, [path]);
    useEffect(() => {
        setData(null);
        void reload();
    }, [reload]);
    return { data, error, reload, loading };
}

/** Дія на сервері з тостом; після успіху — onDone (зазвичай перезавантажити сторінку). */
export function useAction() {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const run = useCallback(
        async (method: string, path: string, body?: unknown, ok?: string, onDone?: () => unknown): Promise<boolean> => {
            setBusy(true);
            try {
                const res = await api<{ message?: string; toast?: { message?: string } }>(method, path.startsWith('/api/') ? path : `/api/v1/site${path}`, body);
                toast(ok ?? res?.toast?.message ?? res?.message ?? 'Готово.');
                await onDone?.();
                return true;
            } catch (e) {
                toast((e as Error).message, 'error');
                return false;
            } finally {
                setBusy(false);
            }
        },
        [toast],
    );
    return { run, busy };
}

export function PageHeader({ title, subtitle, image, actions }: { title: ReactNode; subtitle?: ReactNode; image?: ReactNode; actions?: ReactNode }) {
    const nav = useNav();
    return (
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <button type="button" onClick={nav.back} aria-label="Назад" title="Назад (Esc)" className="grid h-11 w-11 place-items-center rounded-xl text-white/75 ring-1 ring-white/10 hover:bg-white/10">
                <ArrowLeft size={19} />
            </button>
            {image}
            <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold">{title}</h1>
                {subtitle && <div className="truncate text-xs text-white/50">{subtitle}</div>}
            </div>
            {actions}
            <button type="button" onClick={nav.close} aria-label="Закрити" title="До модулів" className="grid h-11 w-11 place-items-center rounded-xl text-white/55 ring-1 ring-white/10 hover:bg-white/10">
                <X size={18} />
            </button>
        </div>
    );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number | null }[]; value: T; onChange: (id: T) => void }) {
    return (
        <div className="flex gap-1.5 overflow-x-auto border-b border-white/5 px-5 pb-3">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange(t.id)}
                    className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[14px] font-medium transition ${t.id === value ? 'bg-white/10 text-white ring-1 ring-neon-cyan/40' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                >
                    {t.label}
                    {!!t.badge && <span className="rounded-full bg-neon-violet px-1.5 text-[10px] font-bold">{t.badge}</span>}
                </button>
            ))}
        </div>
    );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={`break-inside-avoid rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07] ${className}`}>
            {(title || actions) && (
                <div className="mb-3 flex items-center gap-2">
                    <h2 className="flex-1 text-sm font-semibold text-white/85">{title}</h2>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

export function Button({ children, onClick, tone = 'ghost', disabled, type = 'button', small }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger' | 'ok'; disabled?: boolean; type?: 'button' | 'submit'; small?: boolean }) {
    const tones = {
        primary: 'bg-gradient-to-r from-neon-cyan/85 to-neon-violet/85 text-obsidian-solid font-semibold',
        ghost: 'ring-1 ring-white/15 hover:bg-white/5',
        danger: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/40 hover:bg-rose-500/30',
        ok: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30',
    };
    return (
        <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-1.5 rounded-lg ${small ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm'} transition disabled:opacity-40 ${tones[tone]}`}>
            {children}
        </button>
    );
}

const fieldClass = 'w-full rounded-xl bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-neon-cyan/50';
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs text-white/55">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[11px] text-white/35">{hint}</span>}
        </label>
    );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldClass} ${p.className ?? ''}`} />;
export const TextArea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${fieldClass} resize-y ${p.className ?? ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldClass} ${p.className ?? ''} [&>option]:bg-[#11141f]`} />;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
    return (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm" onMouseDown={onClose}>
            <div className={`max-h-[88%] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-y-auto rounded-2xl bg-[#10131d]/95 p-5 ring-1 ring-white/10`} onMouseDown={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center">
                    <h2 className="flex-1 text-base font-semibold">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Закрити" className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10">
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function Loading({ error }: { error?: string | null }) {
    return <div className="grid h-40 place-items-center text-sm text-white/50">{error ?? <Loader2 className="animate-spin" size={20} />}</div>;
}

export const money = (n: number | string | null | undefined, unit = '$'): string => `${Math.round(Number(n ?? 0)).toLocaleString('uk-UA')} ${unit}`;
export const when = (iso: string | null | undefined, time = true): string =>
    iso ? new Date(iso).toLocaleString('uk-UA', time ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

/** Приватна картинка з API (докази): завантажується через Main з токеном. */
export function PrivateImage({ src, className, onClick }: { src: string; className?: string; onClick?: (data: string) => void }) {
    const [data, setData] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        const path = apiPath(src);
        void window.gamecon.blob(path).then((d) => alive && setData(d));
        return () => {
            alive = false;
        };
    }, [src]);
    return data ? <img src={data} alt="" draggable={false} onClick={() => onClick?.(data)} className={`${className ?? ''} ${onClick ? 'cursor-zoom-in' : ''}`} /> : <div className={`${className ?? ''} animate-pulse bg-white/5`} />;
}

/** Bento-кладка для карток сторінки: кожна картка — своєї висоти, без порожнечі й розтягування. */
export function Masonry({ children, min = 320 }: { children: ReactNode; min?: number }) {
    return (
        <div className="gap-4 [&>*]:mb-4" style={{ columnWidth: min, columnGap: 16 }}>
            {children}
        </div>
    );
}

/** Компактна плитка-показник (баланс, варни…). */
export function StatTile({ label, value, hint, alert, accent }: { label: string; value: ReactNode; hint?: string; alert?: boolean; accent?: boolean }) {
    return (
        <div className={`rounded-xl px-3.5 py-3 ring-1 ${accent ? 'bg-neon-cyan/[0.07] ring-neon-cyan/20' : 'bg-white/[0.04] ring-white/[0.06]'}`}>
            <div className={`text-lg leading-tight font-bold ${alert ? 'text-rose-300' : ''}`}>{value}</div>
            <div className="mt-0.5 text-xs text-white/50">{label}</div>
            {hint && <div className="text-[11px] text-white/35">{hint}</div>}
        </div>
    );
}

/** Адреса сайту → API з токеном: вкладення чатів — /api/v1/messages/…, решта — через міст /api/v1/site. */
export function apiPath(src: string): string {
    if (!src.startsWith('/') || src.startsWith('/api/')) return src;
    if (src.startsWith('/messages/attachments/')) return `/api/v1${src}`;
    return `/api/v1/site${src}`;
}

/** Картинка: публічна — напряму, приватна (відносна адреса) — через Main з токеном. */
export function SmartImage({ src, className, onClick }: { src: string; className?: string; onClick?: (data: string) => void }) {
    if (src.startsWith('http')) return <img src={src} alt="" draggable={false} onClick={() => onClick?.(src)} className={`${className ?? ''} ${onClick ? 'cursor-zoom-in' : ''}`} />;
    return <PrivateImage src={src} className={className} onClick={onClick} />;
}

/** Завантажити файл (приватний — через Main) і зберегти. */
export async function downloadFile(src: string, name: string): Promise<void> {
    const data = src.startsWith('http') ? src : await window.gamecon.blob(apiPath(src));
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = name;
    a.click();
}

/** Обкладинка з запасним варіантом: не завантажилась — градієнт з іконкою, а не «бита» картинка. */
export function Cover({ src, className, fallback }: { src: string | null | undefined; className?: string; fallback?: ReactNode }) {
    const [broken, setBroken] = useState(false);
    if (!src || broken) return <div className={`grid place-items-center bg-gradient-to-br from-neon-blue/25 via-neon-violet/20 to-neon-cyan/15 text-white/35 ${className ?? ''}`}>{fallback}</div>;
    return <img src={src} alt="" draggable={false} onError={() => setBroken(true)} className={`object-cover ${className ?? ''}`} />;
}

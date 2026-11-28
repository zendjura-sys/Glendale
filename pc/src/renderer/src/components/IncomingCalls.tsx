import { Phone, PhoneOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui';
import { api, type User } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Incoming = { id: number; conversation_id: number; group: boolean; title: string | null; caller: User | null };

/**
 * Вхідний дзвінок поверх будь-якого розділу програми: опитує сервер (у ПК немає push),
 * показує системне сповіщення й картку «Прийняти / Відхилити».
 */
export function IncomingCalls() {
    const nav = useNav();
    const [calls, setCalls] = useState<Incoming[]>([]);
    const [dismissed, setDismissed] = useState<number[]>([]);
    const notified = useRef(new Set<number>());
    useEffect(() => {
        let stop = false;
        const tick = async (): Promise<void> => {
            const r = await api<{ calls: Incoming[] }>('GET', '/api/v1/calls/incoming').catch(() => null);
            if (!r || stop) return;
            setCalls(r.calls);
            for (const c of r.calls) {
                if (notified.current.has(c.id)) continue;
                notified.current.add(c.id);
                try {
                    const n = new Notification(c.group ? `Дзвінок у «${c.title ?? 'групі'}»` : 'Вхідний дзвінок', { body: `${c.caller?.name ?? 'Хтось'} дзвонить вам у GameCon`, silent: false });
                    n.onclick = () => window.focus();
                } catch {
                    // Сповіщення вимкнені — лишається картка в програмі.
                }
            }
        };
        void tick();
        const t = window.setInterval(() => void tick(), 3000);
        return () => {
            stop = true;
            window.clearInterval(t);
        };
    }, []);
    const shown = calls.filter((c) => !dismissed.includes(c.id));
    if (!shown.length) return null;
    return (
        <div className="pointer-events-none absolute right-5 bottom-24 z-[60] flex w-[340px] flex-col gap-2">
            {shown.map((c) => (
                <div key={c.id} className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#121827]/95 p-3 shadow-2xl ring-1 ring-emerald-400/40 backdrop-blur-xl">
                    <span className="relative">
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
                        <Avatar user={c.caller ?? { name: '?' }} size={44} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.caller?.name ?? 'Хтось'}</p>
                        <p className="truncate text-xs text-white/55">{c.group ? `дзвонить у «${c.title ?? 'групу'}»` : 'дзвонить вам…'}</p>
                    </div>
                    <button
                        type="button"
                        title="Відхилити"
                        onClick={() => {
                            setDismissed((d) => [...d, c.id]);
                            void api('POST', `/api/v1/calls/${c.id}/decline`).catch(() => undefined);
                        }}
                        className="grid size-10 place-items-center rounded-full bg-rose-500/85 hover:bg-rose-500"
                    >
                        <PhoneOff size={17} />
                    </button>
                    <button
                        type="button"
                        title="Прийняти"
                        onClick={() => {
                            setDismissed((d) => [...d, c.id]);
                            nav.go(`/messages/${c.conversation_id}?answer=${c.id}`);
                        }}
                        className="grid size-10 place-items-center rounded-full bg-emerald-500 hover:bg-emerald-400"
                    >
                        <Phone size={17} />
                    </button>
                </div>
            ))}
        </div>
    );
}

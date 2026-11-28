import { RefreshCw, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';

type Start = { id: string; secret: string; code: string; qr: string; expires_at: string };

/**
 * Вхід через смартфон (як «Увійти через застосунок» на сайті): QR + код із двох цифр, підтвердження
 * в застосунку GameCon на телефоні; 2FA вже пройдено там. Токен одразу йде в Main (зашифрованим).
 */
export function AuthView() {
    const [start, setStart] = useState<Start | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [status, setStatus] = useState<'pending' | 'denied' | 'expired' | 'error'>('pending');
    const [error, setError] = useState<string | null>(null);

    const begin = async (): Promise<void> => {
        setStatus('pending');
        setError(null);
        setQr(null);
        const res = await window.gamecon.request<Start>('POST', '/api/v1/auth/phone');
        if (!res.ok) {
            setStatus('error');
            setError(res.message);
            return;
        }
        setStart(res.data);
        setQr(await QRCode.toDataURL(res.data.qr, { margin: 1, width: 440, color: { dark: '#0f121c', light: '#ffffff' } }));
    };

    useEffect(() => {
        void begin();
    }, []);

    useEffect(() => {
        if (!start || status !== 'pending') return;
        const timer = window.setInterval(async () => {
            const res = await window.gamecon.request<{ status?: string; token?: string }>('GET', `/api/v1/auth/phone/${start.id}?secret=${encodeURIComponent(start.secret)}&device=${encodeURIComponent('GameCon для ПК')}`);
            if (!res.ok) return;
            if (res.data.token) {
                window.clearInterval(timer);
                await window.gamecon.session.save(res.data.token);
            } else if (res.data.status === 'denied' || res.data.status === 'expired') {
                setStatus(res.data.status);
            }
        }, 2000);
        return () => window.clearInterval(timer);
    }, [start, status]);

    return (
        <div className="grid h-full place-items-center p-8">
            <NotchedCard
                className="h-[540px] w-[420px]"
                title="Вхід у GameCon"
                subtitle="Через застосунок на смартфоні"
                glow="cyan"
                badge={<NotchBadge>{start?.code ?? '··'}</NotchBadge>}
                badgeWidth={58}
                badgeHeight={34}
            >
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    {status === 'pending' && qr ? (
                        <>
                            <img src={qr} alt="QR для входу" draggable={false} className="h-56 w-56 rounded-2xl bg-white p-2 shadow-[0_0_40px_rgba(34,211,238,0.25)]" />
                            <p className="max-w-72 text-sm text-white/70">
                                Відкрийте GameCon на телефоні → Меню → «Сканувати QR для входу», наведіть камеру й оберіть код <b className="text-neon-cyan">{start?.code}</b>.
                            </p>
                            <span className="flex items-center gap-2 text-xs text-white/40">
                                <Smartphone size={14} /> Чекаємо підтвердження…
                            </span>
                        </>
                    ) : status === 'pending' ? (
                        <span className="text-sm text-white/50">Готуємо код…</span>
                    ) : (
                        <>
                            <p className="text-sm text-white/70">{status === 'denied' ? 'Вхід відхилено на телефоні.' : status === 'expired' ? 'Час на підтвердження минув.' : error}</p>
                            <button type="button" onClick={() => void begin()} className="no-drag flex items-center gap-2 rounded-full bg-neon-cyan/20 px-4 py-2 text-sm font-semibold text-neon-cyan ring-1 ring-neon-cyan/50 hover:bg-neon-cyan/30">
                                <RefreshCw size={14} /> Новий код
                            </button>
                        </>
                    )}
                </div>
            </NotchedCard>
        </div>
    );
}

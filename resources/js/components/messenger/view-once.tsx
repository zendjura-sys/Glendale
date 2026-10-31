import { usePage } from '@inertiajs/react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ChatAttachment } from '@/types';

/**
 * Фото «на один перегляд»: отримувач відкриває його один раз (сервер віддає файл лише першого разу),
 * після закриття — «Переглянуто». Автор бачить лише позначку.
 */
export function ViewOnceAttachment({
    attachment,
    own,
}: {
    attachment: ChatAttachment;
    own: boolean;
}) {
    const me = usePage().props.auth.user?.id;
    const [opened, setOpened] = useState(
        me !== undefined && (attachment.viewed_by ?? []).includes(me),
    );
    const [src, setSrc] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const seen = (attachment.viewed_by ?? []).length > 0;

    useEffect(
        () => () => {
            if (src) URL.revokeObjectURL(src);
        },
        [src],
    );

    const open = () => {
        if (own || opened || busy) return;
        setBusy(true);
        fetch(`/messages/attachments/${attachment.id}/once`, {
            credentials: 'same-origin',
            cache: 'no-store',
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(tr('Фото вже переглянуто.'));
                setSrc(URL.createObjectURL(await response.blob()));
                setOpened(true);
            })
            .catch((e) => {
                setOpened(true);
                toast.error((e as Error).message);
            })
            .finally(() => setBusy(false));
    };

    const label = own
        ? seen
            ? tr('Фото переглянуто')
            : tr('Фото на один перегляд')
        : opened
          ? tr('Переглянуто')
          : tr('Фото · відкрити один раз');

    return (
        <>
            <button
                type="button"
                onClick={open}
                disabled={own || opened || busy}
                className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition',
                    own || opened
                        ? 'bg-white/[0.06] text-white/60'
                        : 'bg-primary/25 text-white hover:bg-primary/35',
                )}
            >
                {opened || (own && seen) ? (
                    <EyeOff className="size-4" />
                ) : (
                    <Eye className="size-4" />
                )}
                {label}
            </button>
            {src && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={tr('Фото на один перегляд')}
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setSrc(null)}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <img
                        src={src}
                        alt=""
                        draggable={false}
                        className="max-h-full max-w-full rounded-xl object-contain select-none"
                    />
                    <button
                        type="button"
                        aria-label={tr('Закрити')}
                        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white"
                    >
                        <X className="size-5" />
                    </button>
                </div>
            )}
        </>
    );
}

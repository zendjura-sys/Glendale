import { router } from '@inertiajs/react';
import { Check, ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const CHAT_BACKGROUNDS = [
    'aurora',
    'midnight',
    'dusk',
    'ocean',
    'forest',
    'dots',
    'grid',
    'waves',
] as const;

export type ChatBackgroundValue = {
    preset: string | null;
    image: string | null;
} | null;

/** Шар фону під повідомленнями: готовий візерунок або своє фото з затемненням для читабельності. */
export function ChatBackdrop({
    background,
}: {
    background: ChatBackgroundValue | undefined;
}) {
    if (!background) return null;

    return background.image ? (
        <div
            aria-hidden
            className="gc-chat-bg pointer-events-none absolute inset-0 overflow-hidden"
        >
            <img
                src={background.image}
                alt=""
                className="size-full object-cover"
            />
            <div className="gc-chat-bg-shade absolute inset-0" />
        </div>
    ) : (
        <div
            aria-hidden
            className={cn(
                'gc-chat-bg pointer-events-none absolute inset-0',
                `gc-chat-bg-${background.preset}`,
            )}
        />
    );
}

/** Вибір фону: для себе або (адміністраторам групи) для всіх. */
export function ChatBackgroundDialog({
    conversationId,
    open,
    onOpenChange,
    current,
    shared,
    canShare,
}: {
    conversationId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    current: string | null;
    shared: string | null;
    canShare: boolean;
}) {
    const [forAll, setForAll] = useState(false);
    const [busy, setBusy] = useState(false);
    const file = useRef<HTMLInputElement>(null);
    const selected = forAll ? shared : current;
    const labels: Record<string, string> = {
        aurora: tr('Сяйво'),
        midnight: tr('Північ'),
        dusk: tr('Сутінки'),
        ocean: tr('Океан'),
        forest: tr('Ліс'),
        dots: tr('Крапки'),
        grid: tr('Сітка'),
        waves: tr('Хвилі'),
    };
    const save = (data: Record<string, unknown> | FormData) =>
        router.post(`/messages/${conversationId}/background`, data as never, {
            preserveScroll: true,
            preserveState: true,
            only: ['active'],
            forceFormData: data instanceof FormData,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-4 sm:max-w-lg">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {tr('Фон чату')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {forAll
                            ? tr(
                                  'Спільний фон бачать усі учасники, у кого немає свого.',
                              )
                            : tr('Особистий фон бачите лише ви.')}
                    </DialogDescription>
                </div>

                {canShare && (
                    <div className="flex rounded-xl bg-white/[0.04] p-1">
                        {[
                            [false, tr('Для мене')],
                            [true, tr('Для всіх')],
                        ].map(([value, label]) => (
                            <button
                                key={String(value)}
                                type="button"
                                onClick={() => setForAll(value as boolean)}
                                className={cn(
                                    'h-9 flex-1 rounded-lg text-sm font-medium transition',
                                    forAll === value
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                {label as string}
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => save({ preset: null, for_all: forAll })}
                        className={cn(
                            'relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] text-xs text-white/60 transition hover:bg-white/[0.07]',
                            selected === null && 'ring-2 ring-primary',
                        )}
                    >
                        <X className="size-4" />
                        {tr('Без фону')}
                    </button>
                    {CHAT_BACKGROUNDS.map((key) => (
                        <button
                            key={key}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                save({ preset: key, for_all: forAll })
                            }
                            className={cn(
                                'relative aspect-[3/4] overflow-hidden rounded-xl bg-white/[0.03] transition',
                                selected === key && 'ring-2 ring-primary',
                            )}
                        >
                            <span
                                className={cn(
                                    'gc-chat-bg absolute inset-0',
                                    `gc-chat-bg-${key}`,
                                )}
                            />
                            <span className="absolute inset-x-0 bottom-0 bg-black/35 py-1 text-center text-[11px] font-medium text-white">
                                {labels[key]}
                            </span>
                            {selected === key && (
                                <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                                    <Check className="size-3" />
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => file.current?.click()}
                        className={cn(
                            'relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] text-xs text-white/60 transition hover:bg-white/[0.07]',
                            selected?.startsWith('img:') &&
                                'ring-2 ring-primary',
                        )}
                    >
                        {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <ImagePlus className="size-4" />
                        )}
                        {tr('Своє фото')}
                    </button>
                </div>
                <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                        const picked = event.target.files?.[0];
                        event.target.value = '';
                        if (!picked) return;
                        const data = new FormData();
                        data.append('image', picked);
                        data.append('for_all', forAll ? '1' : '0');
                        save(data);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

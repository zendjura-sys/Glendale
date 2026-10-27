import {
    Download,
    Eye,
    FileText,
    Image as ImageIcon,
    Link2,
    Loader2,
    Mic,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { DocPreviewDialog } from './doc-preview';
import type { PreviewFile, PreviewKind } from './doc-preview';

type Kind = 'media' | 'files' | 'links' | 'voice';

type SharedItem = {
    id: number | string;
    message_id: number;
    type?: string;
    url: string;
    preview?: PreviewKind | null;
    name?: string | null;
    mime?: string | null;
    size?: number | null;
    duration?: number | null;
    host?: string;
    author: string | null;
    created_at: string;
};

type Page = {
    items: SharedItem[];
    next: number | null;
    counts: Record<Kind, number> | null;
};

const KINDS: { value: Kind; icon: LucideIcon }[] = [
    { value: 'media', icon: ImageIcon },
    { value: 'files', icon: FileText },
    { value: 'links', icon: Link2 },
    { value: 'voice', icon: Mic },
];

/**
 * «Матеріали чату»: фото й кружки, файли, посилання й голосові з бесіди.
 * Клік по елементу — перехід до повідомлення в історії.
 */
export function ChatSharedDialog({
    conversationId,
    open,
    onOpenChange,
    onJump,
}: {
    conversationId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onJump: (messageId: number) => void;
}) {
    const [kind, setKind] = useState<Kind>('media');
    const [items, setItems] = useState<SharedItem[]>([]);
    const [next, setNext] = useState<number | null>(null);
    const [counts, setCounts] = useState<Record<Kind, number> | null>(null);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<PreviewFile | null>(null);

    const load = useCallback(
        (which: Kind, before: number | null) => {
            setLoading(true);
            const query = new URLSearchParams({ kind: which });
            if (before) query.set('before', String(before));
            void api<Page>('GET', `/messages/${conversationId}/shared?${query}`)
                .then((page) => {
                    setItems((current) =>
                        before ? [...current, ...page.items] : page.items,
                    );
                    setNext(page.next);
                    if (page.counts) setCounts(page.counts);
                })
                .finally(() => setLoading(false));
        },
        [conversationId],
    );

    useEffect(() => {
        if (open) load(kind, null);
    }, [open, kind, load]);

    const labels: Record<Kind, string> = {
        media: tr('Медіа'),
        files: tr('Файли'),
        links: tr('Посилання'),
        voice: tr('Голосові'),
    };
    const jump = (id: number) => {
        onOpenChange(false);
        window.setTimeout(() => onJump(id), 150);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 sm:max-w-2xl">
                    <div>
                        <DialogTitle className="font-display text-lg font-semibold text-white">
                            {tr('Матеріали чату')}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/50">
                            {tr(
                                'Усе, чим ділилися в бесіді. Натисніть, щоб перейти до повідомлення.',
                            )}
                        </DialogDescription>
                    </div>

                    <div className="flex gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
                        {KINDS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => {
                                    setItems([]);
                                    setKind(item.value);
                                }}
                                className={cn(
                                    'inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition',
                                    kind === item.value
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white',
                                )}
                            >
                                <item.icon className="size-4" />
                                {labels[item.value]}
                                {counts && counts[item.value] > 0 && (
                                    <span className="text-[11px] text-white/45 tabular-nums">
                                        {counts[item.value]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="-mx-1 max-h-[60dvh] min-h-48 overflow-y-auto px-1">
                        {items.length === 0 && !loading && (
                            <p className="py-12 text-center text-sm text-white/45">
                                {tr('Тут поки нічого немає.')}
                            </p>
                        )}

                        {kind === 'media' && items.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                                {items.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => jump(item.message_id)}
                                        className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.04]"
                                    >
                                        {item.type === 'video_note' ? (
                                            <video
                                                src={item.url}
                                                muted
                                                preload="metadata"
                                                className="size-full rounded-full object-cover p-1"
                                            />
                                        ) : (
                                            <img
                                                src={item.url}
                                                alt=""
                                                loading="lazy"
                                                className="size-full object-cover transition group-hover:scale-[1.03]"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {kind !== 'media' && items.length > 0 && (
                            <ul className="divide-y divide-white/[0.06]">
                                {items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex items-center gap-3 py-2.5"
                                    >
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/60">
                                            {kind === 'files' ? (
                                                <FileText className="size-4" />
                                            ) : kind === 'links' ? (
                                                <Link2 className="size-4" />
                                            ) : (
                                                <Mic className="size-4" />
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                jump(item.message_id)
                                            }
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <span className="block truncate text-sm font-medium text-white">
                                                {kind === 'links'
                                                    ? item.url
                                                    : kind === 'voice'
                                                      ? tr(
                                                            'Голосове повідомлення',
                                                        )
                                                      : (item.name ??
                                                        tr('Файл'))}
                                            </span>
                                            <span className="block truncate text-xs text-white/45">
                                                {[
                                                    kind === 'links'
                                                        ? item.host
                                                        : kind === 'files'
                                                          ? formatBytes(
                                                                item.size,
                                                            )
                                                          : item.duration
                                                            ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}`
                                                            : null,
                                                    item.author,
                                                    formatDate(
                                                        item.created_at,
                                                        false,
                                                    ),
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </span>
                                        </button>
                                        {kind === 'files' && item.preview && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPreview({
                                                        id: Number(item.id),
                                                        name: item.name,
                                                        url: item.url,
                                                        size: item.size,
                                                        preview: item.preview,
                                                    })
                                                }
                                                aria-label={tr('Переглянути')}
                                                title={tr('Переглянути')}
                                                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.07] hover:text-white"
                                            >
                                                <Eye className="size-4" />
                                            </button>
                                        )}
                                        {kind === 'files' && (
                                            <a
                                                href={item.url}
                                                download={item.name ?? true}
                                                aria-label={tr('Завантажити')}
                                                title={tr('Завантажити')}
                                                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/[0.07] hover:text-white"
                                            >
                                                <Download className="size-4" />
                                            </a>
                                        )}
                                        {kind === 'links' && (
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer nofollow"
                                                className="shrink-0 text-xs font-semibold text-gc-lilac-300 hover:underline"
                                            >
                                                {tr('Відкрити')}
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}

                        {loading && (
                            <div className="flex justify-center py-6">
                                <Loader2 className="size-5 animate-spin text-white/45" />
                            </div>
                        )}
                        {next && !loading && (
                            <button
                                type="button"
                                onClick={() => load(kind, next)}
                                className="mt-3 h-10 w-full rounded-xl bg-white/[0.05] text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                            >
                                {tr('Показати ще')}
                            </button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <DocPreviewDialog file={preview} onClose={() => setPreview(null)} />
        </>
    );
}

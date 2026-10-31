import { Download, FileQuestion } from 'lucide-react';
import { TextSkeleton } from '@/components/gc/skeletons';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatBytes } from '@/lib/format';
import { tr } from '@/lib/i18n';

export type PreviewKind = 'pdf' | 'text' | 'image' | 'audio' | 'video';

export type PreviewFile = {
    id: number;
    name?: string | null;
    url: string;
    size?: number | null;
    preview?: PreviewKind | null;
};

/** Текстовий файл: перші 64 КБ, як прийшли з сервера (без розмітки). */
function TextBody({ src }: { src: string }) {
    const [text, setText] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch(src, { credentials: 'same-origin' })
            .then((response) =>
                response.ok ? response.text() : Promise.reject(),
            )
            .then((body) => alive && setText(body))
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, [src]);

    if (failed) {
        return (
            <p className="p-6 text-center text-sm text-white/55">
                {tr('Не вдалося відкрити файл.')}
            </p>
        );
    }
    if (text === null) {
        return (
            <TextSkeleton lines={10} className="rounded-xl bg-black/20 p-4" />
        );
    }

    return (
        <pre className="max-h-[70dvh] overflow-auto rounded-xl bg-black/30 p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-white/85">
            {text}
        </pre>
    );
}

/** Документ із чату — переглянути тут: PDF, текст, картинка, аудіо, відео. */
export function DocPreviewDialog({
    file,
    onClose,
}: {
    file: PreviewFile | null;
    onClose: () => void;
}) {
    const src = file ? `/messages/attachments/${file.id}/preview` : '';

    return (
        <Dialog
            open={file !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="gap-4 sm:max-w-3xl">
                {file && (
                    <>
                        <div className="flex min-w-0 items-start gap-3 pr-8">
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="truncate font-display text-base font-semibold text-white">
                                    {file.name ?? tr('Файл')}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-white/45">
                                    {formatBytes(file.size)}
                                </DialogDescription>
                            </div>
                            <a
                                href={file.url}
                                download={file.name ?? true}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-medium text-white transition hover:bg-white/[0.11]"
                            >
                                <Download className="size-4" />
                                {tr('Завантажити')}
                            </a>
                        </div>
                        {file.preview === 'pdf' && (
                            <iframe
                                src={src}
                                title={file.name ?? 'PDF'}
                                className="h-[70dvh] w-full rounded-xl bg-white"
                            />
                        )}
                        {file.preview === 'text' && <TextBody src={src} />}
                        {file.preview === 'image' && (
                            <img
                                src={src}
                                alt=""
                                className="max-h-[70dvh] w-full rounded-xl object-contain"
                            />
                        )}
                        {file.preview === 'audio' && (
                            <audio src={src} controls className="w-full" />
                        )}
                        {file.preview === 'video' && (
                            <video
                                src={src}
                                controls
                                className="max-h-[70dvh] w-full rounded-xl bg-black"
                            />
                        )}
                        {!file.preview && (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-white/55">
                                <FileQuestion className="size-8 text-white/35" />
                                {tr('Цей файл можна лише завантажити.')}
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

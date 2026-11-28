import { router } from '@inertiajs/react';
import { BadgeCheck, Check, Copy, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Значок перевіреного сервера біля назви. */
export function ServerVerifiedBadge({ className }: { className?: string }) {
    return (
        <BadgeCheck
            aria-label={tr('Перевірений сервер')}
            className={cn('size-4 shrink-0 text-sky-400', className)}
        >
            <title>{tr('Перевірений сервер')}</title>
        </BadgeCheck>
    );
}

export type VerificationData = {
    verified: boolean;
    verified_at: string | null;
    requested: boolean;
    can_manage: boolean;
    requirements: { key: string; done: boolean }[] | null;
    meta: string | null;
    has_website: boolean;
};

function requirementLabel(key: string): string {
    switch (key) {
        case 'owner':
            return tr('Власника сервера підтверджено на GameCon');
        case 'profile':
            return tr('Є опис та іконка');
        case 'links':
            return tr('Вказано сайт або Discord');
        case 'age':
            return tr('Сторінці сервера щонайменше 7 днів');
        default:
            return key;
    }
}

/** Блок «Значок перевіреного сервера»: власнику — умови й код, персоналу — видати/зняти. */
export function ServerVerificationPanel({
    slug,
    data,
}: {
    slug: string;
    data: VerificationData;
}) {
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!data.requirements && !data.can_manage) return null;

    const act = (action: 'check' | 'request' | 'grant' | 'revoke') => {
        setBusy(true);
        router.post(
            `/servers/${slug}/verify`,
            { action },
            { preserveScroll: true, onFinish: () => setBusy(false) },
        );
    };
    const ready = data.requirements?.every((r) => r.done) ?? false;

    return (
        <section className="gc-solid space-y-3 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <ShieldCheck className="size-5 text-sky-400" />
                {tr('Значок перевіреного сервера')}
            </h2>
            {data.verified ? (
                <p className="flex items-center gap-2 text-sm text-white/75">
                    <ServerVerifiedBadge />
                    {tr(
                        'Сервер перевірено — значок видно в каталозі й на сторінці.',
                    )}
                </p>
            ) : (
                data.requirements && (
                    <>
                        <ul className="space-y-1.5">
                            {data.requirements.map((r) => (
                                <li
                                    key={r.key}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    {r.done ? (
                                        <Check className="size-4 text-emerald-400" />
                                    ) : (
                                        <X className="size-4 text-white/35" />
                                    )}
                                    <span
                                        className={
                                            r.done
                                                ? 'text-white/80'
                                                : 'text-white/50'
                                        }
                                    >
                                        {requirementLabel(r.key)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {data.has_website && data.meta && (
                            <div className="space-y-2">
                                <p className="text-sm text-white/60">
                                    {tr(
                                        'Додайте цей тег у <head> головної сторінки сайту сервера й натисніть «Перевірити»:',
                                    )}
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="gc-solid-2 min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-xs text-white/80">
                                        {data.meta}
                                    </code>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="secondary"
                                        aria-label={tr('Копіювати')}
                                        onClick={() => {
                                            void navigator.clipboard
                                                ?.writeText(data.meta ?? '')
                                                .then(() => setCopied(true));
                                        }}
                                    >
                                        {copied ? (
                                            <Check className="size-4" />
                                        ) : (
                                            <Copy className="size-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {data.has_website && (
                                <Button
                                    disabled={!ready || busy}
                                    onClick={() => act('check')}
                                >
                                    {tr('Перевірити')}
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                disabled={!ready || busy || data.requested}
                                onClick={() => act('request')}
                            >
                                {data.requested
                                    ? tr('Запит надіслано')
                                    : tr('Попросити ручну перевірку')}
                            </Button>
                        </div>
                    </>
                )
            )}
            {data.can_manage && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                    <span className="text-xs text-white/45">
                        {tr('Персонал')}
                        {data.requested && ` · ${tr('є запит на перевірку')}`}
                    </span>
                    <Button
                        size="sm"
                        variant={data.verified ? 'outline' : 'secondary'}
                        disabled={busy}
                        onClick={() => act(data.verified ? 'revoke' : 'grant')}
                    >
                        {data.verified
                            ? tr('Зняти значок')
                            : tr('Видати значок')}
                    </Button>
                </div>
            )}
        </section>
    );
}

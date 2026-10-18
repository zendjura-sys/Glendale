import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

/** Керівник отримує посилання на 14 днів і одразу копіює його. */
export function InviteLinkButton({
    url,
    className,
}: {
    url: string;
    className?: string;
}) {
    const [busy, setBusy] = useState(false);

    return (
        <button
            type="button"
            disabled={busy}
            className={className}
            onClick={() => {
                setBusy(true);
                api<{ url: string }>('POST', url)
                    .then(async (data) => {
                        await navigator.clipboard.writeText(data.url);
                        toast(tr('Посилання скопійовано'));
                    })
                    .catch(() => toast(tr('Не вдалося створити посилання')))
                    .finally(() => setBusy(false));
            }}
        >
            <Link2 className="size-4" /> {tr('Посилання')}
        </button>
    );
}

import { Link } from '@inertiajs/react';
import { Clapperboard, Headphones } from 'lucide-react';
import { tr } from '@/lib/i18n';

export type PartyInviteData = {
    kind: 'listen' | 'watch';
    title: string;
    path: string;
};

// «🎧 Слухаймо разом …: https://…/listen/код» або «🎬 Запрошую дивитися разом …: https://…/watch/код».
const PATTERN =
    /^\s*(?:🎧|🎬)?\s*(.+?):\s*https?:\/\/[^\s/]+\/(listen|watch)\/([A-Za-z0-9_-]+)\s*$/u;

/** Повідомлення-запрошення слухати чи дивитися разом — замість посилання показуємо картку з кнопкою. */
export function parsePartyInvite(body: string | null): PartyInviteData | null {
    const match = body ? PATTERN.exec(body) : null;
    if (!match) return null;

    return {
        kind: match[2] as 'listen' | 'watch',
        title: match[1].trim(),
        path: `/${match[2]}/${match[3]}`,
    };
}

export function PartyInvite({ invite }: { invite: PartyInviteData }) {
    const Icon = invite.kind === 'listen' ? Headphones : Clapperboard;

    return (
        <div className="flex min-w-[220px] flex-col gap-3 py-1">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
                    <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs text-white/50">
                        {invite.kind === 'listen'
                            ? tr('Запрошення слухати разом')
                            : tr('Запрошення дивитися разом')}
                    </p>
                    <p className="font-medium break-words">{invite.title}</p>
                </div>
            </div>
            <Link
                href={invite.path}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
                <Icon className="size-4" />
                {tr('Приєднатися')}
            </Link>
        </div>
    );
}

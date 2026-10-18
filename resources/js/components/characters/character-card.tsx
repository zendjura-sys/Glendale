import { Link } from '@inertiajs/react';
import { Drama, Plus, Star } from 'lucide-react';
import { Widget } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CharacterCardData = {
    id: number;
    name: string;
    age: number | null;
    occupation: string | null;
    bio: string | null;
    portrait_url: string | null;
    status: 'active' | 'retired' | 'dead';
    status_label: string;
    is_main: boolean;
    href: string;
    server: { slug: string; name: string; icon: string | null };
    family: { slug: string; name: string; tag: string } | null;
    player: { name: string; username: string; avatar_url: string | null };
};

export const STATUS_LABELS = (): Record<string, string> => ({
    active: tr('Грає'),
    retired: tr('На паузі'),
    dead: tr('Загинув'),
});

export const STATUS_TONE: Record<string, string> = {
    active: 'bg-emerald-400/10 text-emerald-200',
    retired: 'bg-white/[0.06] text-white/60',
    dead: 'bg-rose-400/10 text-rose-200',
};

/** Портрет персонажа: фото або ініціали на тлі акценту. */
export function CharacterPortrait({
    character,
    className,
}: {
    character: Pick<CharacterCardData, 'name' | 'portrait_url' | 'status'>;
    className?: string;
}) {
    return character.portrait_url ? (
        <img
            src={character.portrait_url}
            alt=""
            loading="lazy"
            className={cn(
                'object-cover',
                character.status === 'dead' && 'grayscale',
                className,
            )}
        />
    ) : (
        <span
            aria-hidden
            className={cn(
                'flex items-center justify-center bg-gc-indigo/20 font-display font-bold text-[#c4b5fd]',
                className,
            )}
        >
            {character.name.slice(0, 1).toUpperCase()}
        </span>
    );
}

/** Рядок персонажа: портрет, ім’я, сервер, сім’я. */
export function CharacterRow({
    character,
    showPlayer = false,
}: {
    character: CharacterCardData;
    showPlayer?: boolean;
}) {
    const subtitle = [
        showPlayer ? character.player.name : character.server.name,
        character.family ? `[${character.family.tag}]` : null,
        character.occupation,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <Link
            href={character.href}
            className="flex min-w-0 items-center gap-3 rounded-2xl px-1.5 py-1.5 transition hover:bg-white/[0.05]"
        >
            <CharacterPortrait
                character={character}
                className="size-12 shrink-0 rounded-xl text-lg"
            />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">
                        {character.name}
                    </span>
                    {character.is_main && (
                        <Star
                            className="size-3.5 shrink-0 fill-amber-300 text-amber-300"
                            aria-label={tr('Головний персонаж')}
                        />
                    )}
                </span>
                <span className="block truncate text-xs text-white/45">
                    {subtitle}
                </span>
            </span>
            {character.status !== 'active' && (
                <span
                    className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        STATUS_TONE[character.status],
                    )}
                >
                    {STATUS_LABELS()[character.status]}
                </span>
            )}
        </Link>
    );
}

/** Блок «Персонажі RP» у профілі. */
export function CharactersWidget({
    characters,
    isSelf,
}: {
    characters: CharacterCardData[];
    isSelf: boolean;
}) {
    return (
        <Widget
            title={tr('Персонажі RP')}
            icon={Drama}
            action={
                isSelf && (
                    <Link
                        href="/characters/create"
                        className="inline-flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white"
                    >
                        <Plus className="size-3.5" />
                        {tr('Новий')}
                    </Link>
                )
            }
        >
            {characters.length === 0 ? (
                <p className="px-1 text-sm text-white/50">
                    {tr(
                        'Створіть персонажа: ім’я, біографія, сім’я й історія на сервері.',
                    )}
                </p>
            ) : (
                <div className="space-y-0.5">
                    {characters.map((character) => (
                        <CharacterRow
                            key={character.id}
                            character={character}
                        />
                    ))}
                </div>
            )}
        </Widget>
    );
}

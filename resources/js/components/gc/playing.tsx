import { Link, router } from '@inertiajs/react';
import { Gamepad2, Loader2, Search, Server, Unplug, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PlayingInfo, UserCard } from '@/types';
import { UserAvatar } from './user-avatar';
import { tr } from '@/lib/i18n';

/** «Грає в…»: сервер GTA або гра, з іконкою й посиланням. */
export function PlayingBadge({
    playing,
    className,
}: {
    playing: PlayingInfo;
    className?: string;
}) {
    const Icon = playing.kind === 'server' ? Server : Gamepad2;
    const content = (
        <>
            {playing.icon ? (
                <img
                    loading="lazy"
                    decoding="async"
                    src={playing.icon}
                    alt=""
                    className="size-4 shrink-0 rounded object-cover"
                />
            ) : (
                <Icon className="size-3.5 shrink-0" />
            )}
            <span className="truncate">
                {tr('Грає в')} {playing.label}
                {playing.note && (
                    <span className="text-emerald-200/70">
                        {' '}
                        · {playing.note}
                    </span>
                )}
            </span>
        </>
    );
    const style = cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-chip bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-200',
        className,
    );

    return playing.url ? (
        <Link
            href={playing.url}
            className={cn(style, 'hover:bg-emerald-500/20')}
        >
            {content}
        </Link>
    ) : (
        <span className={style}>{content}</span>
    );
}

/** «Зараз грають» на сторінці сервера чи гри. */
export function PlayingNow({
    users,
    count,
}: {
    users: UserCard[];
    count: number;
}) {
    if (count === 0) return null;

    return (
        <section className="glass rounded-2xl p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-white">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153)]" />
                {tr('Зараз грають:')} {count}
            </h2>
            <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                    <Link
                        key={u.id}
                        href={`/${u.username}`}
                        className="flex items-center gap-2 rounded-xl bg-white/[0.04] py-1 pr-3 pl-1 text-sm text-white/80 hover:bg-white/[0.08]"
                    >
                        <UserAvatar user={u} size="xs" />
                        {u.name}
                    </Link>
                ))}
            </div>
        </section>
    );
}

type Option = {
    kind: 'server' | 'game';
    id: number;
    label: string;
    icon: string | null;
    hint: string;
};

type Settings = {
    playing: PlayingInfo | null;
    auto: boolean;
    discord: { linked: boolean; available: boolean };
    steam: { linked: boolean; available: boolean; profile: string | null };
    xbox?: string;
    playstation?: string;
    hours: number[];
};

/** Налаштування «Граю в…»: автоматично (Discord, Steam, телефон) або вручну. */
export function PlayingDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [q, setQ] = useState('');
    const [options, setOptions] = useState<Option[]>([]);
    const [picked, setPicked] = useState<Option | null>(null);
    const [note, setNote] = useState('');
    const [hours, setHours] = useState(3);
    const [steam, setSteam] = useState('');
    const [xbox, setXbox] = useState('');
    const [playstation, setPlaystation] = useState('');

    const load = () =>
        void api<Settings>('GET', '/me/playing')
            .then((next) => {
                setSettings(next);
                setXbox(next.xbox ?? '');
                setPlaystation(next.playstation ?? '');
            })
            .catch(() => undefined);

    useEffect(() => {
        if (open) load();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => {
            void api<{ servers: Option[]; games: Option[] }>(
                'GET',
                `/me/playing/search?q=${encodeURIComponent(q)}`,
            )
                .then((d) => setOptions([...d.servers, ...d.games]))
                .catch(() => setOptions([]));
        }, 250);

        return () => window.clearTimeout(timer);
    }, [q, open]);

    const act = (method: 'put' | 'post' | 'delete', url: string, data = {}) =>
        router.visit(url, {
            method,
            data,
            preserveScroll: true,
            onSuccess: () => load(),
            onError: (errors) =>
                toast.error(
                    Object.values(errors)[0] ?? tr('Не вдалося зберегти.'),
                ),
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                <DialogTitle>{tr('Граю в…')}</DialogTitle>
                <DialogDescription>
                    {tr(
                        'Статус біля аватарки: де ви зараз грають. Ставиться сам або вручну.',
                    )}
                </DialogDescription>
                {!settings ? (
                    <Loader2 className="mx-auto my-6 size-6 animate-spin text-white/40" />
                ) : (
                    <div className="space-y-5">
                        {settings.playing && (
                            <div className="flex items-center gap-2">
                                <PlayingBadge playing={settings.playing} />
                                <span className="text-xs text-white/40">
                                    {settings.playing.auto
                                        ? tr('автоматично')
                                        : tr('вручну')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => act('delete', '/me/playing')}
                                    className="ml-auto rounded-lg p-1.5 text-white/40 hover:text-rose-300"
                                    aria-label={tr('Прибрати статус')}
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        )}

                        <section className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
                            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                                {tr('Автоматично')}
                                <input
                                    type="checkbox"
                                    checked={settings.auto}
                                    onChange={(e) =>
                                        act('put', '/me/playing/auto', {
                                            auto: e.target.checked,
                                        })
                                    }
                                />
                            </label>
                            <p className="text-xs text-white/50">
                                {tr(
                                    'Discord: гра й сервер GTA з вашого статусу в Discord (потрібні прив’язаний Discord і участь у Discord-сервері GameCon). Steam: ігри на ПК. Телефон: ігри на Android — у застосунку GameCon (Налаштування → «Граю в…»).',
                                )}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span
                                    className={cn(
                                        'rounded-lg px-2 py-1 text-xs',
                                        settings.discord.linked
                                            ? 'bg-emerald-500/15 text-emerald-200'
                                            : 'bg-white/[0.05] text-white/60',
                                    )}
                                >
                                    Discord:{' '}
                                    {settings.discord.linked
                                        ? tr('прив’язано')
                                        : tr('не прив’язано')}
                                </span>
                                {!settings.discord.linked && (
                                    <a
                                        href="/auth/discord"
                                        className="text-xs text-gc-lilac-200 hover:text-white"
                                    >
                                        {tr('Прив’язати Discord →')}
                                    </a>
                                )}
                            </div>
                            {settings.steam.available &&
                                (settings.steam.linked ? (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-200">
                                            {tr('Steam: прив’язано')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                act(
                                                    'delete',
                                                    '/me/playing/steam',
                                                )
                                            }
                                            className="inline-flex items-center gap-1 text-white/45 hover:text-rose-300"
                                        >
                                            <Unplug className="size-3.5" />{' '}
                                            {tr('Відв’язати')}
                                        </button>
                                    </div>
                                ) : (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            act('post', '/me/playing/steam', {
                                                profile: steam,
                                            });
                                        }}
                                        className="flex gap-2"
                                    >
                                        <input
                                            value={steam}
                                            onChange={(e) =>
                                                setSteam(e.target.value)
                                            }
                                            placeholder={tr(
                                                'Посилання на профіль Steam',
                                            )}
                                            className="input-glass h-9 min-w-0 flex-1 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                        />
                                        <button
                                            type="submit"
                                            className="glass h-9 rounded-lg px-3 text-sm text-white/80 hover:text-white"
                                        >
                                            {tr('Прив’язати')}
                                        </button>
                                    </form>
                                ))}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    act('put', '/me/playing/consoles', {
                                        xbox,
                                        playstation,
                                    });
                                }}
                                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                            >
                                <input
                                    value={xbox}
                                    onChange={(e) => setXbox(e.target.value)}
                                    placeholder={tr('Xbox gamertag')}
                                    className="input-glass h-9 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                />
                                <input
                                    value={playstation}
                                    onChange={(e) =>
                                        setPlaystation(e.target.value)
                                    }
                                    placeholder={tr('PlayStation ID')}
                                    className="input-glass h-9 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    className="glass h-9 rounded-lg px-3 text-sm text-white/80 hover:text-white"
                                >
                                    {tr('Зберегти')}
                                </button>
                            </form>
                        </section>

                        <section className="space-y-2">
                            <h3 className="text-sm font-semibold text-white">
                                {tr('Вручну')}
                            </h3>
                            <label className="input-glass flex h-10 items-center gap-2 rounded-xl px-3">
                                <Search className="size-4 text-white/35" />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder={tr('Сервер GTA або гра')}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                                />
                            </label>
                            <div className="max-h-56 space-y-1 overflow-y-auto">
                                {options.map((o) => (
                                    <button
                                        key={`${o.kind}:${o.id}`}
                                        type="button"
                                        onClick={() => setPicked(o)}
                                        className={cn(
                                            'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition',
                                            picked?.kind === o.kind &&
                                                picked.id === o.id
                                                ? 'bg-[var(--accent)]/20'
                                                : 'hover:bg-white/[0.05]',
                                        )}
                                    >
                                        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.06]">
                                            {o.icon ? (
                                                <img
                                                    loading="lazy"
                                                    decoding="async"
                                                    src={o.icon}
                                                    alt=""
                                                    className="size-full object-cover"
                                                />
                                            ) : o.kind === 'server' ? (
                                                <Server className="size-4 text-white/45" />
                                            ) : (
                                                <Gamepad2 className="size-4 text-white/45" />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm text-white">
                                                {o.label}
                                            </span>
                                            <span className="block text-xs text-white/40">
                                                {o.hint}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {picked && (
                                <div className="grid grid-cols-[1fr_auto] gap-2">
                                    <input
                                        value={note}
                                        maxLength={60}
                                        onChange={(e) =>
                                            setNote(e.target.value)
                                        }
                                        placeholder={tr(
                                            'Підпис: сім’я, персонаж… (необов’язково)',
                                        )}
                                        className="input-glass h-10 min-w-0 rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                                    />
                                    <select
                                        value={hours}
                                        onChange={(e) =>
                                            setHours(Number(e.target.value))
                                        }
                                        className="input-glass h-10 rounded-xl px-2 text-sm text-white"
                                        aria-label={tr('На скільки')}
                                    >
                                        {settings.hours.map((h) => (
                                            <option key={h} value={h}>
                                                {tr('на')} {h} {tr('год')}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            act('put', '/me/playing', {
                                                kind: picked.kind,
                                                id: picked.id,
                                                note,
                                                hours,
                                            })
                                        }
                                        className="btn-glow col-span-2 h-10 rounded-xl text-sm font-semibold"
                                    >
                                        {tr('Поставити «Граю в')} {picked.label}
                                        »
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Налаштування → Профіль: поточний статус «Граю в…» і кнопка налаштувань. */
export function PlayingSettingsCard() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<Settings | null>(null);
    const load = () =>
        void api<Settings>('GET', '/me/playing')
            .then(setSettings)
            .catch(() => undefined);

    useEffect(load, []);

    return (
        <div className="gc-group mt-7 p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-[min(100%,16rem)] flex-1">
                    <h2 className="text-[17px] font-semibold text-white">
                        {tr('Граю в…')}
                    </h2>
                    <p className="mt-1 text-sm text-white/45">
                        {settings?.auto
                            ? tr(
                                  'Статус ставиться автоматично з Discord, Steam чи застосунку й показується у профілі, лише поки ви граєте.',
                              )
                            : tr(
                                  'Статус показується у профілі, лише поки ви граєте.',
                              )}
                    </p>
                    {settings?.playing && (
                        <div className="mt-3">
                            <PlayingBadge playing={settings.playing} />
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                    <Gamepad2 className="size-4" /> {tr('Налаштувати')}
                </button>
            </div>
            <PlayingDialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);
                    if (!next) load();
                }}
            />
        </div>
    );
}

import { Head, Link, router, useForm } from '@inertiajs/react';
import { Plus, Radar, UserRoundSearch, X } from 'lucide-react';
import { useState } from 'react';
import { selectClass } from '@/components/gc/admin';
import { EmptyState } from '@/components/gc/widget';
import { PARTY_PLATFORMS, PartyCard } from '@/components/party/party-card';
import type { PartyCardData } from '@/components/party/party-card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Option = { slug: string; name: string };

type Props = {
    parties: PartyCardData[];
    filters: {
        game: string | null;
        server: string | null;
        platform: string | null;
    };
    options: {
        platforms: Record<string, string>;
        games: Option[];
        servers: Option[];
    };
};

const fieldClass =
    'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Час у форматі для <input type="datetime-local">. */
function localInput(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function PartyBoard({ parties, filters, options }: Props) {
    const [creating, setCreating] = useState(false);
    const [role, setRole] = useState('');
    const [later, setLater] = useState(false);
    const form = useForm({
        title: '',
        note: '',
        game: filters.game ?? '',
        server: filters.server ?? '',
        platform: filters.platform ?? '',
        roles: [] as string[],
        slots: 4,
        starts_at: '',
    });

    const visit = (patch: Partial<Props['filters']>) => {
        const next = { ...filters, ...patch };
        router.get(
            '/party',
            {
                game: next.game || undefined,
                server: next.server || undefined,
                platform: next.platform || undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const addRole = () => {
        const value = role.trim();
        if (
            !value ||
            form.data.roles.includes(value) ||
            form.data.roles.length >= 5
        )
            return;
        form.setData('roles', [...form.data.roles, value]);
        setRole('');
    };

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            game: data.game || null,
            server: data.server || null,
            platform: data.platform || null,
            starts_at:
                later && data.starts_at
                    ? new Date(data.starts_at).toISOString()
                    : null,
        }));
        form.post('/party', { onSuccess: () => setCreating(false) });
    };

    return (
        <>
            <Head title={tr('Пошук паті')} />
            <div className="space-y-5">
                <section className="glass rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                                <UserRoundSearch className="size-6 text-gc-lilac-300" />
                                {tr('Пошук паті')}
                            </h1>
                            <p className="mt-1 text-sm text-white/50">
                                {tr(
                                    'Знайдіть, з ким зіграти: гра, сервер, час і ролі. У кожної паті — своя голосова кімната.',
                                )}
                            </p>
                        </div>
                        <Link
                            href="/party/match"
                            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.12] sm:w-auto"
                        >
                            <Radar className="size-4" />
                            {tr('Підбір тиммейтів')}
                        </Link>
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="btn-glow inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold sm:w-auto"
                        >
                            <Plus className="size-4" />
                            {tr('Шукаю паті')}
                        </button>
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-3">
                        <select
                            value={filters.game ?? ''}
                            onChange={(e) =>
                                visit({ game: e.target.value || null })
                            }
                            className={cn(selectClass, 'h-11 w-full min-w-0')}
                            aria-label={tr('Гра')}
                        >
                            <option value="">{tr('Усі ігри')}</option>
                            {options.games.map((game) => (
                                <option key={game.slug} value={game.slug}>
                                    {game.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filters.server ?? ''}
                            onChange={(e) =>
                                visit({ server: e.target.value || null })
                            }
                            className={cn(selectClass, 'h-11 w-full min-w-0')}
                            aria-label={tr('Сервер')}
                        >
                            <option value="">{tr('Усі сервери')}</option>
                            {options.servers.map((server) => (
                                <option key={server.slug} value={server.slug}>
                                    {server.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filters.platform ?? ''}
                            onChange={(e) =>
                                visit({ platform: e.target.value || null })
                            }
                            className={cn(selectClass, 'h-11 w-full min-w-0')}
                            aria-label={tr('Платформа')}
                        >
                            <option value="">{tr('Усі платформи')}</option>
                            {Object.entries(PARTY_PLATFORMS()).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ),
                            )}
                        </select>
                    </div>
                </section>

                {parties.length === 0 ? (
                    <EmptyState
                        icon={UserRoundSearch}
                        title={tr('Поки ніхто не шукає')}
                        text={tr(
                            'Створіть оголошення першим — друзі й гравці побачать його тут.',
                        )}
                        action={
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold"
                            >
                                {tr('Шукаю паті')}
                            </button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {parties.map((party) => (
                            <PartyCard key={party.id} party={party} />
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent className="glass-strong max-h-[92dvh] overflow-y-auto rounded-dialog border-white/10 p-6 text-white sm:max-w-lg">
                    <DialogTitle className="font-display text-xl">
                        {tr('Шукаю паті')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/50">
                        {tr('Оголошення зникне через 3 години після старту.')}
                    </DialogDescription>
                    <form onSubmit={submit} className="space-y-3">
                        <input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            maxLength={120}
                            required
                            placeholder={tr(
                                'Наприклад, рейд на склад, потрібен снайпер',
                            )}
                            className={fieldClass}
                        />
                        {form.errors.title && (
                            <p className="text-xs text-rose-300">
                                {form.errors.title}
                            </p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                            <select
                                value={form.data.game}
                                onChange={(e) =>
                                    form.setData('game', e.target.value)
                                }
                                className={cn(
                                    selectClass,
                                    'h-11 w-full min-w-0',
                                )}
                                aria-label={tr('Гра')}
                            >
                                <option value="">
                                    {tr('Гра (необов’язково)')}
                                </option>
                                {options.games.map((game) => (
                                    <option key={game.slug} value={game.slug}>
                                        {game.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={form.data.server}
                                onChange={(e) =>
                                    form.setData('server', e.target.value)
                                }
                                className={cn(
                                    selectClass,
                                    'h-11 w-full min-w-0',
                                )}
                                aria-label={tr('Сервер')}
                            >
                                <option value="">
                                    {tr('Сервер (необов’язково)')}
                                </option>
                                {options.servers.map((server) => (
                                    <option
                                        key={server.slug}
                                        value={server.slug}
                                    >
                                        {server.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={form.data.platform}
                                onChange={(e) =>
                                    form.setData('platform', e.target.value)
                                }
                                className={cn(
                                    selectClass,
                                    'h-11 w-full min-w-0',
                                )}
                                aria-label={tr('Платформа')}
                            >
                                <option value="">
                                    {tr('Будь-яка платформа')}
                                </option>
                                {Object.entries(PARTY_PLATFORMS()).map(
                                    ([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ),
                                )}
                            </select>
                            <label className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3.5 text-sm text-white/70">
                                {tr('Гравців')}
                                <input
                                    type="number"
                                    min={2}
                                    max={20}
                                    value={form.data.slots}
                                    onChange={(e) =>
                                        form.setData(
                                            'slots',
                                            Number(e.target.value),
                                        )
                                    }
                                    className="w-14 bg-transparent text-right font-semibold text-white focus:outline-none"
                                />
                            </label>
                        </div>
                        <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
                            {[
                                [false, tr('Зараз')],
                                [true, tr('Пізніше')],
                            ].map(([value, label]) => (
                                <button
                                    key={String(value)}
                                    type="button"
                                    aria-pressed={later === value}
                                    onClick={() => {
                                        setLater(value as boolean);
                                        if (value && !form.data.starts_at) {
                                            form.setData(
                                                'starts_at',
                                                localInput(
                                                    new Date(
                                                        Date.now() + 3600_000,
                                                    ),
                                                ),
                                            );
                                        }
                                    }}
                                    className={cn(
                                        'h-9 flex-1 rounded-lg text-sm font-medium transition',
                                        later === value
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/55 hover:text-white',
                                    )}
                                >
                                    {label as string}
                                </button>
                            ))}
                        </div>
                        {later && (
                            <input
                                type="datetime-local"
                                value={form.data.starts_at}
                                min={localInput(new Date())}
                                onChange={(e) =>
                                    form.setData('starts_at', e.target.value)
                                }
                                className={cn(
                                    fieldClass,
                                    '[color-scheme:dark]',
                                )}
                            />
                        )}
                        {form.errors.starts_at && (
                            <p className="text-xs text-rose-300">
                                {form.errors.starts_at}
                            </p>
                        )}
                        <div>
                            <div className="flex gap-2">
                                <input
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addRole();
                                        }
                                    }}
                                    maxLength={40}
                                    placeholder={tr(
                                        'Роль: медик, водій, снайпер…',
                                    )}
                                    className={cn(fieldClass, 'min-w-0 flex-1')}
                                />
                                <button
                                    type="button"
                                    onClick={addRole}
                                    disabled={
                                        !role.trim() ||
                                        form.data.roles.length >= 5
                                    }
                                    aria-label={tr('Додати роль')}
                                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white transition hover:bg-white/10 disabled:opacity-40"
                                >
                                    <Plus className="size-4" />
                                </button>
                            </div>
                            {form.data.roles.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {form.data.roles.map((item) => (
                                        <span
                                            key={item}
                                            className="inline-flex items-center gap-1 rounded-lg bg-amber-300/10 py-1 pr-1 pl-2 text-xs text-amber-100"
                                        >
                                            {item}
                                            <button
                                                type="button"
                                                aria-label={tr('Прибрати')}
                                                onClick={() =>
                                                    form.setData(
                                                        'roles',
                                                        form.data.roles.filter(
                                                            (r) => r !== item,
                                                        ),
                                                    )
                                                }
                                                className="rounded p-0.5 hover:bg-white/10"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <textarea
                            value={form.data.note}
                            onChange={(e) =>
                                form.setData('note', e.target.value)
                            }
                            maxLength={500}
                            rows={3}
                            placeholder={tr('Деталі: рівень, мікрофон, мова…')}
                            className={fieldClass}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setCreating(false)}
                                className="h-11 rounded-xl px-4 text-sm font-medium text-white/60 hover:text-white"
                            >
                                {tr('Скасувати')}
                            </button>
                            <button
                                type="submit"
                                disabled={
                                    form.processing || !form.data.title.trim()
                                }
                                className="btn-glow h-11 rounded-xl px-6 text-sm font-semibold disabled:opacity-50"
                            >
                                {tr('Опублікувати')}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

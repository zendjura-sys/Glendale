import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Check,
    Clock3,
    DownloadCloud,
    ImagePlus,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Server,
    Sparkles,
    Star,
    Trash2,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader, Pill, StatCard, Toggle } from '@/components/gc/admin';
import { UserAvatar } from '@/components/gc/user-avatar';
import { ServerIcon } from '@/components/servers/server-icon';
import {
    emptyServer,
    Field,
    FieldError,
    inputClass,
    ServerFormFields,
} from '@/components/servers/server-form';
import type { ServerFormData } from '@/components/servers/server-form';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GtaServerCard, UserCard } from '@/types';

type AdminServer = GtaServerCard & {
    description: string | null;
    discord_invite: string | null;
    icon_url: string | null;
    icon_source: string | null;
    icon_fetched_at: string | null;
    status: 'published' | 'pending' | 'rejected';
    origin: string;
    origin_label: string;
    review_note: string | null;
    position: number;
    suggester: UserCard | null;
    created_at: string;
    deleted_at: string | null;
};

type Status = 'published' | 'pending' | 'rejected' | 'trashed';

type Props = {
    servers: AdminServer[];
    filters: { status: Status; q: string };
    counts: Record<Status, number>;
    options: {
        platforms: Record<string, string>;
        multiplayers: Record<string, string>;
    };
    auto_publish: boolean;
};

type FormData = ServerFormData & {
    icon: File | null;
    is_featured: boolean;
    position: number;
    refetch_icon: boolean;
};

const tabs: { value: Status; label: string }[] = [
    { value: 'published', label: 'Опубліковані' },
    { value: 'pending', label: 'На модерації' },
    { value: 'rejected', label: 'Відхилені' },
    { value: 'trashed', label: 'Приховані' },
];

const iconSources: Record<string, string> = {
    upload: 'завантажено',
    manual: 'за посиланням',
    discord: 'з Discord',
    website: 'із сайту',
    favicon: 'favicon',
    google: 'Google favicon',
};

const toForm = (s?: AdminServer): FormData => ({
    ...emptyServer,
    ...(s
        ? {
              name: s.name,
              platform: s.platform,
              multiplayer: s.multiplayer,
              tagline: s.tagline ?? '',
              description: s.description ?? '',
              website: s.website ?? '',
              discord: s.discord_invite ?? '',
              telegram: s.telegram ?? '',
              connect: s.connect ?? '',
              icon_url: s.icon_url ?? '',
          }
        : {}),
    icon: null,
    is_featured: s?.is_featured ?? false,
    position: s?.position ?? 0,
    refetch_icon: false,
});

export default function AdminServers({
    servers,
    filters,
    counts,
    options,
    auto_publish,
}: Props) {
    const [q, setQ] = useState(filters.q);
    const [editing, setEditing] = useState<AdminServer | 'new' | null>(null);
    const [rejecting, setRejecting] = useState<AdminServer | null>(null);
    const [note, setNote] = useState('');

    const visit = (patch: Partial<Props['filters']>) =>
        router.get(
            '/admin/servers',
            { ...filters, q, ...patch },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    useEffect(() => {
        if (q === filters.q) return;
        const timer = setTimeout(() => visit({ q }), 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const moderate = (
        s: AdminServer,
        status: AdminServer['status'],
        reviewNote?: string,
    ) =>
        router.patch(
            `/admin/servers/${s.id}/moderate`,
            { status, review_note: reviewNote ?? null },
            {
                preserveScroll: true,
                onSuccess: () => setRejecting(null),
            },
        );

    const sync = (action: 'seed' | 'discover' | 'stats') =>
        router.post(
            '/admin/servers/sync',
            { action },
            { preserveScroll: true },
        );

    const online = servers.reduce((sum, s) => sum + (s.players_online ?? 0), 0);

    return (
        <>
            <Head title="Сервери GTA — Адмін-панель" />
            <PageHeader
                title="Сервери GTA"
                description="Каталог українських RP-проєктів: ручне додавання, пропозиції гравців і автосинхронізація"
                actions={
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => sync('stats')}
                            className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-white/75 hover:text-white"
                        >
                            <RefreshCw className="size-4" /> Онлайн
                        </button>
                        <button
                            type="button"
                            onClick={() => sync('discover')}
                            className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-white/75 hover:text-white"
                            title="Пошук нових UA-серверів у майстер-списку RAGE:MP"
                        >
                            <Sparkles className="size-4" /> Знайти нові
                        </button>
                        <button
                            type="button"
                            onClick={() => sync('seed')}
                            className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-white/75 hover:text-white"
                            title="Додати відсутні сервери з базового списку"
                        >
                            <DownloadCloud className="size-4" /> Базовий
                            список
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing('new')}
                            className="btn-glow inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                        >
                            <Plus className="size-4" /> Додати сервер
                        </button>
                    </div>
                }
            />

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <StatCard
                    label="Опубліковано"
                    value={counts.published}
                    icon={Server}
                />
                <StatCard
                    label="Чекають модерації"
                    value={counts.pending}
                    icon={Clock3}
                    tone="from-[#f59e0b] to-[#ef4444]"
                    delay={60}
                />
                <StatCard
                    label="Онлайн у вибірці"
                    value={online.toLocaleString('uk-UA')}
                    icon={UsersRound}
                    tone="from-[#22d3a6] to-[#38e1ff]"
                    delay={120}
                />
            </div>

            <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
                <div className="flex rounded-xl bg-white/[0.04] p-1 text-sm">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => visit({ status: tab.value })}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition',
                                filters.status === tab.value
                                    ? 'bg-gradient-brand text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            {tab.label}
                            {counts[tab.value] > 0 && (
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 text-[11px] leading-5',
                                        tab.value === 'pending'
                                            ? 'bg-amber-400/25 text-amber-100'
                                            : 'bg-white/10',
                                    )}
                                >
                                    {counts[tab.value]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <label className="input-glass flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/35" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Назва сервера"
                        className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>
                <label className="flex items-center gap-2 px-2 text-xs text-white/55">
                    Автопублікація знайдених
                    <Toggle
                        checked={auto_publish}
                        onChange={(v) =>
                            router.put(
                                '/admin/servers/settings',
                                { auto_publish: v },
                                { preserveScroll: true },
                            )
                        }
                        label="Автопублікація"
                    />
                </label>
            </div>

            <div className="grid gap-3">
                {servers.map((s) => (
                    <article
                        key={s.id}
                        className={cn(
                            'glass flex flex-wrap items-center gap-4 rounded-2xl p-4',
                            s.deleted_at && 'opacity-70',
                        )}
                    >
                        <ServerIcon name={s.name} icon={s.icon} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                {s.status === 'published' && !s.deleted_at ? (
                                    <Link
                                        href={`/servers/${s.slug}`}
                                        className="font-semibold text-white hover:underline"
                                    >
                                        {s.name}
                                    </Link>
                                ) : (
                                    <span className="font-semibold text-white">
                                        {s.name}
                                    </span>
                                )}
                                {s.is_featured && (
                                    <Star className="size-3.5 fill-amber-300 text-amber-300" />
                                )}
                                <Pill
                                    tone={
                                        s.platform === 'pc' ? 'blue' : 'violet'
                                    }
                                >
                                    {s.platform_label}
                                </Pill>
                                <Pill>{s.multiplayer_label}</Pill>
                                <Pill
                                    tone={
                                        s.origin === 'suggested'
                                            ? 'gold'
                                            : s.origin === 'discovered'
                                              ? 'green'
                                              : 'default'
                                    }
                                >
                                    {s.origin_label}
                                </Pill>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
                                {s.connect && (
                                    <span className="font-mono">
                                        {s.connect}
                                    </span>
                                )}
                                {s.players_online !== null && (
                                    <span className="text-emerald-300/80">
                                        {s.players_online}
                                        {s.players_max
                                            ? ` / ${s.players_max}`
                                            : ''}{' '}
                                        онлайн
                                    </span>
                                )}
                                <span>
                                    Іконка:{' '}
                                    {s.icon_source
                                        ? (iconSources[s.icon_source] ??
                                          s.icon_source)
                                        : 'немає'}
                                </span>
                                <span>сімей: {s.families_count}</span>
                                <span>додано {timeAgo(s.created_at)}</span>
                            </div>
                            {s.suggester && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-white/55">
                                    <UserAvatar user={s.suggester} size="xs" />
                                    Запропонував{' '}
                                    <Link
                                        href={`/${s.suggester.username}`}
                                        className="text-white/80 hover:underline"
                                    >
                                        {s.suggester.name}
                                    </Link>
                                    {s.tagline && (
                                        <span className="truncate text-white/40">
                                            · {s.tagline}
                                        </span>
                                    )}
                                </div>
                            )}
                            {s.review_note && (
                                <div className="mt-1 text-xs text-rose-200/80">
                                    Причина: {s.review_note}
                                </div>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                            {s.deleted_at ? (
                                <IconButton
                                    title="Відновити"
                                    tone="green"
                                    onClick={() =>
                                        router.post(
                                            `/admin/servers/${s.id}/restore`,
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    <RotateCcw className="size-4" />
                                </IconButton>
                            ) : (
                                <>
                                    {s.status !== 'published' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                moderate(s, 'published')
                                            }
                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-400/15 px-3 text-sm font-medium text-emerald-200 hover:bg-emerald-400/25"
                                        >
                                            <Check className="size-4" />{' '}
                                            Опублікувати
                                        </button>
                                    )}
                                    {s.status === 'pending' && (
                                        <IconButton
                                            title="Відхилити"
                                            tone="red"
                                            onClick={() => {
                                                setNote('');
                                                setRejecting(s);
                                            }}
                                        >
                                            <X className="size-4" />
                                        </IconButton>
                                    )}
                                    <IconButton
                                        title="Оновити іконку й онлайн"
                                        onClick={() =>
                                            router.post(
                                                `/admin/servers/${s.id}/refresh`,
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <RefreshCw className="size-4" />
                                    </IconButton>
                                    <IconButton
                                        title="Редагувати"
                                        onClick={() => setEditing(s)}
                                    >
                                        <Pencil className="size-4" />
                                    </IconButton>
                                    <IconButton
                                        title="Приховати"
                                        tone="red"
                                        onClick={() =>
                                            confirm(
                                                `Приховати «${s.name}» з каталогу?`,
                                            ) &&
                                            router.delete(
                                                `/admin/servers/${s.id}`,
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                    </IconButton>
                                </>
                            )}
                        </div>
                    </article>
                ))}
                {servers.length === 0 && (
                    <div className="glass rounded-3xl px-6 py-14 text-center text-sm text-white/40">
                        {filters.status === 'pending'
                            ? 'Нових пропозицій немає'
                            : 'Серверів не знайдено'}
                    </div>
                )}
            </div>

            {editing && (
                <ServerDialog
                    key={editing === 'new' ? 'new' : editing.id}
                    server={editing === 'new' ? null : editing}
                    multiplayers={options.multiplayers}
                    onClose={() => setEditing(null)}
                />
            )}

            <Dialog
                open={rejecting !== null}
                onOpenChange={(open) => !open && setRejecting(null)}
            >
                <DialogContent className="glass-strong rounded-3xl border-white/10 p-6 text-white sm:max-w-md">
                    <DialogTitle className="font-display text-lg">
                        Відхилити «{rejecting?.name}»
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/50">
                        Автор пропозиції побачить причину.
                    </DialogDescription>
                    <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Напр. сервер уже закрито"
                        maxLength={300}
                        className={inputClass}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setRejecting(null)}
                            className="h-10 rounded-xl px-4 text-sm text-white/60 hover:text-white"
                        >
                            Скасувати
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                rejecting &&
                                moderate(rejecting, 'rejected', note)
                            }
                            className="h-10 rounded-xl bg-rose-500/80 px-5 text-sm font-semibold text-white hover:bg-rose-500"
                        >
                            Відхилити
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function IconButton({
    title,
    tone,
    onClick,
    children,
}: {
    title: string;
    tone?: 'red' | 'green';
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={cn(
                'flex size-9 items-center justify-center rounded-xl transition',
                tone === 'red'
                    ? 'text-rose-300 hover:bg-rose-500/10'
                    : tone === 'green'
                      ? 'text-emerald-300 hover:bg-emerald-400/10'
                      : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

function ServerDialog({
    server,
    multiplayers,
    onClose,
}: {
    server: AdminServer | null;
    multiplayers: Record<string, string>;
    onClose: () => void;
}) {
    const form = useForm<FormData>(toForm(server ?? undefined));
    const fileRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(server?.icon ?? null);

    const pick = (file: File | null) => {
        form.setData('icon', file);
        if (file) setPreview(URL.createObjectURL(file));
    };

    const submit = () =>
        form.post(server ? `/admin/servers/${server.id}` : '/admin/servers', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: onClose,
        });

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="glass-strong max-h-[92dvh] gap-0 overflow-y-auto rounded-3xl border-white/10 p-6 text-white sm:max-w-2xl">
                <DialogTitle className="font-display text-xl">
                    {server ? `Редагувати «${server.name}»` : 'Новий сервер'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    {server
                        ? 'Якщо змінити сайт чи Discord, іконку буде підтягнуто заново.'
                        : 'Сервер одразу з’явиться в каталозі. Іконку завантажте або залиште порожньою — знайдемо автоматично.'}
                </DialogDescription>

                <div className="mt-5 flex items-center gap-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                    <ServerIcon
                        name={form.data.name || '?'}
                        icon={preview}
                        className="size-16 rounded-[20px]"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">
                            Іконка сервера
                        </div>
                        <div className="text-xs text-white/40">
                            PNG, JPG, WebP або GIF до 4 МБ — збережемо у
                            256×256
                        </div>
                        <FieldError message={form.errors.icon} />
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => pick(e.target.files?.[0] ?? null)}
                    />
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm text-white/80 hover:text-white"
                    >
                        <ImagePlus className="size-4" /> Завантажити
                    </button>
                </div>

                <div className="mt-5">
                    <ServerFormFields
                        data={form.data}
                        setData={form.setData}
                        errors={form.errors}
                        multiplayers={multiplayers}
                    />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Позиція в списку"
                        hint="Менше число — вище"
                        error={form.errors.position}
                    >
                        <input
                            type="number"
                            min={0}
                            max={9999}
                            value={form.data.position}
                            onChange={(e) =>
                                form.setData('position', Number(e.target.value))
                            }
                            className={inputClass}
                        />
                    </Field>
                    <div className="flex flex-col justify-center gap-3">
                        <label className="flex items-center justify-between gap-3 text-sm text-white/70">
                            Рекомендований (зірка й закріплення)
                            <Toggle
                                checked={form.data.is_featured}
                                onChange={(v) => form.setData('is_featured', v)}
                                label="Рекомендований"
                            />
                        </label>
                        {server && (
                            <label className="flex items-center justify-between gap-3 text-sm text-white/70">
                                Перезавантажити іконку
                                <Toggle
                                    checked={form.data.refetch_icon}
                                    onChange={(v) =>
                                        form.setData('refetch_icon', v)
                                    }
                                    label="Перезавантажити іконку"
                                />
                            </label>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-11 rounded-xl px-4 text-sm font-medium text-white/60 hover:text-white"
                    >
                        Скасувати
                    </button>
                    <button
                        type="button"
                        disabled={form.processing || !form.data.name}
                        onClick={submit}
                        className="btn-glow h-11 rounded-xl px-6 text-sm font-semibold disabled:opacity-50"
                    >
                        {form.processing
                            ? 'Зберігаємо…'
                            : server
                              ? 'Зберегти'
                              : 'Додати в каталог'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

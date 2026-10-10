import { Head, Link, useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { ArrowLeft, Globe2, Lock, Megaphone, UsersRound } from 'lucide-react';
import type { FormEvent } from 'react';
import { selectClass } from '@/components/gc/admin';
import {
    RulesForm,
    StatsCard,
} from '@/components/communities/community-extras';
import type {
    CommunityExtras,
    CommunityStats,
} from '@/components/communities/community-extras';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { SettingsCard } from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import type { CommunityDetails } from '@/types';
import { BotsCard } from '@/components/bots/bots-card';
import { tr } from '@/lib/i18n';

type Props = {
    community: CommunityDetails;
    categories: Record<string, string>;
    isOwner: boolean;
    widget: string | null;
    extras: CommunityExtras;
    slowModes: number[];
    stats?: CommunityStats;
};

const field =
    'input-glass w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

function Error({ message }: { message?: string }) {
    return message ? (
        <p className="mt-1 text-xs text-rose-300">{message}</p>
    ) : null;
}

function Segmented<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string; icon: typeof Lock; hint: string }[];
}) {
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'flex items-start gap-3 rounded-2xl border p-3.5 text-left transition',
                        value === option.value
                            ? 'border-gc-lilac-500/60 bg-gc-indigo/15'
                            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15',
                    )}
                >
                    <option.icon
                        className={cn(
                            'mt-0.5 size-4 shrink-0',
                            value === option.value
                                ? 'text-[#a9b6ff]'
                                : 'text-white/40',
                        )}
                    />
                    <span>
                        <span className="block text-sm font-medium text-white">
                            {option.label}
                        </span>
                        <span className="block text-xs text-white/45">
                            {option.hint}
                        </span>
                    </span>
                </button>
            ))}
        </div>
    );
}

export default function CommunitySettings({
    community,
    categories,
    isOwner,
    widget,
    extras,
    slowModes,
    stats,
}: Props) {
    const form = useForm({
        name: community.name,
        slug: community.slug,
        type: community.type,
        privacy: community.privacy,
        wall: community.wall,
        category: community.category ?? 'other',
        status: community.status ?? '',
        description: community.description ?? '',
        website: community.website ?? '',
        city: community.city ?? '',
    });
    const remove = useForm({ confirm: '' });
    const { data, setData, errors } = form;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.patch(`/c/${community.slug}/settings`, { preserveScroll: true });
    };

    return (
        <>
            <Head title={tr('Керування — {name}', { name: community.name })} />
            <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/c/${community.slug}`}
                        className="flex size-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Назад')}
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <CommunityAvatar community={community} size="md" />
                    <div>
                        <h1 className="font-display text-xl font-bold text-white">
                            {tr('Керування спільнотою')}
                        </h1>
                        <p className="text-sm text-white/50">
                            {community.name}
                        </p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <SettingsCard
                        title={tr('Основна інформація')}
                        description={tr('Назва, адреса та опис спільноти')}
                    >
                        <div className="grid grid-cols-1 gap-4">
                            <label className="text-sm font-medium text-white/80">
                                {tr('Назва')}
                                <input
                                    value={data.name}
                                    onChange={(e) =>
                                        setData('name', e.target.value)
                                    }
                                    maxLength={100}
                                    className={cn(field, 'mt-1.5 h-11')}
                                />
                                <Error message={errors.name} />
                            </label>
                            <label className="text-sm font-medium text-white/80">
                                {tr('Адреса сторінки')}
                                <div className="input-glass mt-1.5 flex h-11 items-center rounded-xl pl-3.5 text-sm">
                                    <span className="shrink-0 text-white/35">
                                        <span className="hidden sm:inline">
                                            gamecon.online
                                        </span>
                                        /c/
                                    </span>
                                    <input
                                        value={data.slug}
                                        onChange={(e) =>
                                            setData(
                                                'slug',
                                                e.target.value.toLowerCase(),
                                            )
                                        }
                                        maxLength={32}
                                        className="h-full w-0 min-w-0 flex-1 bg-transparent pr-3.5 text-white focus:outline-none"
                                    />
                                </div>
                                <Error message={errors.slug} />
                            </label>
                            <label className="text-sm font-medium text-white/80">
                                {tr('Статус')}
                                <input
                                    value={data.status}
                                    onChange={(e) =>
                                        setData('status', e.target.value)
                                    }
                                    maxLength={140}
                                    placeholder={tr('Коротко про головне')}
                                    className={cn(field, 'mt-1.5 h-11')}
                                />
                                <Error message={errors.status} />
                            </label>
                            <label className="text-sm font-medium text-white/80">
                                {tr('Опис')}
                                <textarea
                                    value={data.description}
                                    onChange={(e) =>
                                        setData('description', e.target.value)
                                    }
                                    rows={5}
                                    maxLength={4000}
                                    className={cn(
                                        field,
                                        'mt-1.5 resize-y py-3',
                                    )}
                                />
                                <Error message={errors.description} />
                            </label>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <label className="text-sm font-medium text-white/80">
                                    {tr('Тематика')}
                                    <select
                                        value={data.category}
                                        onChange={(e) =>
                                            setData('category', e.target.value)
                                        }
                                        className={cn(
                                            selectClass,
                                            'mt-1.5 h-11 w-full',
                                        )}
                                    >
                                        {Object.entries(categories).map(
                                            ([key, label]) => (
                                                <option key={key} value={key}>
                                                    {label}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-white/80">
                                    {tr('Місто')}
                                    <input
                                        value={data.city}
                                        onChange={(e) =>
                                            setData('city', e.target.value)
                                        }
                                        className={cn(field, 'mt-1.5 h-11')}
                                    />
                                </label>
                                <label className="text-sm font-medium text-white/80">
                                    {tr('Сайт')}
                                    <input
                                        value={data.website}
                                        onChange={(e) =>
                                            setData('website', e.target.value)
                                        }
                                        placeholder="https://"
                                        className={cn(field, 'mt-1.5 h-11')}
                                    />
                                    <Error message={errors.website} />
                                </label>
                            </div>
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title={tr('Тип і доступ')}
                        description={tr('Хто може бачити й публікувати')}
                    >
                        <div className="space-y-5">
                            <Segmented
                                value={data.type}
                                onChange={(value) => setData('type', value)}
                                options={[
                                    {
                                        value: 'group',
                                        label: tr('Група'),
                                        icon: UsersRound,
                                        hint: tr(
                                            'Обговорення та стіна для учасників',
                                        ),
                                    },
                                    {
                                        value: 'public',
                                        label: tr('Публічна сторінка'),
                                        icon: Megaphone,
                                        hint: tr('Новини від імені сторінки'),
                                    },
                                ]}
                            />
                            {data.type === 'group' && (
                                <>
                                    <Segmented
                                        value={data.privacy}
                                        onChange={(value) =>
                                            setData('privacy', value)
                                        }
                                        options={[
                                            {
                                                value: 'open',
                                                label: tr('Відкрита'),
                                                icon: Globe2,
                                                hint: tr(
                                                    'Вступити може будь-хто',
                                                ),
                                            },
                                            {
                                                value: 'closed',
                                                label: tr('Закрита'),
                                                icon: Lock,
                                                hint: tr(
                                                    'Вступ за заявкою, записи лише для учасників',
                                                ),
                                            },
                                        ]}
                                    />
                                    <Segmented
                                        value={data.wall}
                                        onChange={(value) =>
                                            setData('wall', value)
                                        }
                                        options={[
                                            {
                                                value: 'open',
                                                label: tr('Відкрита стіна'),
                                                icon: UsersRound,
                                                hint: tr(
                                                    'Учасники можуть публікувати записи',
                                                ),
                                            },
                                            {
                                                value: 'closed',
                                                label: tr('Обмежена стіна'),
                                                icon: Megaphone,
                                                hint: tr(
                                                    'Публікують лише керівники',
                                                ),
                                            },
                                        ]}
                                    />
                                </>
                            )}
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title={tr('Віджет для сайту')}
                        description={
                            widget
                                ? tr(
                                      'Вставте код на сайт сервера — там з’являться назва, кількість учасників і останні записи.',
                                  )
                                : tr(
                                      'Віджет доступний для відкритої спільноти.',
                                  )
                        }
                    >
                        {widget && (
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    readOnly
                                    value={`<script src="${widget}" async></script>`}
                                    className={cn(
                                        field,
                                        'h-11 font-mono text-xs',
                                    )}
                                />
                                <button
                                    type="button"
                                    className="h-11 shrink-0 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white"
                                    onClick={() => {
                                        void navigator.clipboard.writeText(
                                            `<script src="${widget}" async></script>`,
                                        );
                                        toast(tr('Код скопійовано'));
                                    }}
                                >
                                    {tr('Копіювати')}
                                </button>
                            </div>
                        )}
                    </SettingsCard>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={form.processing || !form.isDirty}
                            className="btn-glow rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Зберегти зміни')}
                        </button>
                    </div>
                </form>

                <RulesForm
                    slug={community.slug}
                    extras={extras}
                    slowModes={slowModes}
                />

                <StatsCard stats={stats} />

                {isOwner && (
                    <SettingsCard
                        title={tr('Видалення спільноти')}
                        description={tr(
                            'Спільнота й усі записи зникнуть для всіх учасників',
                        )}
                        tone="danger"
                    >
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                remove.delete(`/c/${community.slug}`);
                            }}
                            className="flex flex-col gap-3 sm:flex-row"
                        >
                            <input
                                value={remove.data.confirm}
                                onChange={(e) =>
                                    remove.setData('confirm', e.target.value)
                                }
                                placeholder={tr(
                                    'Введіть «{slug}» для підтвердження',
                                    { slug: community.slug },
                                )}
                                className={cn(field, 'h-11 flex-1')}
                            />
                            <button
                                type="submit"
                                disabled={
                                    remove.data.confirm !== community.slug
                                }
                                className="h-11 rounded-xl bg-rose-500/80 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-40"
                            >
                                {tr('Видалити')}
                            </button>
                        </form>
                        <Error message={remove.errors.confirm} />
                    </SettingsCard>
                )}
                <BotsCard type="community" id={community.id} />
            </div>
        </>
    );
}

import { router, useForm } from '@inertiajs/react';
import {
    Bot,
    FileBarChart,
    ImagePlus,
    Send,
    Settings as SettingsIcon,
    SlidersHorizontal,
} from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { FamilyLogo } from '@/components/families/family-logo';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Panel,
    btnGhost,
    btnPrimary,
    textareaClass,
} from '@/components/families/ui';
import { Toggle, selectClass } from '@/components/gc/admin';
import {
    Field,
    FieldError,
    inputClass,
} from '@/components/servers/server-form';
import { uah } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { FamilyShellProps } from '@/types';
import { tr } from '@/lib/i18n';

type Settings = {
    rates: Record<string, number>;
    deposits: Record<string, number | boolean>;
    reports: Record<string, number | boolean>;
    rating: Record<string, number | boolean>;
    discipline: Record<string, number | string>;
    cashout: Record<string, number>;
    digest: Record<string, boolean>;
};

type Props = FamilyShellProps & {
    settings: Settings;
    profile: {
        name: string;
        tag: string;
        description: string | null;
        is_recruiting: boolean;
    };
    webhooks: {
        discord: string | null;
        telegram_token: string | null;
        telegram_chat: string | null;
    };
    digest: {
        text: string;
        members: number;
        total: number;
        last: string | null;
    };
};

const labels: Record<string, Record<string, string>> = {
    rates: {
        bizwar_win: tr('Бізвар — перемога, ₴'),
        bizwar_loss: tr('Бізвар — поразка, ₴'),
        contract_light: tr('Контракт легкий, ₴'),
        contract_medium: tr('Контракт середній, ₴'),
        contract_heavy: tr('Контракт важкий, ₴'),
        investment_cashback: tr('Кешбек з інвестицій, %'),
    },
    deposits: {
        enabled: tr('Депозити увімкнено'),
        daily_rate: tr('Ставка на день, %'),
        weekly_rate: tr('Ставка на тиждень, %'),
        min_amount: tr('Мінімальна сума, ₴'),
        max_days: tr('Максимум днів'),
        max_weeks: tr('Максимум тижнів'),
    },
    reports: {
        deadline_hours: tr('Дедлайн подання, год'),
        contract_daily_limit: tr('Ліміт контрактів на день (кожного рівня)'),
        require_proof: tr('Скріншот обов’язковий'),
        max_proofs: tr('Максимум скріншотів'),
    },
    rating: {
        bizwar: tr('Враховувати бізвари'),
        contracts: tr('Враховувати контракти'),
        investments: tr('Враховувати інвестиції'),
        events: tr('Враховувати події'),
        points_bizwar_win: tr('Бали: перемога'),
        points_bizwar_loss: tr('Бали: поразка'),
        points_contract_light: tr('Бали: легкий контракт'),
        points_contract_medium: tr('Бали: середній контракт'),
        points_contract_heavy: tr('Бали: важкий контракт'),
        points_per_1000: tr('Бали за кожні 1000 ₴ інвестицій'),
        points_event: tr('Бали за подію (типово)'),
    },
    discipline: {
        warn_days: tr('Попередження діє, днів'),
        warn_limit: tr('Ліміт попереджень'),
        escalation: tr('Після ліміту'),
    },
    cashout: { min_amount: tr('Мінімальний вивід, ₴') },
    digest: {
        enabled: tr('Щотижневий звіт (нд 23:59)'),
        chat: tr('Публікувати в чат сім’ї'),
    },
};

const groups: { key: keyof Settings; title: string }[] = [
    { key: 'rates', title: tr('Ставки винагород') },
    { key: 'reports', title: tr('Звіти') },
    { key: 'deposits', title: tr('Депозити') },
    { key: 'rating', title: tr('Рейтинг') },
    { key: 'discipline', title: tr('Дисципліна') },
    { key: 'cashout', title: tr('Виплати') },
    { key: 'digest', title: tr('Тижневий звіт') },
];

export default function FamilySettings(props: Props) {
    const { family, settings, profile, webhooks, digest } = props;
    const base = `/f/${family.slug}`;

    return (
        <FamilyShell {...props} title={tr('Налаштування')}>
            <ProfilePanel
                action={`${base}/settings/profile`}
                family={family}
                profile={profile}
            />
            <SettingsPanel action={`${base}/settings`} settings={settings} />
            <div className="grid gap-4 lg:grid-cols-2">
                <WebhooksPanel base={base} webhooks={webhooks} />
                <Panel
                    title={tr('Тижневий звіт')}
                    icon={FileBarChart}
                    actions={
                        <button
                            type="button"
                            disabled={family.status !== 'verified'}
                            onClick={() =>
                                confirm(
                                    tr('Надіслати звіт зараз у всі канали?'),
                                ) &&
                                router.post(
                                    `${base}/settings/digest`,
                                    {},
                                    { preserveScroll: true },
                                )
                            }
                            className={cn(btnGhost, 'h-9')}
                        >
                            <Send className="size-4" /> {tr('Надіслати зараз')}
                        </button>
                    }
                >
                    <p className="mb-2 text-xs text-white/45">
                        {tr('Попередній перегляд:')} {digest.members}{' '}
                        {tr('учасників · разом')} {uah(digest.total)}
                        {digest.last &&
                            tr(' · останній: {last}', { last: digest.last })}
                    </p>
                    <pre className="max-h-80 overflow-auto rounded-2xl bg-black/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/75">
                        {digest.text}
                    </pre>
                </Panel>
            </div>
        </FamilyShell>
    );
}

function ProfilePanel({
    action,
    family,
    profile,
}: {
    action: string;
    family: FamilyShellProps['family'];
    profile: Props['profile'];
}) {
    const form = useForm({
        name: profile.name,
        tag: profile.tag,
        description: profile.description ?? '',
        is_recruiting: profile.is_recruiting,
        logo: null as File | null,
        cover: null as File | null,
    });
    const logoRef = useRef<HTMLInputElement>(null);
    const coverRef = useRef<HTMLInputElement>(null);

    return (
        <Panel title={tr('Профіль сім’ї')} icon={SettingsIcon}>
            <div className="flex flex-wrap items-start gap-5">
                <div className="flex flex-col items-center gap-2">
                    <FamilyLogo
                        family={{
                            ...family,
                            tag: form.data.tag || family.tag,
                            logo_url: form.data.logo
                                ? URL.createObjectURL(form.data.logo)
                                : family.logo_url,
                        }}
                        size="xl"
                    />
                    <button
                        type="button"
                        onClick={() => logoRef.current?.click()}
                        className={cn(btnGhost, 'h-8 text-xs')}
                    >
                        <ImagePlus className="size-3.5" /> {tr('Логотип')}
                    </button>
                    <button
                        type="button"
                        onClick={() => coverRef.current?.click()}
                        className={cn(btnGhost, 'h-8 text-xs')}
                    >
                        <ImagePlus className="size-3.5" />{' '}
                        {form.data.cover
                            ? tr('Обкладинку обрано')
                            : tr('Обкладинка')}
                    </button>
                    <input
                        ref={logoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                            form.setData('logo', e.target.files?.[0] ?? null)
                        }
                    />
                    <input
                        ref={coverRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                            form.setData('cover', e.target.files?.[0] ?? null)
                        }
                    />
                </div>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_140px]">
                    <Field label={tr('Назва')} error={form.errors.name}>
                        <input
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            className={inputClass}
                        />
                    </Field>
                    <Field label={tr('Тег')} error={form.errors.tag}>
                        <input
                            value={form.data.tag}
                            maxLength={8}
                            onChange={(e) =>
                                form.setData(
                                    'tag',
                                    e.target.value.toUpperCase(),
                                )
                            }
                            className={cn(
                                inputClass,
                                'font-mono font-bold tracking-widest',
                            )}
                        />
                    </Field>
                    <Field
                        label={tr('Опис')}
                        error={form.errors.description}
                        className="sm:col-span-2"
                    >
                        <textarea
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                            rows={3}
                            className={textareaClass}
                        />
                    </Field>
                    <label className="flex items-center gap-3 text-sm text-white/70">
                        <Toggle
                            checked={form.data.is_recruiting}
                            onChange={(v) => form.setData('is_recruiting', v)}
                            label={tr('Набір')}
                        />
                        {tr('Набір відкрито')}
                    </label>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            disabled={form.processing}
                            onClick={() =>
                                form.post(action, {
                                    forceFormData: true,
                                    preserveScroll: true,
                                })
                            }
                            className={btnPrimary}
                        >
                            {tr('Зберегти профіль')}
                        </button>
                    </div>
                    <FieldError
                        message={form.errors.logo ?? form.errors.cover}
                    />
                </div>
            </div>
        </Panel>
    );
}

function SettingsPanel({
    action,
    settings,
}: {
    action: string;
    settings: Settings;
}) {
    const form = useForm<Settings>(settings);

    const set = (
        group: keyof Settings,
        key: string,
        value: number | string | boolean,
    ) => form.setData(group, { ...form.data[group], [key]: value } as never);

    const error = (group: string, key: string) =>
        (form.errors as Record<string, string>)[`${group}.${key}`];

    return (
        <Panel
            title={tr('Правила й ставки')}
            icon={SlidersHorizontal}
            actions={
                <button
                    type="button"
                    disabled={form.processing || !form.isDirty}
                    onClick={() => form.put(action, { preserveScroll: true })}
                    className={btnPrimary}
                >
                    {tr('Зберегти')}
                </button>
            }
        >
            <p className="mb-4 text-xs text-white/45">
                {tr(
                    'Кожна зміна записується в журнал аудиту (було → стало). Нові ставки діють для звітів, схвалених після збереження.',
                )}
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((g) => (
                    <SettingsGroup key={g.key} title={g.title}>
                        {Object.entries(form.data[g.key]).map(
                            ([key, value]) => {
                                const label = labels[g.key]?.[key] ?? key;
                                if (typeof value === 'boolean') {
                                    return (
                                        <label
                                            key={key}
                                            className="flex items-center justify-between gap-3 text-sm text-white/70"
                                        >
                                            {label}
                                            <Toggle
                                                checked={value}
                                                onChange={(v) =>
                                                    set(g.key, key, v)
                                                }
                                                label={label}
                                            />
                                        </label>
                                    );
                                }
                                if (key === 'escalation') {
                                    return (
                                        <Field key={key} label={label}>
                                            <select
                                                value={String(value)}
                                                onChange={(e) =>
                                                    set(
                                                        g.key,
                                                        key,
                                                        e.target.value,
                                                    )
                                                }
                                                className={cn(
                                                    selectClass,
                                                    'h-10 w-full',
                                                )}
                                            >
                                                <option value="demote">
                                                    {tr('Знизити ранг')}
                                                </option>
                                                <option value="kick">
                                                    {tr('Виключити')}
                                                </option>
                                            </select>
                                        </Field>
                                    );
                                }

                                return (
                                    <Field
                                        key={key}
                                        label={label}
                                        error={error(g.key, key)}
                                    >
                                        <input
                                            type="number"
                                            step="any"
                                            min={0}
                                            value={String(value)}
                                            onChange={(e) =>
                                                set(
                                                    g.key,
                                                    key,
                                                    e.target.value === ''
                                                        ? ''
                                                        : Number(
                                                              e.target.value,
                                                          ),
                                                )
                                            }
                                            className={cn(inputClass, 'h-10')}
                                        />
                                    </Field>
                                );
                            },
                        )}
                    </SettingsGroup>
                ))}
            </div>
        </Panel>
    );
}

function SettingsGroup({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.05]">
            <div className="text-sm font-semibold text-white">{title}</div>
            {children}
        </div>
    );
}

function WebhooksPanel({
    base,
    webhooks,
}: {
    base: string;
    webhooks: Props['webhooks'];
}) {
    const form = useForm({
        discord: '',
        telegram_token: '',
        telegram_chat: webhooks.telegram_chat ?? '',
    });

    const clear = (target: 'discord' | 'telegram') =>
        router.put(
            `${base}/settings/webhooks`,
            { clear: target },
            { preserveScroll: true },
        );

    return (
        <Panel
            title={tr('Боти Discord і Telegram')}
            icon={Bot}
            actions={
                <button
                    type="button"
                    onClick={() =>
                        router.post(
                            `${base}/settings/webhooks/test`,
                            {},
                            { preserveScroll: true },
                        )
                    }
                    className={cn(btnGhost, 'h-9')}
                >
                    {tr('Тест')}
                </button>
            }
        >
            <p className="mb-3 text-xs text-white/45">
                {tr(
                    'Сюди надходитимуть тижневі звіти, схвалення великих виплат і анонси подій.',
                )}
            </p>
            <div className="space-y-3">
                <Field
                    label={tr('Вебхук Discord')}
                    hint={
                        webhooks.discord
                            ? tr('Підключено: {discord}', {
                                  discord: webhooks.discord,
                              })
                            : tr('Налаштування каналу → Інтеграції → Вебхуки')
                    }
                    error={form.errors.discord}
                >
                    <div className="flex gap-2">
                        <input
                            value={form.data.discord}
                            onChange={(e) =>
                                form.setData('discord', e.target.value)
                            }
                            placeholder="https://discord.com/api/webhooks/…"
                            className={inputClass}
                        />
                        {webhooks.discord && (
                            <button
                                type="button"
                                onClick={() => clear('discord')}
                                className={btnGhost}
                            >
                                {tr('Вимкнути')}
                            </button>
                        )}
                    </div>
                </Field>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <Field
                        label={tr('Токен Telegram-бота')}
                        hint={
                            webhooks.telegram_token
                                ? tr('Підключено: {telegram_token}', {
                                      telegram_token: webhooks.telegram_token,
                                  })
                                : tr('Створіть бота в @BotFather')
                        }
                        error={form.errors.telegram_token}
                    >
                        <input
                            value={form.data.telegram_token}
                            onChange={(e) =>
                                form.setData('telegram_token', e.target.value)
                            }
                            placeholder="123456789:AA…"
                            className={cn(inputClass, 'font-mono')}
                        />
                    </Field>
                    <Field label="Chat ID" error={form.errors.telegram_chat}>
                        <input
                            value={form.data.telegram_chat}
                            onChange={(e) =>
                                form.setData('telegram_chat', e.target.value)
                            }
                            placeholder="-1001234567890"
                            className={cn(inputClass, 'font-mono')}
                        />
                    </Field>
                </div>
                <div className="flex justify-end gap-2">
                    {webhooks.telegram_token && (
                        <button
                            type="button"
                            onClick={() => clear('telegram')}
                            className={btnGhost}
                        >
                            {tr('Вимкнути Telegram')}
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={form.processing}
                        onClick={() =>
                            form.put(`${base}/settings/webhooks`, {
                                preserveScroll: true,
                                onSuccess: () =>
                                    form.reset('discord', 'telegram_token'),
                            })
                        }
                        className={btnPrimary}
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            </div>
        </Panel>
    );
}

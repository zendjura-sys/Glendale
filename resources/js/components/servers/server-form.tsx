import { Monitor, Smartphone } from 'lucide-react';
import { selectClass } from '@/components/gc/admin';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export type ServerFormData = {
    name: string;
    platform: 'pc' | 'mobile';
    multiplayer: string;
    language: string;
    tagline: string;
    description: string;
    website: string;
    discord: string;
    telegram: string;
    connect: string;
    icon_url: string;
};

export const emptyServer: ServerFormData = {
    name: '',
    platform: 'pc',
    multiplayer: 'ragemp',
    language: 'uk',
    tagline: '',
    description: '',
    website: '',
    discord: '',
    telegram: '',
    connect: '',
    icon_url: '',
};

export const inputClass =
    'input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none';

export function FieldError({ message }: { message?: string }) {
    return message ? (
        <p className="mt-1 text-xs text-rose-300">{message}</p>
    ) : null;
}

export function Field({
    label,
    hint,
    error,
    children,
    className,
}: {
    label: string;
    hint?: string;
    error?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('block', className)}>
            <span className="mb-1.5 block text-xs font-medium text-white/60">
                {label}
            </span>
            {children}
            {hint && !error && (
                <span className="mt-1 block text-[11px] text-white/35">
                    {hint}
                </span>
            )}
            <FieldError message={error} />
        </label>
    );
}

export function ServerFormFields({
    data,
    setData,
    errors,
    multiplayers,
    languages,
    compact = false,
}: {
    data: ServerFormData;
    setData: <K extends keyof ServerFormData>(
        key: K,
        value: ServerFormData[K],
    ) => void;
    errors: Partial<Record<string, string>>;
    multiplayers: Record<string, string>;
    languages?: Record<string, string>;
    compact?: boolean;
}) {
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr('Назва сервера')} error={errors.name}>
                <input
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder={tr('Напр. Kyiv RP')}
                    className={inputClass}
                    autoFocus
                />
            </Field>
            <div>
                <span className="mb-1.5 block text-xs font-medium text-white/60">
                    {tr('Платформа')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                    {(
                        [
                            ['pc', tr('ПК'), Monitor],
                            ['mobile', tr('Мобільний'), Smartphone],
                        ] as const
                    ).map(([value, label, Icon]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setData('platform', value);
                                if (
                                    value === 'mobile' &&
                                    data.multiplayer === 'ragemp'
                                ) {
                                    setData('multiplayer', 'launcher');
                                }
                            }}
                            className={cn(
                                'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition',
                                data.platform === value
                                    ? 'border-[#7c8cff]/60 bg-[#6d5dfc]/15 text-white'
                                    : 'border-white/[0.07] bg-white/[0.03] text-white/55 hover:text-white',
                            )}
                        >
                            <Icon className="size-4" /> {label}
                        </button>
                    ))}
                </div>
            </div>
            <Field
                label={tr('Мультиплеєр / клієнт')}
                error={errors.multiplayer}
            >
                <select
                    value={data.multiplayer}
                    onChange={(e) => setData('multiplayer', e.target.value)}
                    className={cn(selectClass, 'h-11 w-full')}
                >
                    {Object.entries(multiplayers).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </Field>
            {languages && (
                <Field label={tr('Мова сервера')} error={errors.language}>
                    <select
                        value={data.language}
                        onChange={(e) => setData('language', e.target.value)}
                        className={cn(selectClass, 'h-11 w-full')}
                    >
                        {Object.entries(languages).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </Field>
            )}
            <Field
                label={tr('Адреса підключення')}
                hint={tr('ip:port, домен:port або код cfx.re')}
                error={errors.connect}
            >
                <input
                    value={data.connect}
                    onChange={(e) => setData('connect', e.target.value)}
                    placeholder="play.server.com.ua:22005"
                    className={cn(inputClass, 'font-mono')}
                />
            </Field>
            <Field label={tr('Сайт')} error={errors.website}>
                <input
                    value={data.website}
                    onChange={(e) => setData('website', e.target.value)}
                    placeholder="https://server.com.ua"
                    className={inputClass}
                />
            </Field>
            <Field
                label={tr('Discord-запрошення')}
                hint={tr(
                    'Звідси автоматично підтягнемо іконку й кількість гравців',
                )}
                error={errors.discord}
            >
                <input
                    value={data.discord}
                    onChange={(e) => setData('discord', e.target.value)}
                    placeholder="discord.gg/server"
                    className={inputClass}
                />
            </Field>
            <Field label="Telegram" error={errors.telegram}>
                <input
                    value={data.telegram}
                    onChange={(e) => setData('telegram', e.target.value)}
                    placeholder="https://t.me/server"
                    className={inputClass}
                />
            </Field>
            <Field
                label={tr('Пряме посилання на іконку')}
                hint={tr('Необов’язково — якщо автоматично не знайдеться')}
                error={errors.icon_url}
            >
                <input
                    value={data.icon_url}
                    onChange={(e) => setData('icon_url', e.target.value)}
                    placeholder="https://…/logo.png"
                    className={inputClass}
                />
            </Field>
            <Field
                label={tr('Коротко про сервер')}
                error={errors.tagline}
                className="sm:col-span-2"
            >
                <input
                    value={data.tagline}
                    onChange={(e) => setData('tagline', e.target.value)}
                    placeholder={tr(
                        'Мапа України, голосовий чат, власна економіка…',
                    )}
                    maxLength={160}
                    className={inputClass}
                />
            </Field>
            {!compact && (
                <Field
                    label={tr('Опис')}
                    error={errors.description}
                    className="sm:col-span-2"
                >
                    <textarea
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        rows={3}
                        className="input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </Field>
            )}
        </div>
    );
}

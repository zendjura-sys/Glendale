import { useForm } from '@inertiajs/react';
import { Copy, KeyRound } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { selectClass, Toggle } from '@/components/gc/admin';
import { SettingsCard } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type CommunityAccess = {
    is_listed: boolean;
    guest_view: boolean;
    guest_chat_channel_id: number | null;
    has_password: boolean;
    guest_chat_on: boolean;
    guest_url: string;
    channels: { id: number; name: string }[];
};

function Row({
    title,
    hint,
    children,
}: {
    title: string;
    hint: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-0.5 text-xs text-white/50">{hint}</p>
            </div>
            <div className="shrink-0 pt-0.5">{children}</div>
        </div>
    );
}

/**
 * Доступ до спільноти: показ у каталозі, пароль для вступу, перегляд гостями без акаунта
 * й гостьовий чат в одному з відкритих текстових каналів.
 */
export function AccessCard({
    slug,
    access,
    closed,
}: {
    slug: string;
    access: CommunityAccess;
    closed: boolean;
}) {
    const form = useForm({
        is_listed: access.is_listed,
        guest_view: access.guest_view,
        guest_chat_channel_id: access.guest_chat_channel_id,
        password: '',
        clear_password: false,
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(`/c/${slug}/settings/access`, {
            preserveScroll: true,
            onSuccess: () => form.setData('password', ''),
        });
    };

    return (
        <SettingsCard
            title={tr('Доступ')}
            description={tr(
                'Хто знаходить спільноту, як у неї вступають і що бачать гості',
            )}
        >
            <form onSubmit={submit} className="space-y-5">
                <Row
                    title={tr('Показувати в каталозі')}
                    hint={tr(
                        'Вимкніть — і спільноту знайдуть лише за посиланням чи запрошенням.',
                    )}
                >
                    <Toggle
                        checked={form.data.is_listed}
                        onChange={(v) => form.setData('is_listed', v)}
                        label={tr('Показувати в каталозі')}
                    />
                </Row>

                <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                        <KeyRound className="size-4 text-white/50" />
                        {tr('Пароль для вступу')}
                    </p>
                    <p className="text-xs text-white/50">
                        {access.has_password && !form.data.clear_password
                            ? tr(
                                  'Пароль задано. Хто його знає — вступає одразу, без заявки. Запрошення працюють і без пароля.',
                              )
                            : tr(
                                  'Без пароля вступ як зараз. З паролем — лише ті, кому ви його дали, або за запрошенням.',
                              )}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="password"
                            value={form.data.password}
                            onChange={(e) => {
                                form.setData('password', e.target.value);
                                form.setData('clear_password', false);
                            }}
                            placeholder={
                                access.has_password
                                    ? tr('Новий пароль')
                                    : tr('Від 4 символів')
                            }
                            autoComplete="new-password"
                            className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                        />
                        {access.has_password && (
                            <button
                                type="button"
                                onClick={() => {
                                    form.setData(
                                        'clear_password',
                                        !form.data.clear_password,
                                    );
                                    form.setData('password', '');
                                }}
                                className={cn(
                                    'h-11 rounded-xl px-4 text-sm font-medium transition',
                                    form.data.clear_password
                                        ? 'bg-rose-500/20 text-rose-200'
                                        : 'bg-white/[0.06] text-white/70 hover:text-white',
                                )}
                            >
                                {form.data.clear_password
                                    ? tr('Пароль буде прибрано')
                                    : tr('Прибрати пароль')}
                            </button>
                        )}
                    </div>
                    {form.errors.password && (
                        <p className="text-xs text-rose-300">
                            {form.errors.password}
                        </p>
                    )}
                </div>

                <Row
                    title={tr('Перегляд гостями')}
                    hint={
                        closed
                            ? tr('Закриту спільноту гості не бачать.')
                            : tr(
                                  'Люди без акаунта бачать опис і відкриті канали (лише читання) — і можуть зареєструватися.',
                              )
                    }
                >
                    <Toggle
                        checked={form.data.guest_view}
                        disabled={closed}
                        onChange={(v) => form.setData('guest_view', v)}
                        label={tr('Перегляд гостями')}
                    />
                </Row>
                {form.errors.guest_view && (
                    <p className="text-xs text-rose-300">
                        {form.errors.guest_view}
                    </p>
                )}

                {form.data.guest_view && access.guest_chat_on && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-white">
                            {tr('Гостьовий чат')}
                        </p>
                        <p className="text-xs text-white/50">
                            {tr(
                                'У вибраному каналі гості пишуть під своїм іменем. Посилання їм заборонені, заборонені слова діють.',
                            )}
                        </p>
                        <select
                            value={form.data.guest_chat_channel_id ?? ''}
                            onChange={(e) =>
                                form.setData(
                                    'guest_chat_channel_id',
                                    e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                )
                            }
                            className={cn(selectClass, 'h-11 w-full')}
                        >
                            <option value="">
                                {tr('Вимкнено — гості лише читають')}
                            </option>
                            {access.channels.map((channel) => (
                                <option key={channel.id} value={channel.id}>
                                    # {channel.name}
                                </option>
                            ))}
                        </select>
                        {form.errors.guest_chat_channel_id && (
                            <p className="text-xs text-rose-300">
                                {form.errors.guest_chat_channel_id}
                            </p>
                        )}
                    </div>
                )}

                {access.guest_view && (
                    <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/60">
                        <span className="min-w-0 flex-1 truncate">
                            {access.guest_url}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                void navigator.clipboard.writeText(
                                    access.guest_url,
                                );
                                toast.success(tr('Посилання скопійовано.'));
                            }}
                            className="inline-flex items-center gap-1.5 font-medium text-white/80 hover:text-white"
                        >
                            <Copy className="size-3.5" />
                            {tr('Копіювати')}
                        </button>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={form.processing || !form.isDirty}
                        className="btn-glow rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Зберегти доступ')}
                    </button>
                </div>
            </form>
        </SettingsCard>
    );
}

import { router } from '@inertiajs/react';
import { CheckCircle2, Unlink } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { DiscordIcon, GoogleIcon } from '@/components/auth/brand-icons';
import { useGoogleSignIn } from '@/components/auth/social-login';
import { Spinner } from '@/components/ui/spinner';
import { SettingsCard } from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import type { SocialConnection, SocialProvider } from '@/types/auth';
import { tr } from '@/lib/i18n';

const brands: Record<
    SocialProvider,
    { icon: ComponentType<SVGProps<SVGSVGElement>>; tile: string }
> = {
    discord: { icon: DiscordIcon, tile: 'bg-[#5865F2] text-white' },
    google: { icon: GoogleIcon, tile: 'bg-white' },
};

export function ConnectedAccounts({
    connections,
}: {
    connections: SocialConnection[];
}) {
    const google = useGoogleSignIn();

    const connect = (provider: SocialProvider) => {
        if (provider === 'discord') {
            window.location.href = '/auth/discord';
        } else {
            void google.start();
        }
    };

    const disconnect = (connection: SocialConnection) => {
        if (
            window.confirm(
                tr(
                    'Від’єднати {label}? Увійти можна буде поштою й паролем — якщо пароль не задавали, скористайтеся «Забули пароль?».',
                    { label: connection.label },
                ),
            )
        ) {
            router.delete(`/auth/social/${connection.provider}`, {
                preserveScroll: true,
            });
        }
    };

    return (
        <SettingsCard
            list
            title={tr('Під’єднані акаунти')}
            description={tr(
                'Входьте в один клік і показуйте Discord у профілі сім’ї',
            )}
        >
            <div>
                {connections.map((c) => {
                    const Icon = brands[c.provider].icon;
                    const pending = c.provider === 'google' && google.pending;

                    return (
                        <div
                            key={c.provider}
                            className="gc-row flex flex-wrap items-center gap-4 py-3"
                            data-test={`connection-${c.provider}`}
                        >
                            <span
                                className={cn(
                                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                    brands[c.provider].tile,
                                )}
                            >
                                <Icon className="size-5" />
                            </span>
                            <span className="min-w-[160px] flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                                    {c.label}
                                    {c.connected && (
                                        <CheckCircle2 className="size-4 text-emerald-300" />
                                    )}
                                </span>
                                <span className="mt-0.5 block text-xs break-words text-white/45">
                                    {c.connected
                                        ? (c.account ?? tr('Під’єднано'))
                                        : c.available
                                          ? tr('Не під’єднано')
                                          : tr(
                                                'Адміністратор ще не налаштував вхід',
                                            )}
                                </span>
                            </span>
                            {c.connected ? (
                                <button
                                    type="button"
                                    onClick={() => disconnect(c)}
                                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-white/55 transition hover:bg-rose-500/10 hover:text-rose-200"
                                >
                                    <Unlink className="size-4" />
                                    {tr('Від’єднати')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={!c.available || pending}
                                    onClick={() => connect(c.provider)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-white/[0.07] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {pending && <Spinner />}
                                    {tr('Під’єднати')}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </SettingsCard>
    );
}

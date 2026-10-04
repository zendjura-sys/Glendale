import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DiscordIcon, GoogleIcon } from '@/components/auth/brand-icons';
import { Spinner } from '@/components/ui/spinner';
import { GoogleSignInCancelled, googleIdToken } from '@/lib/google-sign-in';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

export function useGoogleSignIn() {
    const config = usePage().props.site.social?.google ?? null;
    const [pending, setPending] = useState(false);

    const start = async () => {
        if (!config || pending) {
            return;
        }

        setPending(true);

        try {
            const tokens = await googleIdToken(config);
            router.post(
                '/auth/firebase',
                { id_token: tokens.idToken, google_token: tokens.googleToken },
                { onFinish: () => setPending(false) },
            );
        } catch (error) {
            setPending(false);

            if (!(error instanceof GoogleSignInCancelled)) {
                toast.error((error as Error).message);
            }
        }
    };

    return { available: config !== null, pending, start };
}

const buttonBase =
    'flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none disabled:opacity-60';

export function SocialLogin({
    mode,
    divider = true,
}: {
    mode: 'login' | 'register';
    divider?: boolean;
}) {
    const discord = usePage().props.site.social?.discord ?? false;
    const google = useGoogleSignIn();

    if (!discord && !google.available) {
        return null;
    }

    const verb = mode === 'login' ? tr('Увійти') : tr('Продовжити');

    return (
        <div className="grid gap-3">
            <div
                className={cn(
                    'grid gap-2.5',
                    discord && google.available && 'sm:grid-cols-2',
                )}
            >
                {google.available && (
                    <button
                        type="button"
                        onClick={google.start}
                        disabled={google.pending}
                        className={cn(
                            buttonBase,
                            'bg-white text-[#1f1f1f] shadow-[0_8px_24px_-12px_rgb(255_255_255/0.5)] hover:bg-white/90',
                        )}
                        data-test="google-login"
                    >
                        {google.pending ? (
                            <Spinner className="text-[#1f1f1f]" />
                        ) : (
                            <GoogleIcon className="size-[18px]" />
                        )}
                        {verb} {tr('з Google')}
                    </button>
                )}
                {discord && (
                    <a
                        href="/auth/discord"
                        className={cn(
                            buttonBase,
                            'bg-[#5865F2] text-white shadow-[0_8px_24px_-12px_rgb(88_101_242/0.9)] hover:bg-[#4752c4]',
                        )}
                        data-test="discord-login"
                    >
                        <DiscordIcon className="size-5" />
                        {verb} {tr('з Discord')}
                    </a>
                )}
            </div>

            {divider && (
                <div className="flex items-center gap-3 text-[11px] font-medium tracking-[0.2em] text-white/30 uppercase">
                    <span className="h-px flex-1 bg-white/10" />
                    {tr('або поштою')}
                    <span className="h-px flex-1 bg-white/10" />
                </div>
            )}
        </div>
    );
}

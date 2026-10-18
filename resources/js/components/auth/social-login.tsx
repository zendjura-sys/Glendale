import { router, usePage } from '@inertiajs/react';
import { usePasskeyVerify } from '@laravel/passkeys/react';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DiscordIcon, GoogleIcon } from '@/components/auth/brand-icons';
import { AuthDivider } from '@/components/auth/auth-divider';
import InputError from '@/components/input-error';
import { Spinner } from '@/components/ui/spinner';
import { GoogleSignInCancelled, googleIdToken } from '@/lib/google-sign-in';
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

/** Плитка іншого способу входу: скло, кольорова іконка сервісу, однакова для всіх сервісів. */
const tile =
    'group flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition-colors hover:border-white/20 hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60';

/**
 * Вхід через інші сервіси (Google, Discord) і ключ доступу — одним блоком плиток над формою пошти.
 * Дві плитки в ряд; непарна остання тягнеться на всю ширину. Ключ доступу — лише для входу
 * (зареєструватися ним не можна).
 */
export function SocialLogin({
    mode,
    divider = true,
}: {
    mode: 'login' | 'register';
    divider?: boolean;
}) {
    const discord = usePage().props.site.social?.discord ?? false;
    const google = useGoogleSignIn();
    const passkey = usePasskeyVerify({
        onSuccess: (response) => router.visit(response.redirect ?? '/feed'),
    });
    const withPasskey = mode === 'login' && passkey.isSupported;

    if (!discord && !google.available && !withPasskey) {
        return null;
    }

    const verb = mode === 'login' ? tr('Увійти') : tr('Продовжити');

    return (
        <div className="grid gap-6">
            <div className="grid grid-cols-2 gap-2.5 [&>*:last-child:nth-child(odd)]:col-span-full">
                {google.available && (
                    <button
                        type="button"
                        onClick={google.start}
                        disabled={google.pending}
                        aria-label={`${verb} ${tr('з Google')}`}
                        className={tile}
                        data-test="google-login"
                    >
                        {google.pending ? (
                            <Spinner />
                        ) : (
                            <GoogleIcon className="size-[18px] shrink-0" />
                        )}
                        Google
                    </button>
                )}
                {discord && (
                    <a
                        href="/auth/discord"
                        aria-label={`${verb} ${tr('з Discord')}`}
                        className={tile}
                        data-test="discord-login"
                    >
                        <DiscordIcon className="size-5 shrink-0 text-[#7983f5]" />
                        Discord
                    </a>
                )}
                {withPasskey && (
                    <button
                        type="button"
                        onClick={passkey.verify}
                        disabled={passkey.isLoading}
                        className={tile}
                        data-test="passkey-login"
                    >
                        {passkey.isLoading ? (
                            <Spinner />
                        ) : (
                            <KeyRound className="size-[18px] shrink-0 text-primary" />
                        )}
                        <span className="truncate">
                            {passkey.isLoading
                                ? tr('Перевірка…')
                                : tr('Ключ доступу')}
                        </span>
                    </button>
                )}
            </div>
            {withPasskey && passkey.error && (
                <InputError
                    message={passkey.error}
                    className="-mt-3 text-center"
                />
            )}

            {divider && <AuthDivider>{tr('або поштою')}</AuthDivider>}
        </div>
    );
}

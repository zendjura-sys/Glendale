import type { FirebaseConfig } from '@/types/auth';
import { LOCALE, tr } from '@/lib/i18n';

export class GoogleSignInCancelled extends Error {}

const messages: Record<string, string> = {
    'auth/popup-blocked': tr(
        'Браузер заблокував вікно Google. Дозвольте спливаючі вікна для сайту.',
    ),
    'auth/unauthorized-domain': tr(
        'Цей домен не додано в Firebase → Authentication → Authorized domains.',
    ),
    'auth/operation-not-allowed': tr(
        'Вхід через Google вимкнено в Firebase Console.',
    ),
    'auth/network-request-failed': tr(
        'Немає з’єднання з Google. Спробуйте ще раз.',
    ),
    'auth/invalid-api-key': tr('Неправильний apiKey Firebase.'),
};

/**
 * Відкриває вікно Google через Firebase і повертає токени для бекенду: Firebase ID-токен
 * і Google ID-токен (його сервер перевіряє через tokeninfo, якщо *.googleapis.com йому недоступні).
 * SDK завантажується лише після натискання кнопки, щоб не роздувати основний бандл.
 */
export type GoogleTokens = { idToken: string; googleToken: string | null };

export async function googleIdToken(
    config: FirebaseConfig,
): Promise<GoogleTokens> {
    const [{ getApps, initializeApp }, firebaseAuth] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
    ]);

    const app =
        getApps().find((a) => a.name === 'gamecon') ??
        initializeApp(
            {
                apiKey: config.apiKey,
                authDomain: config.authDomain,
                projectId: config.projectId,
                ...(config.appId ? { appId: config.appId } : {}),
            },
            'gamecon',
        );
    const auth = firebaseAuth.getAuth(app);
    auth.languageCode = LOCALE;
    await firebaseAuth.setPersistence(auth, firebaseAuth.inMemoryPersistence);

    const provider = new firebaseAuth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const result = await firebaseAuth.signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();
        const googleToken =
            firebaseAuth.GoogleAuthProvider.credentialFromResult(result)
                ?.idToken ?? null;
        await firebaseAuth.signOut(auth);

        return { idToken, googleToken };
    } catch (error) {
        const code = (error as { code?: string }).code ?? '';

        if (
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/cancelled-popup-request' ||
            code === 'auth/user-cancelled'
        ) {
            throw new GoogleSignInCancelled();
        }

        throw new Error(
            messages[code] ??
                tr('Не вдалося увійти через Google. Спробуйте ще раз.'),
        );
    }
}

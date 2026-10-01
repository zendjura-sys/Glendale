import type { FirebaseConfig } from '@/types/auth';

export class GoogleSignInCancelled extends Error {}

const messages: Record<string, string> = {
    'auth/popup-blocked':
        'Браузер заблокував вікно Google. Дозвольте спливаючі вікна для сайту.',
    'auth/unauthorized-domain':
        'Цей домен не додано в Firebase → Authentication → Authorized domains.',
    'auth/operation-not-allowed':
        'Вхід через Google вимкнено в Firebase Console.',
    'auth/network-request-failed':
        'Немає з’єднання з Google. Спробуйте ще раз.',
    'auth/invalid-api-key': 'Неправильний apiKey Firebase.',
};

/**
 * Відкриває вікно Google через Firebase і повертає одноразовий ID-токен для бекенду.
 * SDK завантажується лише після натискання кнопки, щоб не роздувати основний бандл.
 */
export async function googleIdToken(config: FirebaseConfig): Promise<string> {
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
    auth.languageCode = 'uk';
    await firebaseAuth.setPersistence(auth, firebaseAuth.inMemoryPersistence);

    const provider = new firebaseAuth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const result = await firebaseAuth.signInWithPopup(auth, provider);
        const token = await result.user.getIdToken();
        await firebaseAuth.signOut(auth);

        return token;
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
                'Не вдалося увійти через Google. Спробуйте ще раз.',
        );
    }
}

import { Head } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import { SCOPE_LABELS } from '@/components/servers/server-apps';
import { tr } from '@/lib/i18n';

type Props = { scopes: Record<string, string>; base: string };

function Code({ children }: { children: string }) {
    return (
        <pre className="overflow-x-auto rounded-2xl bg-black/40 p-4 font-mono text-xs leading-relaxed text-white/80">
            {children}
        </pre>
    );
}

function Step({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="glass min-w-0 space-y-3 rounded-3xl p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-white">
                {title}
            </h2>
            {children}
        </section>
    );
}

/** Інструкція для власників серверів: вхід через GameCon, профіль гравця й синхронізація онлайну. */
export default function DevelopersOAuth({ scopes, base }: Props) {
    return (
        <>
            <Head title={tr('Увійти через GameCon — для серверів')} />
            <div className="mx-auto max-w-3xl space-y-5">
                <header className="space-y-2">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <LogIn className="size-6 text-gc-lilac-300" />
                        {tr('Увійти через GameCon')}
                    </h1>
                    <p className="text-sm leading-relaxed text-white/60">
                        {tr(
                            'OAuth 2.0 з кодом авторизації. Сайт проєкту передає секрет, лаунчер чи гра без сервера — PKCE (S256). Застосунок створює власник сервера на сторінці свого сервера.',
                        )}
                    </p>
                </header>

                <Step title={tr('1. Відправте гравця на сторінку входу')}>
                    <Code>{`${base}/oauth/authorize
  ?response_type=code
  &client_id=gc_...
  &redirect_uri=https://example.com/auth/gamecon/callback
  &scope=profile characters family
  &state=<випадковий рядок>
  &code_challenge=<base64url(sha256(verifier))>   // для лаунчера
  &code_challenge_method=S256`}</Code>
                    <ul className="space-y-1 text-sm text-white/65">
                        {Object.keys(scopes).map((key) => (
                            <li key={key}>
                                <code className="text-[#c4b5fd]">{key}</code> —{' '}
                                {SCOPE_LABELS()[key] ?? key}
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Після згоди гравця GameCon поверне його на redirect_uri з параметрами code і state, або з error=access_denied.',
                        )}
                    </p>
                </Step>

                <Step title={tr('2. Обміняйте код на токен')}>
                    <Code>{`POST ${base}/api/oauth/token
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code
code=...
redirect_uri=https://example.com/auth/gamecon/callback
code_verifier=...        // якщо був code_challenge`}</Code>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Код живе 10 хвилин і працює один раз. Токен — 30 днів.',
                        )}
                    </p>
                </Step>

                <Step title={tr('3. Отримайте профіль гравця')}>
                    <Code>{`GET ${base}/api/oauth/userinfo
Authorization: Bearer gct_...

{
  "sub": "42",
  "username": "taras",
  "name": "Тарас Коваль",
  "avatar_url": "...",
  "verified_player": true,
  "characters": [{ "name": "Taras_Koval", "is_main": true, ... }],
  "family": { "name": "Scaletta", "tag": "SCL", "rank": 7, ... }
}`}</Code>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Перший вхід підтверджує гравця: на GameCon у нього з’являється позначка «підтверджений гравець» вашого сервера.',
                        )}
                    </p>
                </Step>

                <Step title={tr('4. Передавайте онлайн і хто в грі')}>
                    <Code>{`POST ${base}/api/oauth/server/sync
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/json

{
  "online": 812,
  "max": 1000,
  "players": [
    { "user_id": 42, "nickname": "Taras_Koval", "online": true }
  ]
}`}</Code>
                    <p className="text-sm text-white/55">
                        {tr(
                            'Раз на 1–5 хвилин. user_id — це sub з userinfo; оновлюються лише гравці, які вже входили через ваш застосунок.',
                        )}
                    </p>
                </Step>
            </div>
        </>
    );
}

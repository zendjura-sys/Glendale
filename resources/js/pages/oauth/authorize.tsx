import { Head, router, usePage } from '@inertiajs/react';
import { Check, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { SCOPE_LABELS } from '@/components/servers/server-apps';
import { ServerIcon } from '@/components/servers/server-icon';
import { tr } from '@/lib/i18n';

type Props = {
    app: { name: string; host: string | null };
    server: { name: string; slug: string; icon: string | null };
    scopes: string[];
    query: Record<string, string>;
};

export default function OAuthAuthorize({ app, server, scopes, query }: Props) {
    const { auth } = usePage().props;
    const [busy, setBusy] = useState(false);
    const decide = (decision: 'allow' | 'deny') =>
        router.post(
            '/oauth/authorize',
            { decision, query },
            { onStart: () => setBusy(true), onFinish: () => setBusy(false) },
        );

    return (
        <>
            <Head title={tr('Увійти через GameCon')} />
            <div className="mx-auto max-w-md py-4">
                <section className="glass space-y-5 rounded-3xl p-6">
                    <div className="flex items-center justify-center gap-3">
                        <ServerIcon
                            name={server.name}
                            icon={server.icon}
                            className="size-14"
                        />
                        <span className="text-white/30">⇄</span>
                        <UserAvatar user={auth.user} size="lg" />
                    </div>
                    <div className="text-center">
                        <h1 className="font-display text-xl font-bold text-white">
                            {tr('{app} просить доступ', { app: app.name })}
                        </h1>
                        <p className="mt-1 text-sm text-white/55">
                            {tr('Сервер {server} · {host}', {
                                server: server.name,
                                host: app.host ?? '',
                            })}
                        </p>
                    </div>
                    <ul className="space-y-2">
                        {scopes.map((scope) => (
                            <li
                                key={scope}
                                className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/80"
                            >
                                <Check className="size-4 shrink-0 text-emerald-300" />
                                {SCOPE_LABELS()[scope] ?? scope}
                            </li>
                        ))}
                    </ul>
                    <p className="flex gap-2 text-xs leading-relaxed text-white/45">
                        <ShieldCheck className="size-4 shrink-0 text-white/40" />
                        {tr(
                            'Пароль і пошта серверу не передаються. Скасувати доступ можна в Налаштування → Акаунт.',
                        )}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide('deny')}
                            className="h-11 rounded-xl bg-white/[0.06] text-sm font-medium text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                        >
                            {tr('Відмовити')}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide('allow')}
                            className="btn-glow h-11 rounded-xl text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Дозволити')}
                        </button>
                    </div>
                    <p className="text-center text-xs text-white/35">
                        {tr('Ви увійшли як {name}', { name: auth.user.name })}
                    </p>
                </section>
            </div>
        </>
    );
}

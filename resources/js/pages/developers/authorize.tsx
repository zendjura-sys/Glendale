import { Head, router, usePage } from '@inertiajs/react';
import {
    AppWindow,
    Check,
    ExternalLink,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';

type Props = {
    error: string | null;
    app?: {
        name: string;
        description: string | null;
        website: string | null;
        author: string;
        created_at: string | null;
    };
    scopes?: { key: string; label: string }[];
    redirect_host?: string;
    query?: Record<string, string>;
};

/** Екран згоди OAuth для застосунків розробників: що саме застосунок отримає. */
export default function DeveloperAuthorize({
    error,
    app,
    scopes = [],
    redirect_host,
    query = {},
}: Props) {
    const { auth } = usePage().props;
    const [busy, setBusy] = useState(false);
    const decide = (approve: boolean) =>
        router.post(
            '/oauth/authorize',
            { ...query, approve },
            { onStart: () => setBusy(true), onFinish: () => setBusy(false) },
        );

    if (error || !app) {
        return (
            <>
                <Head title={tr('Помилка входу через GameCon')} />
                <div className="mx-auto max-w-md py-4">
                    <section className="gc-solid space-y-3 rounded-2xl p-6 text-center">
                        <ShieldAlert className="mx-auto size-10 text-rose-300" />
                        <h1 className="font-display text-xl font-bold text-white">
                            {tr('Не вдалося продовжити')}
                        </h1>
                        <p className="text-sm text-white/60">{error}</p>
                        <p className="text-xs text-white/40">
                            {tr(
                                'Повідомте розробника застосунку. Нічого з вашого акаунта не передано.',
                            )}
                        </p>
                    </section>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title={tr('Увійти через GameCon')} />
            <div className="mx-auto max-w-md py-4">
                <section className="gc-solid space-y-5 rounded-2xl p-6">
                    <div className="flex items-center justify-center gap-3">
                        <span className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                            <AppWindow className="size-7" />
                        </span>
                        <span className="text-white/30">⇄</span>
                        <UserAvatar user={auth.user} size="lg" />
                    </div>
                    <div className="text-center">
                        <h1 className="font-display text-xl font-bold text-white">
                            {tr('{app} просить доступ', { app: app.name })}
                        </h1>
                        <p className="mt-1 text-sm text-white/55">
                            {tr('Розробник: {author}', { author: app.author })}
                            {app.created_at &&
                                ` · ${tr('з {time}', { time: timeAgo(app.created_at) })}`}
                        </p>
                        {app.description && (
                            <p className="mt-2 text-sm text-white/65">
                                {app.description}
                            </p>
                        )}
                    </div>
                    <ul className="space-y-2">
                        {scopes.map((scope) => (
                            <li
                                key={scope.key}
                                className="gc-solid-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/80"
                            >
                                <Check className="size-4 shrink-0 text-emerald-300" />
                                {tr(scope.label)}
                            </li>
                        ))}
                    </ul>
                    <p className="flex gap-2 text-xs leading-relaxed text-white/45">
                        <ShieldCheck className="size-4 shrink-0 text-white/40" />
                        {tr(
                            'Пароль застосунок не отримає. Після згоди вас поверне на {host}. Відключити доступ можна будь-коли в Налаштування → Застосунки.',
                            { host: redirect_host ?? '' },
                        )}
                    </p>
                    {app.website && (
                        <a
                            href={app.website}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                        >
                            {app.website}
                            <ExternalLink className="size-3" />
                        </a>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(false)}
                            className="gc-solid-2 h-11 rounded-xl text-sm font-medium text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                        >
                            {tr('Відмовити')}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => decide(true)}
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

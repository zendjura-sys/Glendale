import { Head, router } from '@inertiajs/react';
import { CircleCheck, Gamepad2, ShieldAlert, ShieldX } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';

type Props = {
    code: string | null;
    error: string | null;
    done: { app: string; approved: boolean } | null;
};

/** gamecon.online/link — вхід у гру на ПК, консолі чи телевізорі за кодом з екрана. */
export default function DeveloperLink({ code, error, done }: Props) {
    const reduce = useReducedMotion();
    const [value, setValue] = useState(code ?? '');
    const [busy, setBusy] = useState(false);
    const clean = value
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 8);
    const pretty =
        clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (clean.length !== 8) return;
        router.get(
            '/link',
            { code: pretty },
            { onStart: () => setBusy(true), onFinish: () => setBusy(false) },
        );
    };

    return (
        <>
            <Head title={tr('Вхід у гру за кодом')} />
            <div className="mx-auto max-w-md py-4">
                <m.section
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="gc-solid space-y-5 rounded-2xl p-6 text-center"
                >
                    {done ? (
                        <>
                            {done.approved ? (
                                <CircleCheck className="mx-auto size-12 text-emerald-300" />
                            ) : (
                                <ShieldX className="mx-auto size-12 text-rose-300" />
                            )}
                            <h1 className="font-display text-xl font-bold text-white">
                                {done.approved
                                    ? tr('Готово! Поверніться до гри')
                                    : tr('Вхід скасовано')}
                            </h1>
                            <p className="text-sm text-white/60">
                                {done.approved
                                    ? tr(
                                          '«{app}» увійде у ваш акаунт за кілька секунд. Цю сторінку можна закрити.',
                                          { app: done.app },
                                      )
                                    : tr(
                                          '«{app}» не отримав доступу до вашого акаунта.',
                                          { app: done.app },
                                      )}
                            </p>
                        </>
                    ) : (
                        <>
                            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                                <Gamepad2 className="size-7" />
                            </span>
                            <div>
                                <h1 className="font-display text-xl font-bold text-white">
                                    {tr('Вхід у гру за кодом')}
                                </h1>
                                <p className="mt-1 text-sm text-white/55">
                                    {tr(
                                        'Введіть код, який показує гра чи застосунок на іншому пристрої.',
                                    )}
                                </p>
                            </div>
                            <form onSubmit={submit} className="space-y-3">
                                <input
                                    autoFocus
                                    value={pretty}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder="ABCD-EFGH"
                                    autoComplete="one-time-code"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                    aria-label={tr('Код з гри')}
                                    className="gc-solid-2 h-14 w-full rounded-xl text-center font-mono text-2xl font-semibold tracking-[0.3em] text-white outline-none placeholder:text-white/20 focus:ring-2 focus:ring-primary/60"
                                />
                                {error && (
                                    <p className="flex items-start gap-2 text-left text-sm text-rose-300">
                                        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                                        {tr(error)}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    disabled={busy || clean.length !== 8}
                                    className="btn-glow h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-50"
                                >
                                    {tr('Продовжити')}
                                </button>
                            </form>
                            <p className="text-xs text-white/40">
                                {tr(
                                    'Далі ви побачите, що саме просить гра, і зможете дозволити чи відмовити.',
                                )}
                            </p>
                        </>
                    )}
                </m.section>
            </div>
        </>
    );
}

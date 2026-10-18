import { Head, router } from '@inertiajs/react';
import { ArrowRight, Settings2 } from 'lucide-react';
import { LayoutGroup, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Logo } from '@/components/gc/logo';
import { PaletteSync } from '@/components/gc/palette-sync';
import { ModeCard } from '@/components/modes/mode-card';
import { tr } from '@/lib/i18n';
import type { NetworkMode } from '@/lib/modes';
import { EASE_OUT, motionOr, RISE } from '@/lib/motion';

/**
 * Вибір режиму соцмережі одразу після реєстрації: сторінка-«лендинг» без меню сайту.
 * Кожна картка пояснює, що буде в режимі й чого не буде; змінити можна будь-коли в налаштуваннях.
 */
export default function StartMode({
    modes,
    current,
    moduleNames,
}: {
    modes: NetworkMode[];
    current: string;
    moduleNames: Record<string, string>;
}) {
    const reduce = useReducedMotion();
    const [picked, setPicked] = useState(current);
    const [sending, setSending] = useState(false);
    const allModules = Object.keys(moduleNames);
    const chosen = modes.find((mode) => mode.id === picked) ?? modes[0];
    const rise = (i: number) =>
        reduce
            ? {}
            : {
                  initial: { opacity: 0, y: 24 },
                  animate: { opacity: 1, y: 0 },
                  transition: {
                      duration: 0.6,
                      ease: EASE_OUT,
                      delay: 0.1 + i * 0.07,
                  },
              };

    const submit = () => {
        setSending(true);
        router.post(
            '/start/mode',
            { mode: chosen.id },
            { onFinish: () => setSending(false) },
        );
    };

    return (
        <>
            <Head title={tr('Яким буде твій GameCon?')} />
            <PaletteSync />
            <SiteBackground />

            <main
                id="main-content"
                className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-36 sm:px-6"
            >
                <m.div {...rise(0)} className="flex justify-center">
                    <Logo />
                </m.div>

                <header className="mx-auto mt-10 max-w-2xl text-center sm:mt-14">
                    <m.p
                        {...rise(1)}
                        className="text-sm font-medium text-primary"
                    >
                        {tr('Ще один крок')}
                    </m.p>
                    <m.h1
                        {...rise(2)}
                        className="mt-3 font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] font-bold tracking-tight text-balance text-white"
                    >
                        {tr('Яким буде твій GameCon?')}
                    </m.h1>
                    <m.p
                        {...rise(3)}
                        className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-white/65 sm:text-base"
                    >
                        {tr(
                            'Обери режим — і ми покажемо лише те, що тобі цікаво: без зайвих розділів у меню й стрічці. Нічого не видаляється, і змінити режим можна будь-коли.',
                        )}
                    </m.p>
                </header>

                <LayoutGroup>
                    <div
                        role="radiogroup"
                        aria-label={tr('Режим соцмережі')}
                        className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {modes.map((mode, i) => (
                            <m.div key={mode.id} {...rise(4 + i)}>
                                <ModeCard
                                    mode={mode}
                                    active={mode.id === chosen.id}
                                    onSelect={() => setPicked(mode.id)}
                                    moduleNames={moduleNames}
                                    allModules={allModules}
                                    layoutId="start-mode"
                                />
                            </m.div>
                        ))}
                    </div>
                </LayoutGroup>

                <m.p
                    {...rise(5 + modes.length)}
                    className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-white/50"
                >
                    <Settings2 className="size-4 shrink-0" />
                    {tr(
                        'Передумаєш — Налаштування → Вигляд → Режим соцмережі.',
                    )}
                </m.p>
            </main>

            {/* Острів дії внизу: вибраний режим і кнопка «Продовжити». */}
            <m.div
                initial={reduce ? false : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionOr(reduce, { ...RISE, delay: 0.5 })}
                className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
            >
                <div className="liquid-glass liquid-glass--dense pointer-events-auto flex w-full max-w-[560px] items-center gap-3 rounded-[24px] py-2.5 pr-2.5 pl-5">
                    <span className="min-w-0 flex-1 text-sm text-white/60">
                        {tr('Режим')}:{' '}
                        <span className="font-semibold text-white">
                            {tr(chosen.name)}
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={sending}
                        className="btn-glow inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold disabled:opacity-60"
                    >
                        {tr('Продовжити')}
                        <ArrowRight className="size-4" />
                    </button>
                </div>
            </m.div>
        </>
    );
}

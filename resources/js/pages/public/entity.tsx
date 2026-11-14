import { Head, Link } from '@inertiajs/react';
import {
    Clapperboard,
    LogIn,
    Server,
    ShieldHalf,
    UserPlus,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';

type Entity = {
    kind: 'movie' | 'server' | 'clan';
    title: string;
    subtitle: string | null;
    image: string | null;
    cover: string | null;
    description: string | null;
    facts: { label: string; value: string }[];
    cta: string;
};

const ICONS = { movie: Clapperboard, server: Server, clan: ShieldHalf };

/**
 * Тайтл кіно, сервер чи клан для гостя й пошуковика: назва, картинка, факти, опис і запрошення увійти.
 * Учасник за тим самим адресом бачить повну сторінку.
 */
export default function PublicEntity({ entity }: { entity: Entity }) {
    const reduce = useReducedMotion();
    const Icon = ICONS[entity.kind];
    const poster = entity.kind === 'movie';
    const [broken, setBroken] = useState(false);

    return (
        <>
            <Head title={entity.title} />
            <motion.article
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto w-full max-w-4xl space-y-4 px-1 py-4"
            >
                <section className="gc-solid relative overflow-hidden rounded-3xl">
                    {entity.cover && (
                        <div className="absolute inset-0">
                            <img
                                src={entity.cover}
                                alt=""
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                                className="size-full object-cover opacity-35"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/70 to-transparent" />
                        </div>
                    )}
                    <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
                        <div
                            className={
                                poster
                                    ? 'grid aspect-[2/3] w-32 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/[0.06] sm:w-40'
                                    : 'grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl bg-white/[0.06]'
                            }
                        >
                            {entity.image && !broken ? (
                                <img
                                    src={entity.image}
                                    alt={entity.title}
                                    onError={() => setBroken(true)}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <Icon className="size-9 text-white/40" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
                                {entity.title}
                            </h1>
                            {entity.subtitle && (
                                <p className="mt-1 text-white/60">
                                    {entity.subtitle}
                                </p>
                            )}
                            <dl className="mt-4 flex flex-wrap gap-2">
                                {entity.facts.map((f) => (
                                    <div
                                        key={f.label}
                                        className="rounded-xl bg-white/[0.06] px-3 py-1.5"
                                    >
                                        <dt className="text-[11px] text-white/45">
                                            {tr(f.label)}
                                        </dt>
                                        <dd className="text-sm font-semibold text-white">
                                            {tr(f.value)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </div>
                </section>

                {entity.description && (
                    <section className="gc-solid rounded-3xl p-5 sm:p-7">
                        <p className="text-[15px] leading-relaxed whitespace-pre-line text-white/80">
                            {entity.description}
                        </p>
                    </section>
                )}

                <section className="gc-solid flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-6">
                    <p className="flex-1 text-sm text-white/70">
                        {tr(entity.cta)}
                    </p>
                    <div className="flex gap-2">
                        <Link
                            href="/login"
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
                        >
                            <LogIn className="size-4" />
                            {tr('Увійти')}
                        </Link>
                        <Link
                            href="/register"
                            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                        >
                            <UserPlus className="size-4" />
                            {tr('Створити акаунт')}
                        </Link>
                    </div>
                </section>
            </motion.article>
        </>
    );
}

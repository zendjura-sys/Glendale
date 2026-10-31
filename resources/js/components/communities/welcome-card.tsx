import { Link } from '@inertiajs/react';
import { HandHeart, PartyPopper, ScrollText, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

export type WelcomeCard =
    | { kind: 'member'; text: string | null; has_rules: boolean }
    | {
          kind: 'admin';
          count: number;
          people: {
              id: number;
              name: string;
              username: string;
              avatar_url: string | null;
          }[];
      };

/**
 * Привітання новачку (тиждень після вступу, поки не закриє) або адміну — хто прийшов за тиждень.
 */
export function CommunityWelcomeCard({
    card,
    slug,
    name,
}: {
    card: WelcomeCard;
    slug: string;
    name: string;
}) {
    const [open, setOpen] = useState(true);
    const reduce = useReducedMotion();
    const close = () => {
        setOpen(false);
        if (card.kind === 'member') {
            void api('POST', `/c/${slug}/welcome-seen`);
        }
    };

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.section
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5"
                >
                    <button
                        type="button"
                        onClick={close}
                        aria-label={tr('Закрити')}
                        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
                    >
                        <X className="size-4" />
                    </button>
                    {card.kind === 'member' ? (
                        <div className="flex gap-3.5 pr-8">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gc-indigo/20">
                                <PartyPopper className="size-5 text-gc-lilac-300" />
                            </span>
                            <div className="min-w-0 space-y-2">
                                <h2 className="font-semibold text-white">
                                    {tr('Вітаємо у «{name}»!', { name })}
                                </h2>
                                <p className="text-sm whitespace-pre-line text-white/70">
                                    {card.text ??
                                        tr(
                                            'Розкажіть про себе в першому записі — тут раді новим людям.',
                                        )}
                                </p>
                                {card.has_rules && (
                                    <Link
                                        href={`/c/${slug}/rules`}
                                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gc-lilac-300 hover:underline"
                                    >
                                        <ScrollText className="size-4" />
                                        {tr('Правила спільноти')}
                                    </Link>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3.5 pr-8">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15">
                                <HandHeart className="size-5 text-emerald-300" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <h2 className="font-semibold text-white">
                                    {tr('За тиждень прийшло: {n}', {
                                        n: card.count,
                                    })}
                                </h2>
                                <p className="text-sm text-white/55">
                                    {tr(
                                        'Привітайте новачків — так вони швидше освояться.',
                                    )}
                                </p>
                            </div>
                            <div className="hidden shrink-0 -space-x-2 sm:flex">
                                {card.people.map((person) => (
                                    <Link
                                        key={person.id}
                                        href={`/${person.username}`}
                                        title={person.name}
                                    >
                                        <UserAvatar
                                            user={person}
                                            size="sm"
                                            showOnline={false}
                                        />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.section>
            )}
        </AnimatePresence>
    );
}

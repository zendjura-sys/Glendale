import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, ScrollText } from 'lucide-react';
import { CommunityAvatar } from '@/components/gc/community-avatar';
import { tr } from '@/lib/i18n';
import type { CommunityCard } from '@/types';

type Props = {
    community: CommunityCard;
    page: 'rules' | 'handbook';
    text: string;
    other: boolean;
};

type Section = { id: string; title: string | null; body: string };

/** Розбиває текст на розділи за рядками «# Заголовок». */
function sections(text: string): Section[] {
    const result: Section[] = [];
    let current: Section = { id: 's0', title: null, body: '' };
    for (const line of text.split(/\r?\n/)) {
        const heading = /^#{1,3}\s+(.+)$/.exec(line.trim());
        if (heading) {
            if (current.title || current.body.trim()) result.push(current);
            current = {
                id: `s${result.length + 1}`,
                title: heading[1],
                body: '',
            };
        } else {
            current.body += `${line}\n`;
        }
    }
    if (current.title || current.body.trim()) result.push(current);

    return result;
}

export default function CommunityPage({ community, page, text, other }: Props) {
    const isRules = page === 'rules';
    const parts = sections(text);
    const toc = parts.filter((part) => part.title);
    const Icon = isRules ? ScrollText : BookOpen;

    return (
        <>
            <Head
                title={`${isRules ? tr('Правила') : tr('Довідник')} — ${community.name}`}
            />
            <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/c/${community.slug}`}
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label={tr('Назад')}
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <CommunityAvatar community={community} size="md" />
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-white">
                            <Icon className="size-5 text-gc-lilac-300" />
                            {isRules ? tr('Правила') : tr('Довідник')}
                        </h1>
                        <p className="truncate text-sm text-white/50">
                            {community.name}
                        </p>
                    </div>
                    {other && (
                        <Link
                            href={`/c/${community.slug}/${isRules ? 'handbook' : 'rules'}`}
                            className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
                        >
                            {isRules ? (
                                <BookOpen className="size-4" />
                            ) : (
                                <ScrollText className="size-4" />
                            )}
                            <span className="hidden sm:inline">
                                {isRules ? tr('Довідник') : tr('Правила')}
                            </span>
                        </Link>
                    )}
                </div>

                {toc.length > 2 && (
                    <nav
                        aria-label={tr('Зміст')}
                        className="glass rounded-3xl p-4 sm:p-5"
                    >
                        <p className="mb-2 text-xs font-semibold tracking-wide text-white/45 uppercase">
                            {tr('Зміст')}
                        </p>
                        <ol className="space-y-1 text-sm">
                            {toc.map((part) => (
                                <li key={part.id}>
                                    <a
                                        href={`#${part.id}`}
                                        className="text-gc-lilac-300 hover:text-white"
                                    >
                                        {part.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                )}

                <article className="glass space-y-6 rounded-3xl p-5 sm:p-7">
                    {parts.map((part) => (
                        <section
                            key={part.id}
                            id={part.id}
                            className="scroll-mt-24"
                        >
                            {part.title && (
                                <h2 className="mb-2 font-display text-lg font-semibold text-white">
                                    {part.title}
                                </h2>
                            )}
                            <p className="text-[15px] leading-relaxed whitespace-pre-line text-white/80">
                                {part.body.trim()}
                            </p>
                        </section>
                    ))}
                </article>
            </div>
        </>
    );
}

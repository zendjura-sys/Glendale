import { Head, Link } from '@inertiajs/react';
import { Aurora } from '@/components/gc/aurora';
import { Logo } from '@/components/gc/logo';

type Section = {
    heading: string;
    paragraphs: string[];
    items: string[];
};

type Props = {
    kind: 'policy' | 'terms' | 'safety';
    title: string;
    updated: string;
    contact: string;
    summary: string | null;
    sections: Section[];
};

const PAGES = [
    { kind: 'policy', href: '/policy', label: 'Політика' },
    { kind: 'terms', href: '/terms', label: 'Умови' },
    { kind: 'safety', href: '/child-safety', label: 'Безпека дітей' },
] as const;

export default function Show({
    kind,
    title,
    updated,
    contact,
    summary,
    sections,
}: Props) {
    return (
        <>
            <Head title={title} />
            <Aurora />
            <div className="relative min-h-dvh">
                <header className="border-b border-white/[0.05] bg-[#05070f]/50 backdrop-blur-2xl">
                    <div className="mx-auto flex h-16 max-w-3xl items-center px-5">
                        <Link href="/">
                            <Logo />
                        </Link>
                    </div>
                </header>

                <main className="mx-auto max-w-3xl px-5 pt-10 pb-20">
                    <nav className="flex flex-wrap gap-2">
                        {PAGES.map((page) => (
                            <Link
                                key={page.kind}
                                href={page.href}
                                className={
                                    page.kind === kind
                                        ? 'rounded-full bg-white/[0.1] px-3 py-1.5 text-xs font-medium text-white'
                                        : 'rounded-full px-3 py-1.5 text-xs font-medium text-white/45 transition hover:bg-white/[0.06] hover:text-white'
                                }
                            >
                                {page.label}
                            </Link>
                        ))}
                    </nav>

                    <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        {title}
                    </h1>
                    <p className="mt-2 text-sm text-white/40">
                        Оновлено {updated}
                    </p>

                    {summary && (
                        <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/70">
                            {summary}
                        </p>
                    )}

                    <div className="mt-8 space-y-8">
                        {sections.map((section) => (
                            <section key={section.heading}>
                                <h2 className="text-lg font-semibold text-white">
                                    {section.heading}
                                </h2>
                                <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-white/65">
                                    {section.paragraphs.map((paragraph) => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}
                                </div>
                                {section.items.length > 0 && (
                                    <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/65">
                                        {section.items.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>

                    <p className="mt-10 text-sm text-white/50">
                        Контакт:{' '}
                        <a
                            href={`mailto:${contact}`}
                            className="font-medium text-[#9aa8ff] hover:text-white"
                        >
                            {contact}
                        </a>
                    </p>
                </main>
            </div>
        </>
    );
}

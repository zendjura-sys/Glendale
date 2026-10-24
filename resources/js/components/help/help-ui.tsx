import { Link, usePage } from '@inertiajs/react';
import {
    ChevronRight,
    Clapperboard,
    Film,
    Gamepad2,
    Info,
    LifeBuoy,
    Lightbulb,
    MessageCircle,
    Music,
    Newspaper,
    Rocket,
    Scale,
    Shield,
    ShieldCheck,
    Smartphone,
    Sparkles,
    Target,
    TriangleAlert,
} from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { SiteBackground } from '@/components/backgrounds/site-background';
import { Logo } from '@/components/gc/logo';
import { SiteFooter } from '@/components/gc/site-footer';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Блок статті довідки (App\Support\Help\HelpCatalog). */
export type HelpBlock =
    | { type: 'p' | 'h' | 'tip' | 'note'; text: string }
    | { type: 'steps' | 'list'; items: string[] };

export type HelpCategoryBrief = {
    slug: string;
    title: string;
    summary: string;
    icon: string;
};

export type HelpArticleBrief = { slug: string; title: string; summary: string };

export type HelpLinkItem = HelpArticleBrief & { category: string };

const icons: Record<string, LucideIcon> = {
    rocket: Rocket,
    newspaper: Newspaper,
    'message-circle': MessageCircle,
    shield: Shield,
    'gamepad-2': Gamepad2,
    film: Film,
    music: Music,
    clapperboard: Clapperboard,
    target: Target,
    sparkles: Sparkles,
    smartphone: Smartphone,
    'shield-check': ShieldCheck,
    scale: Scale,
    'life-buoy': LifeBuoy,
};

export function HelpIcon({ name, ...props }: { name: string } & LucideProps) {
    const Icon = icons[name] ?? LifeBuoy;

    return <Icon {...props} />;
}

/** Значок розділу: квадрат 32 px з акцентом. */
export function HelpBadge({
    name,
    className,
}: {
    name: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary',
                className,
            )}
        >
            <HelpIcon name={name} className="size-[18px]" />
        </span>
    );
}

/**
 * Оболонка довідки. Увійшли — сторінка вже всередині макета сайту; гість — легка шапка з логотипом,
 * кнопками входу й футер (як на юридичних сторінках).
 */
export function HelpShell({ children }: { children: ReactNode }) {
    const { auth, site } = usePage().props;

    if (auth.user) {
        return <div className="mx-auto w-full max-w-[860px]">{children}</div>;
    }

    return (
        <>
            <SiteBackground />
            <div className="relative mx-auto min-h-dvh max-w-[860px] px-4 pt-5 pb-4 sm:pt-8">
                <header className="mb-8 flex items-center gap-3">
                    <Link href="/" aria-label="GameCon">
                        <Logo />
                    </Link>
                    <nav className="ml-auto flex items-center gap-2">
                        <Link
                            href="/login"
                            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                        >
                            {tr('Увійти')}
                        </Link>
                        {site.registration_open && (
                            <Link
                                href="/register"
                                className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold whitespace-nowrap text-primary-foreground transition hover:opacity-90"
                            >
                                {tr('Реєстрація')}
                            </Link>
                        )}
                    </nav>
                </header>
                <main id="main-content">{children}</main>
                <SiteFooter />
            </div>
        </>
    );
}

/** Хлібні крихти: Довідка › Розділ › … */
export function HelpCrumbs({
    items,
}: {
    items: { href?: string; label: string }[];
}) {
    return (
        <nav aria-label={tr('Навігація')} className="mb-3">
            <ol className="flex flex-wrap items-center gap-1 text-[13px] text-white/50">
                {items.map((item, i) => (
                    <li key={i} className="flex items-center gap-1">
                        {i > 0 && (
                            <ChevronRight
                                aria-hidden
                                className="size-3.5 text-white/30"
                            />
                        )}
                        {item.href ? (
                            <Link
                                href={item.href}
                                className="transition hover:text-white"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span aria-current="page" className="text-white/70">
                                {item.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/** Текст із посиланнями виду [підпис](/шлях) — лише на сторінки сайту. */
export function HelpText({ text }: { text: string }) {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(LINK)) {
        const at = match.index ?? 0;
        if (at > last) parts.push(text.slice(last, at));
        parts.push(
            <Link
                key={at}
                href={match[2]}
                className="font-medium text-primary underline-offset-2 hover:underline"
            >
                {match[1]}
            </Link>,
        );
        last = at + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));

    return (
        <>
            {parts.map((part, i) => (
                <Fragment key={i}>{part}</Fragment>
            ))}
        </>
    );
}

/** Текст без розмітки посилань (для пошуку й описів). */
export function plainText(text: string): string {
    return text.replace(LINK, '$1');
}

/** Вміст статті: абзаци, підзаголовки, кроки, списки, поради й застереження. */
export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
    return (
        <div className="space-y-4 text-[15px] leading-relaxed text-white/80">
            {blocks.map((block, i) => {
                switch (block.type) {
                    case 'h':
                        return (
                            <h2
                                key={i}
                                id={`s-${i}`}
                                className="scroll-mt-24 pt-3 text-lg font-semibold text-white"
                            >
                                {block.text}
                            </h2>
                        );
                    case 'steps':
                        return (
                            <ol
                                key={i}
                                className="gc-group divide-y divide-white/[0.06] px-4"
                            >
                                {block.items.map((item, n) => (
                                    <li key={n} className="flex gap-3 py-3">
                                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-[13px] font-semibold text-primary tabular-nums">
                                            {n + 1}
                                        </span>
                                        <span className="min-w-0 pt-px">
                                            <HelpText text={item} />
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        );
                    case 'list':
                        return (
                            <ul key={i} className="space-y-2 pl-1">
                                {block.items.map((item, n) => (
                                    <li key={n} className="flex gap-3">
                                        <span
                                            aria-hidden
                                            className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-white/35"
                                        />
                                        <span className="min-w-0">
                                            <HelpText text={item} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        );
                    case 'tip':
                    case 'note':
                        return (
                            <aside
                                key={i}
                                className={cn(
                                    'flex gap-3 rounded-xl px-4 py-3 text-[14px]',
                                    block.type === 'tip'
                                        ? 'bg-primary/[0.08] text-white/85'
                                        : 'bg-amber-300/[0.07] text-amber-100/90',
                                )}
                            >
                                {block.type === 'tip' ? (
                                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                                ) : (
                                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                                )}
                                <p className="min-w-0">
                                    <span className="sr-only">
                                        {block.type === 'tip'
                                            ? tr('Порада')
                                            : tr('Зверніть увагу')}
                                        :{' '}
                                    </span>
                                    <HelpText text={block.text} />
                                </p>
                            </aside>
                        );
                    default:
                        return (
                            <p key={i}>
                                <HelpText text={block.text} />
                            </p>
                        );
                }
            })}
        </div>
    );
}

/** Рядок-посилання на статтю або розділ у плоскому списку. */
export function HelpRow({
    href,
    title,
    summary,
    meta,
    icon,
}: {
    href: string;
    title: string;
    summary?: string;
    meta?: string;
    icon?: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="gc-row flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.035]"
        >
            {icon}
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-white">
                    {title}
                </span>
                {summary && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-white/50">
                        {summary}
                    </span>
                )}
            </span>
            {meta && (
                <span className="shrink-0 text-xs text-white/40 tabular-nums">
                    {meta}
                </span>
            )}
            <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-white/30"
            />
        </Link>
    );
}

/** «Не знайшли відповідь?» — відгук адмінам (увійшли) або контакти. */
export function HelpContact({ onFeedback }: { onFeedback?: () => void }) {
    const user = usePage().props.auth.user;

    return (
        <section className="gc-group mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70">
                <Info className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-white">
                    {tr('Не знайшли відповідь?')}
                </h2>
                <p className="mt-0.5 text-[13px] text-white/50">
                    {user
                        ? tr(
                              'Напишіть адміністраторам — ідея, помилка чи питання.',
                          )
                        : tr(
                              'Напишіть нам — контакти є на сторінці «Контакти».',
                          )}
                </p>
            </div>
            {user && onFeedback ? (
                <button
                    type="button"
                    onClick={onFeedback}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                    {tr('Відгук адмінам')}
                </button>
            ) : (
                <Link
                    href="/contacts"
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                    {tr('Контакти')}
                </Link>
            )}
        </section>
    );
}

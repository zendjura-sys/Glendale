import { Head } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { VerifiedBadge } from '@/components/gc/verified-badge';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

/** Публічна сторінка посилань /l/нік — легка, без макета сайту. */
export default function BioLinks({
    profile,
    links,
}: {
    profile: UserCard & { about: string | null; cover_url: string | null };
    links: { title: string; host: string; href: string }[];
}) {
    return (
        <>
            <Head title={profile.name} />
            <div className="min-h-dvh bg-[radial-gradient(120%_80%_at_50%_0%,rgba(99,102,241,0.35),transparent_60%),#070b18] px-4 py-12">
                <main className="mx-auto flex max-w-md flex-col items-center text-center">
                    <UserAvatar user={profile} size="xl" showOnline={false} />
                    <h1 className="mt-4 flex items-center gap-1.5 font-display text-2xl font-semibold text-white">
                        {profile.name}
                        {profile.is_verified && (
                            <VerifiedBadge
                                kind={profile.verified_kind}
                                className="size-5"
                            />
                        )}
                    </h1>
                    <p className="text-sm text-white/50">@{profile.username}</p>
                    {profile.about && (
                        <p className="mt-3 text-sm whitespace-pre-line text-white/70">
                            {profile.about}
                        </p>
                    )}
                    <ul className="mt-8 w-full space-y-3">
                        {links.map((link) => (
                            <li key={link.href}>
                                <a
                                    href={link.href}
                                    rel="noopener nofollow"
                                    className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-5 py-4 text-left backdrop-blur-xl transition hover:bg-white/[0.14]"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-white">
                                            {link.title}
                                        </span>
                                        <span className="block truncate text-xs text-white/45">
                                            {link.host}
                                        </span>
                                    </span>
                                    <ExternalLink className="size-4 shrink-0 text-white/40" />
                                </a>
                            </li>
                        ))}
                    </ul>
                    <a
                        href={`/${profile.username}`}
                        className="mt-10 text-xs text-white/40 hover:text-white"
                    >
                        {tr('Сторінка на GameCon')}
                    </a>
                </main>
            </div>
        </>
    );
}

import { Head, Link } from '@inertiajs/react';
import { UserAvatar } from '@/components/gc/user-avatar';
import type { UserCard } from '@/types';
import { tr } from '@/lib/i18n';

export default function ProfileCard({
    profile,
    url,
    qr,
}: {
    profile: UserCard;
    url: string;
    qr: string;
}) {
    return (
        <>
            <Head title={profile.name} />
            <div className="mx-auto max-w-sm">
                <section className="rounded-2xl bg-white px-6 py-8 text-center text-zinc-900 shadow-2xl">
                    <div className="mx-auto w-fit">
                        <UserAvatar user={profile} size="xl" />
                    </div>
                    <h1 className="mt-4 font-display text-2xl font-bold">
                        {profile.name}
                    </h1>
                    <p className="text-sm text-zinc-500">@{profile.username}</p>
                    <div
                        className="mx-auto mt-5 w-fit [&_svg]:h-auto [&_svg]:w-52"
                        dangerouslySetInnerHTML={{ __html: qr }}
                    />
                    <p className="mt-4 text-xs break-all text-zinc-500">
                        {url}
                    </p>
                </section>
                <p className="mt-4 text-center">
                    <Link
                        href={`/${profile.username}`}
                        className="text-sm text-white/60 hover:text-white"
                    >
                        {tr('Відкрити профіль')}
                    </Link>
                </p>
            </div>
        </>
    );
}

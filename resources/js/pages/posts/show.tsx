import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { PostCard } from '@/components/gc/post-card';
import type { PostItem } from '@/types';
import { tr } from '@/lib/i18n';

export default function PostShow({ post }: { post: PostItem }) {
    return (
        <>
            <Head title={tr('Запис {name}', { name: post.author.name })} />
            <div className="mx-auto max-w-[680px] space-y-4">
                <Link
                    href={`/${post.author.username}`}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> {tr('До сторінки')}{' '}
                    {post.author.first_name}
                </Link>
                <PostCard post={post} expanded />
            </div>
        </>
    );
}

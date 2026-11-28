import { Head } from '@inertiajs/react';
import { MessagesSquare } from 'lucide-react';
import { Discussions } from '@/components/discussions/discussions';
import { tr } from '@/lib/i18n';

/** «Обговорення»: загальний розділ — кіно, серіали, аніме, ігри, музика, техніка й усе інше. */
export default function DiscussionsPage() {
    return (
        <>
            <Head title={tr('Обговорення')} />
            <div className="mx-auto max-w-4xl space-y-3.5">
                <section className="gc-solid rounded-2xl p-4">
                    <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                        <MessagesSquare className="size-6 text-sky-400" />{' '}
                        {tr('Обговорення')}
                    </h1>
                    <p className="mt-1 text-sm text-white/60">
                        {tr(
                            'Фільми, серіали, аніме, ігри, сервери, музика — питайте, сперечайтесь, радьте.',
                        )}
                    </p>
                </section>
                <Discussions />
            </div>
        </>
    );
}

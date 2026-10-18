import { Head } from '@inertiajs/react';
import { Snowflake } from 'lucide-react';
import { EmptyState } from '@/components/gc/widget';
import { tr } from '@/lib/i18n';

export default function FrozenProfile({ name }: { name: string }) {
    return (
        <>
            <Head title={name} />
            <div className="mx-auto max-w-xl pt-6">
                <EmptyState
                    icon={Snowflake}
                    title={tr('Сторінку заморожено')}
                    text={tr(
                        '{name}: акаунт тимчасово заморожено. Сторінка з’явиться знову, коли власник повернеться.',
                        { name },
                    )}
                />
            </div>
        </>
    );
}

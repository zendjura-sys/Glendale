import { Head, useForm } from '@inertiajs/react';
import { Send } from 'lucide-react';
import type { FormEvent } from 'react';
import { PageHeader } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Audience = 'all' | 'plus' | 'app' | 'staff';

type Broadcast = {
    id: number;
    title: string;
    body: string;
    url: string | null;
    audience: Audience;
    sent_count: number;
    finished: boolean;
    by: string | null;
    created_at: string;
};

type Props = {
    broadcasts: Broadcast[];
    audiences: Record<Audience, number>;
};

function audienceLabel(a: Audience): string {
    return {
        all: tr('Усім'),
        plus: tr('Власникам GameCon+'),
        app: tr('Користувачам застосунку'),
        staff: tr('Команді'),
    }[a];
}

/** Розсилки від команди: сповіщення в дзвіночок і push обраній аудиторії. */
export default function AdminBroadcasts({ broadcasts, audiences }: Props) {
    const form = useForm<{
        title: string;
        body: string;
        url: string;
        audience: Audience;
    }>({ title: '', body: '', url: '', audience: 'all' });

    const send = (e: FormEvent) => {
        e.preventDefault();

        if (
            !confirm(
                tr('Надіслати сповіщення {count} людям?', {
                    count: audiences[form.data.audience],
                }),
            )
        ) {
            return;
        }

        form.post('/admin/broadcasts', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title={tr('Розсилки — Адмін-панель')} />
            <PageHeader
                title={tr('Розсилки')}
                description={tr(
                    'Сповіщення від команди GameCon у дзвіночок і push. Люди з вимкненими новинами сайту його не отримають.',
                )}
            />

            <form
                onSubmit={send}
                className="gc-solid mb-5 space-y-3 rounded-2xl p-4"
            >
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(audiences) as Audience[]).map((a) => (
                        <button
                            key={a}
                            type="button"
                            onClick={() => form.setData('audience', a)}
                            className={cn(
                                'h-9 rounded-xl px-3 text-sm transition',
                                form.data.audience === a
                                    ? 'bg-primary text-white'
                                    : 'gc-solid-2 text-white/70 hover:text-white',
                            )}
                        >
                            {audienceLabel(a)} · {audiences[a]}
                        </button>
                    ))}
                </div>
                <div>
                    <Input
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                        placeholder={tr('Заголовок')}
                        maxLength={80}
                        className="h-10"
                    />
                    <InputError message={form.errors.title} className="mt-1" />
                </div>
                <div>
                    <textarea
                        value={form.data.body}
                        onChange={(e) => form.setData('body', e.target.value)}
                        placeholder={tr('Текст сповіщення')}
                        maxLength={500}
                        className="input-glass min-h-24 w-full rounded-xl px-3 py-2 text-sm text-white"
                    />
                    <InputError message={form.errors.body} />
                </div>
                <div>
                    <Input
                        value={form.data.url}
                        onChange={(e) => form.setData('url', e.target.value)}
                        placeholder={tr(
                            'Куди веде (напр. /games чи https://…), необов’язково',
                        )}
                        className="h-10"
                    />
                    <InputError message={form.errors.url} className="mt-1" />
                </div>
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        !form.data.title.trim() ||
                        !form.data.body.trim()
                    }
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Send className="size-4" /> {tr('Надіслати')}
                </button>
            </form>

            <div className="space-y-3">
                {broadcasts.map((b) => (
                    <article key={b.id} className="gc-solid rounded-2xl p-4">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <h3 className="min-w-0 flex-1 font-semibold text-white">
                                {b.title}
                            </h3>
                            <span className="text-xs text-white/45">
                                {audienceLabel(b.audience)} ·{' '}
                                {b.finished
                                    ? tr('отримали {count}', {
                                          count: b.sent_count,
                                      })
                                    : tr('надсилається…')}
                            </span>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-line text-white/75">
                            {b.body}
                        </p>
                        <p className="mt-2 text-xs text-white/35">
                            {formatDate(b.created_at)}
                            {b.by ? ` · ${b.by}` : ''}
                            {b.url ? ` · ${b.url}` : ''}
                        </p>
                    </article>
                ))}
                {broadcasts.length === 0 && (
                    <p className="gc-solid rounded-2xl px-6 py-10 text-center text-sm text-white/40">
                        {tr('Розсилок ще не було.')}
                    </p>
                )}
            </div>
        </>
    );
}

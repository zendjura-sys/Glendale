import { Head, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    Copy,
    ExternalLink,
    Plus,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SettingsCard } from '@/layouts/settings/layout';
import { tr } from '@/lib/i18n';

type Link = { title: string; url: string; clicks?: number };

const field =
    'input-glass h-10 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/30 focus:outline-none';

/** Налаштування → «Сторінка посилань»: до 12 посилань для /l/нік. */
export default function LinksSettings({
    links,
    url,
}: {
    links: Link[];
    url: string;
}) {
    const form = useForm<{ links: Link[] }>({
        links: links.length ? links : [{ title: '', url: '' }],
    });
    const set = (i: number, patch: Partial<Link>) =>
        form.setData(
            'links',
            form.data.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
        );
    const move = (i: number, dir: -1 | 1) => {
        const next = [...form.data.links];
        [next[i], next[i + dir]] = [next[i + dir], next[i]];
        form.setData('links', next);
    };

    return (
        <>
            <Head title={tr('Сторінка посилань')} />
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.transform((d) => ({
                        links: d.links
                            .filter((l) => l.title.trim() && l.url.trim())
                            .map(({ title, url }) => ({ title, url })),
                    }));
                    form.put('/settings/links', { preserveScroll: true });
                }}
            >
                <SettingsCard
                    title={tr('Сторінка посилань')}
                    description={tr(
                        'Одна адреса для біо в Instagram, TikTok чи Twitch — з усіма вашими посиланнями.',
                    )}
                >
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-sm">
                        <span className="min-w-0 flex-1 truncate text-white/80">
                            {url}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                void navigator.clipboard?.writeText(url);
                                toast.success(tr('Скопійовано'));
                            }}
                            aria-label={tr('Скопіювати')}
                            className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.08] hover:text-white"
                        >
                            <Copy className="size-4" />
                        </button>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener"
                            aria-label={tr('Відкрити')}
                            className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.08] hover:text-white"
                        >
                            <ExternalLink className="size-4" />
                        </a>
                    </div>
                    <div className="space-y-2">
                        {form.data.links.map((link, i) => (
                            <div
                                key={i}
                                className="grid gap-2 rounded-xl bg-white/[0.03] p-2 sm:grid-cols-[1fr_1.4fr_auto]"
                            >
                                <input
                                    value={link.title}
                                    onChange={(e) =>
                                        set(i, { title: e.target.value })
                                    }
                                    placeholder={tr('Назва: Мій Twitch')}
                                    maxLength={60}
                                    className={field}
                                />
                                <input
                                    type="url"
                                    value={link.url}
                                    onChange={(e) =>
                                        set(i, { url: e.target.value })
                                    }
                                    placeholder="https://"
                                    className={field}
                                />
                                <div className="flex items-center gap-1">
                                    {link.clicks !== undefined && (
                                        <span
                                            className="px-1 text-xs text-white/40 tabular-nums"
                                            title={tr('Переходів')}
                                        >
                                            {link.clicks}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        disabled={i === 0}
                                        onClick={() => move(i, -1)}
                                        aria-label={tr('Вище')}
                                        className="flex size-9 items-center justify-center rounded-lg text-white/50 hover:text-white disabled:opacity-30"
                                    >
                                        <ArrowUp className="size-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            i === form.data.links.length - 1
                                        }
                                        onClick={() => move(i, 1)}
                                        aria-label={tr('Нижче')}
                                        className="flex size-9 items-center justify-center rounded-lg text-white/50 hover:text-white disabled:opacity-30"
                                    >
                                        <ArrowDown className="size-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            form.setData(
                                                'links',
                                                form.data.links.filter(
                                                    (_, j) => j !== i,
                                                ),
                                            )
                                        }
                                        aria-label={tr('Видалити')}
                                        className="flex size-9 items-center justify-center rounded-lg text-white/50 hover:text-rose-300"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {Object.keys(form.errors).length > 0 && (
                        <p className="mt-2 text-xs text-rose-300">
                            {tr(
                                'Перевірте посилання: назва до 60 символів, адреса — з https://',
                            )}
                        </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                        {form.data.links.length < 12 ? (
                            <button
                                type="button"
                                onClick={() =>
                                    form.setData('links', [
                                        ...form.data.links,
                                        { title: '', url: '' },
                                    ])
                                }
                                className="inline-flex items-center gap-1.5 text-sm text-gc-lilac-300 hover:text-white"
                            >
                                <Plus className="size-4" />
                                {tr('Ще посилання')}
                            </button>
                        ) : (
                            <span />
                        )}
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Зберегти')}
                        </button>
                    </div>
                </SettingsCard>
            </form>
        </>
    );
}

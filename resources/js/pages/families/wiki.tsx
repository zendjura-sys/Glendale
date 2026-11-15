import { Link, router, useForm } from '@inertiajs/react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FamilyShell } from '@/components/families/family-shell';
import {
    Empty,
    Panel,
    btnGhost,
    btnPrimary,
    textareaClass,
} from '@/components/families/ui';
import { inputClass } from '@/components/servers/server-form';
import { timeAgo } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { FamilyShellProps, UserCard } from '@/types';

type Page = {
    slug: string;
    title: string;
    body: string | null;
    updated_at: string | null;
    editor: UserCard | null;
};

type Props = FamilyShellProps & {
    pages: { slug: string; title: string }[];
    page: Page | null;
    can_edit: boolean;
};

/** Вікі сім’ї: гайди й корисне для учасників; редагують керівники. */
export default function FamilyWiki(props: Props) {
    const { family, pages, page, can_edit: canEdit } = props;
    const [editing, setEditing] = useState<Page | 'new' | null>(null);
    const base = `/f/${family.slug}/wiki`;

    return (
        <FamilyShell {...props} title={tr('Вікі')}>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <Panel
                    title={tr('Сторінки')}
                    icon={BookOpen}
                    actions={
                        canEdit && (
                            <button
                                type="button"
                                onClick={() => setEditing('new')}
                                aria-label={tr('Нова сторінка')}
                                className="rounded-lg p-1.5 text-white/60 hover:bg-white/[0.06] hover:text-white"
                                data-wiki-new
                            >
                                <Plus className="size-4" />
                            </button>
                        )
                    }
                >
                    <nav className="space-y-1" data-wiki-nav>
                        {pages.map((p) => (
                            <Link
                                key={p.slug}
                                href={`${base}/${p.slug}`}
                                className={cn(
                                    'block truncate rounded-lg px-2.5 py-2 text-sm transition',
                                    page?.slug === p.slug
                                        ? 'bg-primary/15 text-white'
                                        : 'text-white/65 hover:bg-white/[0.05] hover:text-white',
                                )}
                            >
                                {p.title}
                            </Link>
                        ))}
                        {pages.length === 0 && (
                            <p className="px-1 text-xs text-white/40">
                                {tr('Поки порожньо')}
                            </p>
                        )}
                    </nav>
                </Panel>
                <Panel
                    title={page?.title ?? tr('Вікі сім’ї')}
                    icon={BookOpen}
                    actions={
                        canEdit &&
                        page && (
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setEditing(page)}
                                    aria-label={tr('Редагувати')}
                                    className="rounded-lg p-1.5 text-white/60 hover:bg-white/[0.06] hover:text-white"
                                >
                                    <Pencil className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        confirm(tr('Видалити сторінку?')) &&
                                        router.delete(`${base}/${page.slug}`)
                                    }
                                    aria-label={tr('Видалити')}
                                    className="rounded-lg p-1.5 text-white/60 hover:bg-red-500/10 hover:text-red-400"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        )
                    }
                >
                    {editing ? (
                        <WikiEditor
                            page={editing === 'new' ? null : editing}
                            action={base}
                            onDone={() => setEditing(null)}
                        />
                    ) : page ? (
                        <article data-wiki-page>
                            <div className="text-sm leading-relaxed whitespace-pre-line text-white/85">
                                {page.body || tr('Сторінка порожня.')}
                            </div>
                            {page.updated_at && (
                                <p className="mt-4 text-xs text-white/40">
                                    {tr('Оновлено {time}', {
                                        time: timeAgo(page.updated_at),
                                    })}
                                    {page.editor
                                        ? ` · ${page.editor.name}`
                                        : ''}
                                </p>
                            )}
                        </article>
                    ) : (
                        <Empty
                            icon={BookOpen}
                            text={tr(
                                'Тут будуть гайди сім’ї: як подавати звіти, правила складу, корисні посилання.',
                            )}
                        />
                    )}
                </Panel>
            </div>
        </FamilyShell>
    );
}

function WikiEditor({
    page,
    action,
    onDone,
}: {
    page: Page | null;
    action: string;
    onDone: () => void;
}) {
    const form = useForm({
        slug: page?.slug ?? '',
        title: page?.title ?? '',
        body: page?.body ?? '',
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                form.post(action, { onSuccess: onDone });
            }}
            className="space-y-3"
        >
            <input
                value={form.data.title}
                onChange={(e) => form.setData('title', e.target.value)}
                placeholder={tr('Назва сторінки')}
                className={inputClass}
                maxLength={120}
                required
            />
            <textarea
                value={form.data.body}
                onChange={(e) => form.setData('body', e.target.value)}
                rows={12}
                placeholder={tr('Текст сторінки')}
                className={textareaClass}
            />
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={form.processing}
                    className={btnPrimary}
                >
                    {tr('Зберегти')}
                </button>
                <button type="button" onClick={onDone} className={btnGhost}>
                    {tr('Скасувати')}
                </button>
            </div>
        </form>
    );
}

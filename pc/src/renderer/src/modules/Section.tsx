import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { NotchBadge, NotchedCard } from '@/components/NotchedCard';
import { Avatar, Empty } from '@/components/ui';
import { useLive } from '@/lib/api';
import { useNav } from '@/lib/nav';
import { hasPage } from '@/pages';

type Row = { id: string; title: string; subtitle: string | null; image: string | null; href: string | null };

const TITLE = ['name', 'title', 'display_name', 'label'];
const SUBTITLE = ['subtitle', 'description', 'excerpt', 'status_text', 'server', 'artist', 'genre', 'tag', 'about'];
const IMAGE = ['avatar_url', 'cover_url', 'cover', 'poster', 'poster_url', 'logo_url', 'icon_url', 'image_url', 'thumb_url', 'url'];
const HREF = ['href', 'url', 'link'];

/** Перший список об'єктів у відповіді API (data, items, families, …), хоч де він лежить. */
function findList(value: unknown, depth = 0): Record<string, unknown>[] {
    if (depth > 3 || !value || typeof value !== 'object') return [];
    if (Array.isArray(value)) return value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v));
    const obj = value as Record<string, unknown>;
    for (const key of ['data', 'items', ...Object.keys(obj)]) {
        const list = findList(obj[key], depth + 1);
        if (list.length && TITLE.some((t) => typeof list[0][t] === 'string')) return list;
    }
    return [];
}

function pick(item: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = item[k];
        if (typeof v === 'string' && v.trim()) return v;
        if (v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string') return (v as { name: string }).name;
    }
    return null;
}

/**
 * Модуль розділу GameCon (сім'ї, спільноти, клани, сервери, ігри, музика, кіно, події, завдання…):
 * живий список із API розділу. Розділ, вимкнений у налаштуваннях людини чи режимі, сюди не потрапляє.
 */
export function SectionModule({ title, subtitle, endpoint, webPath, header, glow = 'blue' }: { title: string; subtitle?: string; endpoint: string; webPath: string; header?: ReactNode; glow?: 'cyan' | 'violet' | 'blue' }) {
    const { data, error } = useLive<unknown>(endpoint, 60_000, [endpoint]);
    const rows: Row[] = findList(data).map((item, i) => ({
        id: String(item.id ?? item.slug ?? i),
        title: pick(item, TITLE) ?? '—',
        subtitle: pick(item, SUBTITLE),
        image: (() => {
            const img = pick(item, IMAGE);
            return img && /\.(png|jpe?g|webp|gif|avif)|\/storage\/|googleusercontent|steam|tmdb|img/i.test(img) ? img : null;
        })(),
        href: pick(item, HREF),
    }));
    const nav = useNav();
    // Лише всередині програми: є нативна сторінка — відкриваємо її, сайт не відкриваємо ніколи.
    const open = (href: string | null): void => {
        const path = href && !href.startsWith('http') ? href : null;
        if (hasPage(path)) nav.go(path);
        else if (hasPage(webPath)) nav.go(webPath);
    };
    return (
        <NotchedCard title={title} subtitle={subtitle} glow={glow} header={header} badge={<NotchBadge tone={rows.length ? 'cyan' : 'muted'}>{rows.length}</NotchBadge>} badgeWidth={44}>
            {rows.length === 0 ? <Empty>{error ?? (data ? 'Тут поки порожньо.' : 'Завантажуємо…')}</Empty> : null}
            <ul className="space-y-1">
                {rows.slice(0, 40).map((r) => (
                    <li key={r.id}>
                        <button type="button" onClick={() => open(r.href)} className="no-drag group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/5">
                            {r.image ? <img src={r.image} alt="" draggable={false} className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <Avatar user={{ name: r.title }} size={36} />}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{r.title}</span>
                                {r.subtitle && <span className="block truncate text-xs text-white/45">{r.subtitle}</span>}
                            </span>
                            <ExternalLink size={13} className="shrink-0 text-white/0 group-hover:text-white/40" />
                        </button>
                    </li>
                ))}
            </ul>
        </NotchedCard>
    );
}

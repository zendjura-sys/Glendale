import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

/**
 * Скелетони «Arctic Glass»: напівпрозорі скляні заглушки з ледяним бликом (.skeleton у app.css)
 * замість порожнього екрана чи спінера, поки вантажаться дані.
 */

/** Один брусок-заглушка. */
export function Sk({ className }: { className?: string }) {
    return (
        <span aria-hidden className={cn('skeleton rounded-md', className)} />
    );
}

function times(count: number) {
    return Array.from({ length: count }, (_, i) => i);
}

/** Рядок «аватар + два рядки тексту» — люди, сповіщення, бесіди, учасники. */
export function RowSkeleton({
    avatar = 'circle',
    action = false,
}: {
    avatar?: 'circle' | 'square' | 'none';
    action?: boolean;
}) {
    return (
        <div className="flex items-center gap-3">
            {avatar !== 'none' && (
                <Sk
                    className={cn(
                        'size-11 shrink-0',
                        avatar === 'circle' ? 'rounded-full' : 'rounded-xl',
                    )}
                />
            )}
            <span className="min-w-0 flex-1 space-y-2">
                <Sk className="h-3.5 w-2/5" />
                <Sk className="h-3 w-3/5" />
            </span>
            {action && <Sk className="h-8 w-20 shrink-0 rounded-xl" />}
        </div>
    );
}

export function ListSkeleton({
    rows = 6,
    avatar = 'circle',
    action = false,
    card = true,
}: {
    rows?: number;
    avatar?: 'circle' | 'square' | 'none';
    action?: boolean;
    card?: boolean;
}) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className={cn('space-y-4', card && 'glass rounded-2xl p-4 sm:p-5')}
        >
            {times(rows).map((i) => (
                <RowSkeleton key={i} avatar={avatar} action={action} />
            ))}
        </div>
    );
}

/** Запис стрічки: автор, текст, медіа, дії. */
export function PostSkeleton({ card = false }: { card?: boolean }) {
    return (
        <div
            className={cn(
                'gc-post space-y-4 px-1 py-5 sm:px-2',
                card && 'glass rounded-2xl px-4 sm:px-5',
            )}
        >
            <div className="flex items-center gap-3">
                <Sk className="size-11 rounded-full" />
                <span className="flex-1 space-y-2">
                    <Sk className="h-3.5 w-40 rounded" />
                    <Sk className="h-3 w-24 rounded" />
                </span>
            </div>
            <Sk className="h-3.5 w-full rounded" />
            <Sk className="h-3.5 w-4/5 rounded" />
            <Sk className="h-56 w-full rounded-[10px]" />
            <div className="flex gap-2">
                <Sk className="h-8 w-16 rounded-full" />
                <Sk className="h-8 w-16 rounded-full" />
                <Sk className="h-8 w-16 rounded-full" />
            </div>
        </div>
    );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-4"
        >
            {times(count).map((i) => (
                <PostSkeleton key={i} card />
            ))}
        </div>
    );
}

/** Сітка карток з обкладинками: ігри, аніме й кіно (постер), альбоми й фото (квадрат), спільноти (широкі). */
export function GridSkeleton({
    count = 12,
    shape = 'poster',
}: {
    count?: number;
    shape?: 'poster' | 'square' | 'wide';
}) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className={cn(
                'grid gap-3 sm:gap-4',
                shape === 'wide'
                    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
            )}
        >
            {times(count).map((i) => (
                <div key={i} className="glass space-y-3 rounded-2xl p-2.5">
                    <Sk
                        className={cn(
                            'w-full rounded-xl',
                            shape === 'poster' && 'aspect-[3/4]',
                            shape === 'square' && 'aspect-square',
                            shape === 'wide' && 'aspect-[16/7]',
                        )}
                    />
                    <span className="block space-y-2 px-1 pb-1">
                        <Sk className="h-3.5 w-4/5" />
                        <Sk className="h-3 w-1/2" />
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Список серверів: іконка, назва й мапа, онлайн, пінг. */
export function ServerListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-3"
        >
            {times(rows).map((i) => (
                <div
                    key={i}
                    className="glass flex items-center gap-4 rounded-2xl p-4 sm:p-5"
                >
                    <Sk className="size-12 shrink-0 rounded-xl sm:size-14" />
                    <span className="min-w-0 flex-1 space-y-2">
                        <Sk className="h-4 w-1/2" />
                        <Sk className="h-3 w-1/3" />
                        <span className="flex gap-2 pt-1">
                            <Sk className="h-5 w-14 rounded-full" />
                            <Sk className="h-5 w-20 rounded-full" />
                        </span>
                    </span>
                    <span className="hidden w-24 space-y-2 sm:block">
                        <Sk className="ml-auto h-4 w-16" />
                        <Sk className="ml-auto h-2 w-24 rounded-full" />
                    </span>
                    <Sk className="h-9 w-24 shrink-0 rounded-xl" />
                </div>
            ))}
        </div>
    );
}

/** Профіль чи спільнота: обкладинка, аватар, ім’я, вкладки, записи. */
export function ProfileSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-4"
        >
            <div className="glass overflow-hidden rounded-2xl">
                <Sk className="h-40 w-full rounded-none sm:h-52" />
                <div className="flex items-end gap-4 px-4 pb-5 sm:px-6">
                    <Sk className="-mt-12 size-24 shrink-0 rounded-full ring-4 ring-black/20" />
                    <span className="flex-1 space-y-2 pb-1">
                        <Sk className="h-5 w-48" />
                        <Sk className="h-3.5 w-32" />
                    </span>
                    <Sk className="hidden h-10 w-32 rounded-xl sm:block" />
                </div>
            </div>
            <div className="flex gap-2">
                {times(4).map((i) => (
                    <Sk key={i} className="h-9 w-24 rounded-xl" />
                ))}
            </div>
            <PostSkeleton card />
        </div>
    );
}

/** Сторінка гри, фільму чи статті: велика обкладинка, заголовок, абзаци. */
export function DetailSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-4"
        >
            <div className="glass grid gap-5 rounded-2xl p-4 sm:grid-cols-[12rem_1fr] sm:p-6">
                <Sk className="aspect-[3/4] w-full max-w-48 rounded-xl" />
                <span className="space-y-3">
                    <Sk className="h-7 w-2/3" />
                    <Sk className="h-4 w-1/3" />
                    <span className="flex gap-2 pt-2">
                        <Sk className="h-6 w-16 rounded-full" />
                        <Sk className="h-6 w-20 rounded-full" />
                        <Sk className="h-6 w-14 rounded-full" />
                    </span>
                    <Sk className="mt-4 h-3.5 w-full" />
                    <Sk className="h-3.5 w-11/12" />
                    <Sk className="h-3.5 w-4/5" />
                    <Sk className="mt-2 h-10 w-40 rounded-xl" />
                </span>
            </div>
            <GridSkeleton count={5} />
        </div>
    );
}

/** Месенджер: список бесід і бульбашки. */
export function ChatSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="grid h-[calc(100dvh-9rem)] gap-4 md:grid-cols-[20rem_1fr]"
        >
            <div className="glass hidden space-y-5 rounded-2xl p-4 md:block">
                <Sk className="h-10 w-full rounded-xl" />
                {times(7).map((i) => (
                    <RowSkeleton key={i} />
                ))}
            </div>
            <div className="glass flex flex-col rounded-2xl p-4">
                <RowSkeleton />
                <div className="mt-6 flex-1 space-y-4">
                    {times(6).map((i) => (
                        <div
                            key={i}
                            className={cn(
                                'flex',
                                i % 3 === 2 ? 'justify-end' : 'justify-start',
                            )}
                        >
                            <Sk
                                className={cn(
                                    'h-12 rounded-2xl',
                                    ['w-2/5', 'w-3/5', 'w-1/3'][i % 3],
                                )}
                            />
                        </div>
                    ))}
                </div>
                <Sk className="mt-4 h-12 w-full rounded-2xl" />
            </div>
        </div>
    );
}

/** Таблиця адмінки: картки статистики й рядки. */
export function TableSkeleton({
    rows = 8,
    stats = true,
}: {
    rows?: number;
    stats?: boolean;
}) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-6"
        >
            {stats && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {times(4).map((i) => (
                        <div
                            key={i}
                            className="glass space-y-4 rounded-2xl p-5"
                        >
                            <Sk className="h-3.5 w-1/2" />
                            <Sk className="h-7 w-1/3" />
                        </div>
                    ))}
                </div>
            )}
            <div className="glass space-y-4 rounded-2xl p-4 sm:p-5">
                <Sk className="h-5 w-40" />
                {times(rows).map((i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Sk className="size-9 shrink-0 rounded-full" />
                        <Sk className="h-3.5 flex-1" />
                        <Sk className="hidden h-3.5 w-24 sm:block" />
                        <Sk className="hidden h-3.5 w-16 md:block" />
                        <Sk className="h-8 w-20 rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Заголовок сторінки: назва й підзаголовок. */
export function HeaderSkeleton() {
    return (
        <div className="mb-5 space-y-2.5">
            <Sk className="h-8 w-56 rounded-lg" />
            <Sk className="h-3.5 w-80 max-w-full" />
        </div>
    );
}

export type PageSkeletonKind =
    | 'feed'
    | 'grid'
    | 'square'
    | 'wide'
    | 'servers'
    | 'list'
    | 'profile'
    | 'detail'
    | 'chat'
    | 'table'
    | 'generic';

/** Уся сторінка-заглушка на час переходу. */
export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
    switch (kind) {
        case 'chat':
            return <ChatSkeleton />;
        case 'profile':
            return <ProfileSkeleton />;
        case 'detail':
            return <DetailSkeleton />;
        case 'table':
            return (
                <>
                    <HeaderSkeleton />
                    <TableSkeleton />
                </>
            );
        case 'feed':
            return (
                <div className="mx-auto max-w-2xl">
                    <FeedSkeleton />
                </div>
            );
        case 'grid':
        case 'square':
        case 'wide':
            return (
                <>
                    <HeaderSkeleton />
                    <GridSkeleton
                        shape={kind === 'grid' ? 'poster' : kind}
                        count={kind === 'wide' ? 6 : 10}
                    />
                </>
            );
        case 'servers':
            return (
                <>
                    <HeaderSkeleton />
                    <ServerListSkeleton />
                </>
            );
        case 'list':
            return (
                <>
                    <HeaderSkeleton />
                    <ListSkeleton rows={8} action />
                </>
            );
        default:
            return (
                <>
                    <HeaderSkeleton />
                    <div className="grid gap-4 lg:grid-cols-2">
                        <ListSkeleton rows={4} />
                        <ListSkeleton rows={4} avatar="square" />
                    </div>
                </>
            );
    }
}

/** Який скелетон показати для адреси, куди переходимо. */
export function skeletonFor(path: string): PageSkeletonKind {
    const p = path.replace(/\/+$/, '') || '/';
    const rules: [RegExp, PageSkeletonKind][] = [
        [/^\/admin(\/|$)/, 'table'],
        [/^\/(feed|posts|saved|moments)(\/|$)/, 'feed'],
        [/^\/messages(\/|$)|^\/c\/[^/]+\/channels/, 'chat'],
        [/^\/servers\/compare/, 'table'],
        [/^\/servers\/[^/]+/, 'detail'],
        [/^\/servers(\/|$)/, 'servers'],
        [
            /^\/(games|cinema|anime|releases)\/(?!deals|backlog|my)[^/]+/,
            'detail',
        ],
        [/^\/(games|cinema|anime|releases|characters)(\/|$)/, 'grid'],
        [/^\/(photos|music|stickers)(\/|$)/, 'square'],
        [
            /^\/(communities|clans|events|tournaments|articles|families|quests|season)$/,
            'wide',
        ],
        [/^\/c\/[^/]+$|^\/(clans|families)\/[^/]+$/, 'profile'],
        [/^\/(articles|events|tournaments)\/[^/]+/, 'detail'],
        [/^\/(friends|people|party|notifications|phone|invite)(\/|$)/, 'list'],
        [/^\/(settings|help|legal|plus|developers|start)(\/|$)/, 'generic'],
        // Решта однослівних адрес — профілі (gamecon.online/нік).
        [/^\/[^/]+$/, 'profile'],
    ];

    return rules.find(([re]) => re.test(p))?.[1] ?? 'generic';
}

/** Кілька рядків тексту — підсумок, опис, вміст документа. */
export function TextSkeleton({
    lines = 4,
    className,
}: {
    lines?: number;
    className?: string;
}) {
    const widths = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/4', 'w-5/6'];

    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className={cn('space-y-2.5', className)}
        >
            {times(lines).map((i) => (
                <Sk
                    key={i}
                    className={cn(
                        'h-3.5',
                        i === lines - 1 ? 'w-1/2' : widths[i % widths.length],
                    )}
                />
            ))}
        </div>
    );
}

/** Бульбашки чату — коли догружаються старіші повідомлення. */
export function BubblesSkeleton({ count = 2 }: { count?: number }) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-3 px-4"
        >
            {times(count).map((i) => (
                <div
                    key={i}
                    className={cn(
                        'flex items-end gap-2',
                        i % 2 === 1 && 'justify-end',
                    )}
                >
                    {i % 2 === 0 && <Sk className="size-8 rounded-full" />}
                    <Sk
                        className={cn(
                            'h-11 rounded-2xl',
                            i % 2 ? 'w-1/3' : 'w-2/5',
                        )}
                    />
                </div>
            ))}
        </div>
    );
}

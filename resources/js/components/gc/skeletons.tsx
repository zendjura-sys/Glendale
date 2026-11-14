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
            className={cn(
                'space-y-4',
                card && 'gc-solid rounded-2xl p-4 sm:p-5',
            )}
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
                card && 'gc-solid rounded-2xl px-4 sm:px-5',
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

/**
 * Сторінка «Новини» як вона є: моменти, смуга «серія · готовий грати · завдання», поле «Що нового»,
 * вкладки стрічки й записи, а на широких екранах — права колонка із заявками й контактами.
 */
export function FeedPageSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="flex gap-5"
        >
            <div className="min-w-0 flex-1 space-y-4">
                <div className="gc-solid flex items-center gap-4 rounded-2xl p-4">
                    <span className="grid shrink-0 justify-items-center gap-2">
                        <Sk className="size-16 rounded-2xl" />
                        <Sk className="h-3 w-14 rounded" />
                    </span>
                    {times(4).map((i) => (
                        <span
                            key={i}
                            className="hidden shrink-0 justify-items-center gap-2 sm:grid"
                        >
                            <Sk className="size-16 rounded-full" />
                            <Sk className="h-3 w-12 rounded" />
                        </span>
                    ))}
                </div>
                <div className="gc-solid flex gap-2 rounded-2xl p-2.5">
                    <Sk className="h-11 w-20 shrink-0 rounded-xl" />
                    <Sk className="h-11 flex-1 rounded-xl" />
                    <Sk className="h-11 w-24 shrink-0 rounded-xl sm:w-28" />
                </div>
                <div className="gc-solid flex items-center gap-3 rounded-2xl p-4">
                    <Sk className="size-11 shrink-0 rounded-full" />
                    <Sk className="h-11 flex-1 rounded-xl" />
                    <Sk className="hidden h-11 w-36 shrink-0 rounded-xl sm:block" />
                </div>
                <div className="flex gap-2 overflow-hidden">
                    {times(5).map((i) => (
                        <Sk
                            key={i}
                            className="h-10 w-28 shrink-0 rounded-full"
                        />
                    ))}
                </div>
                {times(2).map((i) => (
                    <PostSkeleton key={i} card />
                ))}
            </div>
            <div className="hidden w-[320px] shrink-0 space-y-4 min-[1920px]:w-[360px] xl:block">
                <Sk className="mx-1 block h-3 w-20 rounded" />
                {times(2).map((i) => (
                    <div key={i} className="gc-solid space-y-3 rounded-2xl p-4">
                        <RowSkeleton />
                        <div className="flex gap-2">
                            <Sk className="h-9 flex-1 rounded-xl" />
                            <Sk className="h-9 flex-1 rounded-xl" />
                        </div>
                    </div>
                ))}
                <Sk className="mx-1 block h-3 w-24 rounded" />
                <ListSkeleton rows={5} />
            </div>
        </div>
    );
}

/** Сітка карток з обкладинками: ігри, аніме й кіно (постер), альбоми й фото (квадрат), спільноти (широкі). */
export function GridSkeleton({
    count = 12,
    shape = 'poster',
}: {
    count?: number;
    shape?: 'poster' | 'square' | 'wide' | 'card';
}) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className={cn(
                'grid gap-3 sm:gap-4',
                shape === 'wide'
                    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                    : shape === 'card'
                      ? 'grid-cols-2 lg:grid-cols-4'
                      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
            )}
        >
            {times(count).map((i) => (
                <div key={i} className="gc-solid space-y-3 rounded-2xl p-2.5">
                    <Sk
                        className={cn(
                            'w-full rounded-xl',
                            shape === 'poster' && 'aspect-[3/4]',
                            shape === 'square' && 'aspect-square',
                            shape === 'wide' && 'aspect-[16/7]',
                            shape === 'card' && 'aspect-[4/3]',
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

/** Список серверів: дві колонки рядків — іконка, назва й мапа, онлайн і адреса. */
export function ServerListSkeleton({ rows = 10 }: { rows?: number }) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="grid gap-x-6 gap-y-5 lg:grid-cols-2"
        >
            {times(rows).map((i) => (
                <div key={i} className="flex items-center gap-3">
                    <Sk className="size-11 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1 space-y-2">
                        <Sk className="h-3.5 w-2/5" />
                        <Sk className="h-3 w-4/5" />
                        <Sk className="h-2.5 w-1/3" />
                    </span>
                    <Sk className="h-9 w-24 shrink-0 rounded-lg" />
                </div>
            ))}
        </div>
    );
}

/** Профіль чи спільнота: висока обкладинка з аватаром та ім’ям на ній, лічильники, вкладки, дві колонки. */
export function ProfileSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-4"
        >
            <div className="gc-solid overflow-hidden rounded-2xl">
                <div className="relative h-60 sm:h-72">
                    <Sk className="absolute inset-0 rounded-none" />
                    <span className="absolute inset-x-4 bottom-4 flex items-end gap-4 sm:inset-x-6">
                        <Sk className="size-24 shrink-0 rounded-full ring-4 ring-black/20 sm:size-28" />
                        <span className="flex-1 space-y-2 pb-2">
                            <Sk className="h-6 w-56 max-w-full" />
                            <Sk className="h-3.5 w-28" />
                        </span>
                        <span className="hidden gap-2 pb-2 sm:flex">
                            <Sk className="h-9 w-28 rounded-xl" />
                            <Sk className="h-9 w-40 rounded-xl" />
                        </span>
                    </span>
                </div>
                <div className="space-y-3 px-4 py-4 sm:px-6">
                    <span className="flex gap-4">
                        {times(4).map((i) => (
                            <Sk key={i} className="h-4 w-20" />
                        ))}
                    </span>
                    <Sk className="h-3.5 w-1/2" />
                    <Sk className="h-3 w-1/3" />
                </div>
            </div>
            <div className="gc-solid grid grid-cols-3 gap-2 rounded-2xl p-1.5">
                {times(3).map((i) => (
                    <Sk key={i} className="h-9 rounded-xl" />
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="hidden space-y-4 lg:block">
                    <div className="gc-solid space-y-3 rounded-2xl p-4">
                        <Sk className="h-4 w-28" />
                        <RowSkeleton avatar="square" />
                    </div>
                    <ListSkeleton rows={3} />
                </div>
                <div className="space-y-4">
                    <div className="gc-solid flex items-center gap-3 rounded-2xl p-4">
                        <Sk className="size-11 shrink-0 rounded-full" />
                        <Sk className="h-11 flex-1 rounded-xl" />
                    </div>
                    <PostSkeleton card />
                </div>
            </div>
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
            <div className="gc-solid grid gap-5 rounded-2xl p-4 sm:grid-cols-[12rem_1fr] sm:p-6">
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
            <div className="gc-solid hidden space-y-5 rounded-2xl p-4 md:block">
                <Sk className="h-10 w-full rounded-xl" />
                {times(7).map((i) => (
                    <RowSkeleton key={i} />
                ))}
            </div>
            <div className="gc-solid flex flex-col rounded-2xl p-4">
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
                            className="gc-solid space-y-4 rounded-2xl p-5"
                        >
                            <Sk className="h-3.5 w-1/2" />
                            <Sk className="h-7 w-1/3" />
                        </div>
                    ))}
                </div>
            )}
            <div className="gc-solid space-y-4 rounded-2xl p-4 sm:p-5">
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
/** Велика картка-шапка розділу: заголовок, опис, фільтри й кнопка праворуч (сервери, ігри, спільноти). */
export function HeroSkeleton({
    stats = false,
    filters = 1,
}: {
    stats?: boolean;
    filters?: number;
}) {
    return (
        <div className="gc-solid mb-5 space-y-4 rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
                <span className="min-w-0 flex-1 space-y-3">
                    <Sk className="h-5 w-28 rounded-lg" />
                    <Sk className="h-9 w-80 max-w-full rounded-lg" />
                    <Sk className="h-3.5 w-[28rem] max-w-full" />
                    <Sk className="h-3.5 w-72 max-w-full" />
                </span>
                {stats ? (
                    <span className="hidden gap-2 sm:flex">
                        {times(3).map((i) => (
                            <Sk key={i} className="h-16 w-24 rounded-xl" />
                        ))}
                    </span>
                ) : (
                    <Sk className="hidden h-11 w-44 rounded-xl sm:block" />
                )}
            </div>
            {times(filters).map((i) => (
                <span key={i} className="flex flex-wrap gap-2">
                    {times(i === 0 ? 5 : 8).map((n) => (
                        <Sk
                            key={n}
                            className={cn(
                                'h-9 rounded-xl',
                                i === 0 ? 'w-28' : 'w-20',
                            )}
                        />
                    ))}
                </span>
            ))}
        </div>
    );
}

/** Каталог людей: смуга вкладок і сітка карток з аватаром по центру (друзі, люди). */
export function PeopleGridSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-4"
        >
            <div className="gc-solid flex gap-2 overflow-hidden rounded-2xl p-2">
                {times(6).map((i) => (
                    <Sk key={i} className="h-9 w-24 shrink-0 rounded-xl" />
                ))}
                <Sk className="ml-auto hidden h-9 w-48 rounded-xl md:block" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {times(count).map((i) => (
                    <div
                        key={i}
                        className="gc-solid flex flex-col items-center gap-3 rounded-2xl p-4"
                    >
                        <Sk className="size-16 rounded-full" />
                        <Sk className="h-3.5 w-3/5" />
                        <Sk className="h-3 w-2/5" />
                        <Sk className="h-8 w-full rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Налаштування: заголовок, меню розділів ліворуч і форма праворуч. */
export function SettingsSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="mx-auto max-w-5xl"
        >
            <HeaderSkeleton />
            <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="gc-solid hidden space-y-4 rounded-2xl p-3 md:block">
                    {times(9).map((i) => (
                        <RowSkeleton key={i} avatar="square" />
                    ))}
                </div>
                <div className="gc-solid space-y-5 rounded-2xl p-5">
                    <Sk className="h-4 w-32" />
                    {times(5).map((i) => (
                        <div
                            key={i}
                            className="grid gap-2 sm:grid-cols-[180px_1fr]"
                        >
                            <Sk className="h-3.5 w-24" />
                            <Sk className="h-10 rounded-xl" />
                        </div>
                    ))}
                    <Sk className="h-24 rounded-xl" />
                    <Sk className="ml-auto h-10 w-36 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

/** Сторінка-довідник по центру: заголовок, опис, пошук чи вкладки, список рядків (довідка, розробникам). */
export function DocSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="mx-auto max-w-4xl space-y-5"
        >
            <span className="block space-y-3">
                <Sk className="h-9 w-56 rounded-lg" />
                <Sk className="h-3.5 w-96 max-w-full" />
            </span>
            <Sk className="block h-11 w-full rounded-xl" />
            <Sk className="block h-5 w-32" />
            <div className="gc-solid divide-y divide-white/[0.06] rounded-2xl px-4">
                {times(7).map((i) => (
                    <span key={i} className="flex items-center gap-3 py-3.5">
                        <Sk className="h-3.5 flex-1" />
                        <Sk className="size-4 shrink-0 rounded" />
                    </span>
                ))}
            </div>
        </div>
    );
}

/** Музика: вкладки розділу, привітання, ряд великих карток-міксів і список треків. */
export function MusicSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="space-y-5"
        >
            <div className="flex gap-2 overflow-hidden">
                {times(6).map((i) => (
                    <Sk key={i} className="h-9 w-24 shrink-0 rounded-xl" />
                ))}
            </div>
            <span className="block space-y-2">
                <Sk className="h-8 w-64 rounded-lg" />
                <Sk className="h-3.5 w-80 max-w-full" />
            </span>
            <Sk className="block h-5 w-40" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {times(4).map((i) => (
                    <Sk key={i} className="aspect-[4/5] w-full rounded-2xl" />
                ))}
            </div>
            <ListSkeleton rows={4} avatar="square" />
        </div>
    );
}

/** Головна кіно: великий слайдер із трьома картками під ним, полиця постерів і права колонка фільтрів. */
export function CinemaHomeSkeleton() {
    return (
        <div
            role="status"
            aria-label={tr('Завантаження')}
            className="flex gap-5"
        >
            <div className="min-w-0 flex-1 space-y-4">
                <div className="gc-solid space-y-4 rounded-2xl p-5">
                    <Sk className="h-4 w-40" />
                    <Sk className="h-10 w-64 max-w-full rounded-lg" />
                    <Sk className="h-3.5 w-3/4" />
                    <Sk className="h-3.5 w-2/3" />
                    <span className="flex gap-2">
                        <Sk className="h-10 w-32 rounded-xl" />
                        <Sk className="h-10 w-28 rounded-xl" />
                    </span>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                        {times(3).map((i) => (
                            <Sk
                                key={i}
                                className="aspect-video w-full rounded-xl"
                            />
                        ))}
                    </div>
                </div>
                <div className="gc-solid space-y-4 rounded-2xl p-4">
                    <span className="flex gap-3">
                        <Sk className="h-6 w-20" />
                        <Sk className="h-6 w-24" />
                    </span>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {times(5).map((i) => (
                            <Sk
                                key={i}
                                className="aspect-[3/4] w-full rounded-xl"
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="hidden w-[300px] shrink-0 space-y-4 xl:block">
                <div className="gc-solid space-y-3 rounded-2xl p-4">
                    {times(6).map((i) => (
                        <span key={i} className="grid grid-cols-2 gap-3">
                            <Sk className="h-3 w-3/4" />
                            <Sk className="h-3 w-2/3" />
                        </span>
                    ))}
                </div>
                <ListSkeleton rows={4} avatar="square" />
            </div>
        </div>
    );
}

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
    | 'posts'
    | 'grid'
    | 'square'
    | 'wide'
    | 'servers'
    | 'list'
    | 'profile'
    | 'detail'
    | 'chat'
    | 'table'
    | 'games'
    | 'cinema'
    | 'people'
    | 'settings'
    | 'doc'
    | 'music'
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
            return <FeedPageSkeleton />;
        case 'posts':
            return (
                <div className="mx-auto max-w-2xl">
                    <FeedSkeleton />
                </div>
            );
        case 'games':
            return (
                <>
                    <HeroSkeleton filters={3} />
                    <GridSkeleton shape="card" count={8} />
                </>
            );
        case 'cinema':
            return <CinemaHomeSkeleton />;
        case 'people':
            return <PeopleGridSkeleton />;
        case 'settings':
            return <SettingsSkeleton />;
        case 'doc':
            return <DocSkeleton />;
        case 'music':
            return <MusicSkeleton />;
        case 'grid':
        case 'square':
            return (
                <>
                    <HeaderSkeleton />
                    <GridSkeleton
                        shape={kind === 'grid' ? 'poster' : 'card'}
                        count={kind === 'grid' ? 10 : 8}
                    />
                </>
            );
        case 'wide':
            return (
                <>
                    <HeroSkeleton filters={2} />
                    <div
                        role="status"
                        aria-label={tr('Завантаження')}
                        className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        {times(9).map((i) => (
                            <RowSkeleton key={i} avatar="square" action />
                        ))}
                    </div>
                </>
            );
        case 'servers':
            return (
                <>
                    <HeroSkeleton stats filters={1} />
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
        [/^\/feed$/, 'feed'],
        [/^\/(feed|posts|saved|moments)(\/|$)/, 'posts'],
        [/^\/messages(\/|$)|^\/c\/[^/]+\/channels/, 'chat'],
        [/^\/servers\/compare/, 'table'],
        [/^\/servers\/[^/]+/, 'detail'],
        [/^\/servers(\/|$)/, 'servers'],
        [/^\/(cinema|anime)$/, 'cinema'],
        [
            /^\/(games|cinema|anime|releases)\/(?!deals|backlog|my)[^/]+/,
            'detail',
        ],
        [/^\/games$/, 'games'],
        [/^\/(cinema|anime|releases|characters|games)(\/|$)/, 'grid'],
        [/^\/music(\/|$)/, 'music'],
        [/^\/(photos|stickers)(\/|$)/, 'square'],
        [
            /^\/(communities|clans|events|tournaments|articles|families|quests|season)$/,
            'wide',
        ],
        [/^\/c\/[^/]+$|^\/(clans|families)\/[^/]+$/, 'profile'],
        [/^\/(articles|events|tournaments)\/[^/]+/, 'detail'],
        [/^\/(friends|people)(\/|$)/, 'people'],
        [/^\/(party|notifications|phone|invite)(\/|$)/, 'list'],
        [/^\/settings(\/|$)/, 'settings'],
        [/^\/(help|legal|developers)(\/|$)/, 'doc'],
        [/^\/(plus|start)(\/|$)/, 'generic'],
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

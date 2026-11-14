import { Monitor, Smartphone } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Ілюстрація розділу довідки: схема екрана GameCon (ПК або телефон) з підсвіченими зонами
 * й номерами, а під нею — легенда «що де й куди натиснути». Не скриншот, а спрощений макет:
 * не застаріває від дрібних змін дизайну.
 */
type Area =
    | 'search'
    | 'nav'
    | 'gamecast'
    | 'bell'
    | 'avatar'
    | 'profile'
    | 'menu'
    | 'app'
    | 'stories'
    | 'streak'
    | 'composer'
    | 'tabs'
    | 'post'
    | 'post-menu'
    | 'requests'
    | 'widgets'
    | 'player'
    | 'footer';

type MobileArea =
    | 'm-header'
    | 'm-search'
    | 'm-content'
    | 'm-tab-feed'
    | 'm-tab-chat'
    | 'm-tab-friends'
    | 'm-tab-menu'
    | 'm-tab-profile';

type Pin = { area: Area; text: string };
type MobilePin = { area: MobileArea; text: string };

const MAPS = (): Record<string, { pc: Pin[]; phone: MobilePin[] }> => ({
    start: {
        pc: [
            {
                area: 'avatar',
                text: tr(
                    'Аватар угорі праворуч — меню: профіль, налаштування, тема, вихід.',
                ),
            },
            {
                area: 'profile',
                text: tr('Картка профілю ліворуч — ваша сторінка й рівень.'),
            },
            {
                area: 'search',
                text: tr('Пошук людей, ігор, кіно й музики (клавіша /).'),
            },
            {
                area: 'menu',
                text: tr(
                    'Головне меню розділів: новини, повідомлення, друзі, спільноти.',
                ),
            },
        ],
        phone: [
            {
                area: 'm-tab-profile',
                text: tr('Профіль і налаштування — остання вкладка внизу.'),
            },
            { area: 'm-search', text: tr('Пошук — значок лупи вгорі.') },
            {
                area: 'm-tab-menu',
                text: tr('«Меню» — усі розділи сайту плитками.'),
            },
        ],
    },
    feed: {
        pc: [
            {
                area: 'composer',
                text: tr(
                    '«Що нового?» — написати запис, додати фото, опитування чи гру.',
                ),
            },
            {
                area: 'tabs',
                text: tr(
                    'Вкладки стрічки: друзі, активність, рекомендації, країна, теми.',
                ),
            },
            {
                area: 'post',
                text: tr(
                    'Під записом — реакції, коментарі, зберегти й поділитись.',
                ),
            },
            {
                area: 'post-menu',
                text: tr('«⋯» на записі — закріпити, змінити, поскаржитись.'),
            },
            {
                area: 'widgets',
                text: tr(
                    'Праворуч — віджети: продовжити, GameCast, музика, кіно, роздачі.',
                ),
            },
        ],
        phone: [
            { area: 'm-tab-feed', text: tr('Стрічка — перша вкладка внизу.') },
            {
                area: 'm-content',
                text: tr('Поле «Що нового?» вгорі стрічки, вкладки — під ним.'),
            },
        ],
    },
    friends: {
        pc: [
            {
                area: 'menu',
                text: tr(
                    '«Повідомлення» й «Друзі» — у меню ліворуч (лічильник — непрочитане).',
                ),
            },
            {
                area: 'requests',
                text: tr(
                    'Заявки в друзі й контакти — у правій колонці стрічки.',
                ),
            },
            {
                area: 'bell',
                text: tr('Дзвіночок — нові заявки, відповіді, дзвінки.'),
            },
        ],
        phone: [
            {
                area: 'm-tab-chat',
                text: tr('Повідомлення — друга вкладка внизу.'),
            },
            {
                area: 'm-tab-friends',
                text: tr('Друзі й заявки — третя вкладка.'),
            },
        ],
    },
    groups: {
        pc: [
            {
                area: 'menu',
                text: tr('«Спільноти» в меню ліворуч — ваші групи й каталог.'),
            },
            {
                area: 'nav',
                text: tr('Значок щита в шапці — швидкий перехід до спільнот.'),
            },
        ],
        phone: [{ area: 'm-tab-menu', text: tr('Меню → «Спільноти».') }],
    },
    servers: {
        pc: [
            {
                area: 'nav',
                text: tr('Значок серверів у шапці — каталог GTA-серверів.'),
            },
            {
                area: 'menu',
                text: tr('«Сім’ї» й «Сервери GTA» — у меню ліворуч.'),
            },
            {
                area: 'widgets',
                text: tr('Топ серверів за онлайном — у правій колонці.'),
            },
        ],
        phone: [
            {
                area: 'm-tab-menu',
                text: tr('Меню → «Сервери GTA» або «Сім’ї».'),
            },
        ],
    },
    cinema: {
        pc: [
            {
                area: 'nav',
                text: tr(
                    'Значок кіно в шапці — каталог, тайтл тижня, добірки, розклад.',
                ),
            },
            {
                area: 'widgets',
                text: tr('«Що подивитися» праворуч — підбірка під ваш смак.'),
            },
            {
                area: 'tabs',
                text: tr(
                    '«Продовжити» над стрічкою — серія, на якій ви зупинились.',
                ),
            },
        ],
        phone: [{ area: 'm-tab-menu', text: tr('Меню → «Кіно».') }],
    },
    music: {
        pc: [
            {
                area: 'nav',
                text: tr('Ноти в шапці — музика: головна, радіо, медіатека.'),
            },
            {
                area: 'player',
                text: tr(
                    'Плеєр унизу: пауза, черга, текст пісні; натисніть — на весь екран.',
                ),
            },
            {
                area: 'widgets',
                text: tr('Віджет музики праворуч — продовжити слухати.'),
            },
        ],
        phone: [
            { area: 'm-tab-menu', text: tr('Меню → «Музика».') },
            {
                area: 'm-content',
                text: tr('Міні-плеєр — над нижніми вкладками.'),
            },
        ],
    },
    moments: {
        pc: [
            {
                area: 'stories',
                text: tr(
                    'Моменти — рядок кружечків угорі стрічки; «+» — додати свій.',
                ),
            },
        ],
        phone: [{ area: 'm-content', text: tr('Моменти — угорі стрічки.') }],
    },
    quests: {
        pc: [
            {
                area: 'streak',
                text: tr(
                    'Смуга під моментами: серія днів, «Я готовий грати» й завдання дня (XP).',
                ),
            },
            {
                area: 'profile',
                text: tr('Рівень і серія — у картці профілю ліворуч.'),
            },
        ],
        phone: [
            {
                area: 'm-content',
                text: tr('Серія й завдання — смуга вгорі стрічки.'),
            },
        ],
    },
    plus: {
        pc: [
            {
                area: 'avatar',
                text: tr(
                    'Меню аватарки → «GameCon+» — тарифи й подарунок другу.',
                ),
            },
            {
                area: 'profile',
                text: tr('Бейдж GameCon+ з’являється біля імені.'),
            },
        ],
        phone: [{ area: 'm-tab-profile', text: tr('Профіль → «GameCon+».') }],
    },
    app: {
        pc: [
            {
                area: 'app',
                text: tr(
                    'Картка «Офіційний застосунок» ліворуч — посилання на Google Play.',
                ),
            },
        ],
        phone: [{ area: 'm-tab-menu', text: tr('Меню → «Застосунок».') }],
    },
    safety: {
        pc: [
            {
                area: 'post-menu',
                text: tr(
                    '«⋯» на записі чи в профілі — поскаржитись або заблокувати.',
                ),
            },
            {
                area: 'avatar',
                text: tr(
                    'Налаштування → «Безпека» й «Акаунт»: пароль, 2FA, пристрої.',
                ),
            },
        ],
        phone: [
            {
                area: 'm-tab-profile',
                text: tr('Профіль → Налаштування → «Безпека».'),
            },
        ],
    },
    rules: {
        pc: [
            {
                area: 'footer',
                text: tr(
                    'Правила, оферта й політики — посилання внизу кожної сторінки.',
                ),
            },
        ],
        phone: [
            {
                area: 'm-tab-menu',
                text: tr('Меню → унизу «Правила» й «Довідка».'),
            },
        ],
    },
    support: {
        pc: [
            {
                area: 'footer',
                text: tr('«Довідка» й «Підтримка» — внизу сторінки.'),
            },
            {
                area: 'avatar',
                text: tr('Меню аватарки → «Підтримка» — написати нам.'),
            },
        ],
        phone: [{ area: 'm-tab-menu', text: tr('Меню → «Підтримка».') }],
    },
    creator: {
        pc: [
            {
                area: 'profile',
                text: tr('Ваша сторінка — картка профілю ліворуч.'),
            },
            {
                area: 'composer',
                text: tr('Публікуйте записи, статті й серії — «Що нового?».'),
            },
            {
                area: 'gamecast',
                text: tr('GameCast у шапці — розмовні ефіри з #темами.'),
            },
        ],
        phone: [
            {
                area: 'm-tab-menu',
                text: tr('Меню → GameCast (широка кнопка).'),
            },
        ],
    },
});

function Spot({
    n,
    on,
    className,
    children,
    pinLeft = false,
}: {
    n?: number;
    on: boolean;
    className?: string;
    children?: React.ReactNode;
    /** Мітка ліворуч — коли праворуч уже стоїть мітка вкладеної зони. */
    pinLeft?: boolean;
}) {
    const reduce = useReducedMotion();

    return (
        <div
            className={cn(
                'relative rounded-[6px] bg-white/[0.06] transition',
                on && 'bg-primary/25 ring-2 ring-primary',
                className,
            )}
        >
            {children}
            {on && n !== undefined && (
                <motion.span
                    initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        delay: reduce ? 0 : n * 0.08,
                        type: 'spring',
                        stiffness: 380,
                        damping: 22,
                    }}
                    className={cn(
                        'absolute -top-2.5 z-10 grid size-6',
                        pinLeft ? '-left-2.5' : '-right-2.5',
                        'place-items-center rounded-full bg-primary text-[11px] font-bold text-white shadow-lg',
                    )}
                >
                    {n}
                </motion.span>
            )}
        </div>
    );
}

function DesktopMap({ pins }: { pins: Pin[] }) {
    const num = (area: Area) => {
        const i = pins.findIndex((p) => p.area === area);

        return i < 0 ? undefined : i + 1;
    };
    const S = ({
        area,
        className,
        children,
    }: {
        area: Area;
        className?: string;
        children?: React.ReactNode;
    }) => (
        <Spot
            n={num(area)}
            on={num(area) !== undefined}
            className={className}
            pinLeft={area === 'post'}
        >
            {children}
        </Spot>
    );

    return (
        <div
            className="aspect-[16/10] w-full rounded-2xl bg-[#0a0f1f] p-[2.5%] text-[0px]"
            aria-hidden
        >
            <div className="flex h-[9%] items-center gap-[1.5%] rounded-lg bg-white/[0.04] px-[1.5%]">
                <div className="h-[55%] w-[9%] rounded bg-sky-400/40" />
                <S area="search" className="h-[55%] w-[22%]" />
                <S area="nav" className="h-[55%] w-[18%]" />
                <S area="gamecast" className="h-[55%] w-[10%] bg-rose-500/20" />
                <div className="flex-1" />
                <S area="bell" className="aspect-square h-[55%] rounded-full" />
                <S
                    area="avatar"
                    className="aspect-square h-[60%] rounded-full"
                />
            </div>
            <div className="mt-[1.5%] flex h-[78%] gap-[1.5%]">
                <div className="flex w-[19%] flex-col gap-[4%]">
                    <S area="profile" className="h-[24%]" />
                    <S
                        area="menu"
                        className="grid h-[34%] grid-cols-2 gap-[6%] p-[6%]"
                    >
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="rounded bg-white/[0.06]" />
                        ))}
                    </S>
                    <S area="app" className="h-[14%] bg-sky-500/15" />
                </div>
                <div className="flex flex-1 flex-col gap-[2.2%]">
                    <S
                        area="stories"
                        className="flex h-[11%] items-center gap-[3%] px-[3%]"
                    >
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="aspect-square h-[60%] rounded-full bg-white/[0.1]"
                            />
                        ))}
                    </S>
                    <S area="streak" className="h-[7%]" />
                    <S area="composer" className="h-[9%]" />
                    <S
                        area="tabs"
                        className="flex h-[6%] items-center gap-[2%] px-[1%]"
                    >
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={cn(
                                    'h-[70%] w-[16%] rounded',
                                    i === 0
                                        ? 'bg-sky-400/50'
                                        : 'bg-white/[0.08]',
                                )}
                            />
                        ))}
                    </S>
                    <S area="post" className="relative flex-1">
                        <S
                            area="post-menu"
                            className="absolute top-[8%] right-[3%] h-[10%] w-[7%]"
                        />
                    </S>
                </div>
                <div className="flex w-[24%] flex-col gap-[4%]">
                    <S area="requests" className="h-[38%]" />
                    <S area="widgets" className="flex-1" />
                </div>
            </div>
            <div className="mt-[1.5%] flex h-[6%] gap-[1.5%]">
                <S area="player" className="flex-1" />
                <S area="footer" className="w-[30%]" />
            </div>
        </div>
    );
}

function PhoneMap({ pins }: { pins: MobilePin[] }) {
    const num = (area: MobileArea) => {
        const i = pins.findIndex((p) => p.area === area);

        return i < 0 ? undefined : i + 1;
    };
    const S = ({
        area,
        className,
    }: {
        area: MobileArea;
        className?: string;
    }) => (
        <Spot
            n={num(area)}
            on={num(area) !== undefined}
            className={className}
        />
    );

    return (
        <div
            className="mx-auto aspect-[9/17] w-[46%] min-w-40 rounded-[28px] bg-[#0a0f1f] p-[5%] ring-1 ring-white/10"
            aria-hidden
        >
            <div className="flex h-[7%] items-center gap-[6%]">
                <S area="m-header" className="h-[70%] w-[40%]" />
                <div className="flex-1" />
                <S
                    area="m-search"
                    className="aspect-square h-[70%] rounded-full"
                />
            </div>
            <S area="m-content" className="mt-[4%] h-[76%]" />
            <div className="mt-[4%] flex h-[9%] items-center justify-between gap-[3%] rounded-2xl bg-white/[0.04] px-[4%]">
                {(
                    [
                        'm-tab-feed',
                        'm-tab-chat',
                        'm-tab-friends',
                        'm-tab-menu',
                        'm-tab-profile',
                    ] as const
                ).map((a) => (
                    <S
                        key={a}
                        area={a}
                        className="aspect-square h-[60%] rounded-full"
                    />
                ))}
            </div>
        </div>
    );
}

/** Ілюстрація з легендою для розділу довідки (якщо для розділу є схема). */
export function SectionMap({ slug }: { slug: string }) {
    const [view, setView] = useState<'pc' | 'phone'>('pc');
    const map = MAPS()[slug];
    if (!map) return null;
    const pins = view === 'pc' ? map.pc : map.phone;

    return (
        <section
            aria-label={tr('Де це на сайті')}
            className="gc-solid mb-6 rounded-2xl p-4 sm:p-5"
        >
            <div className="mb-3 flex items-center gap-2">
                <h2 className="flex-1 font-display text-lg font-bold text-white">
                    {tr('Де це на сайті')}
                </h2>
                <div className="gc-solid-2 flex rounded-xl p-1 text-sm">
                    {(
                        [
                            ['pc', tr('ПК'), Monitor],
                            ['phone', tr('Телефон'), Smartphone],
                        ] as const
                    ).map(([key, label, Icon]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setView(key)}
                            aria-pressed={view === key}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition',
                                view === key
                                    ? 'bg-sky-500 text-white'
                                    : 'text-white/55 hover:text-white',
                            )}
                        >
                            <Icon className="size-4" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
                {view === 'pc' ? (
                    <DesktopMap pins={map.pc} />
                ) : (
                    <PhoneMap pins={map.phone} />
                )}
                <ol className="space-y-2.5">
                    {pins.map((pin, i) => (
                        <li
                            key={pin.area + i}
                            className="flex gap-3 text-sm text-white/80"
                        >
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">
                                {i + 1}
                            </span>
                            <span className="pt-0.5">{pin.text}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

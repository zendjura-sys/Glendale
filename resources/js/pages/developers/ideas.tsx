import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Bot,
    Gamepad2,
    Globe,
    Headphones,
    Medal,
    MessageCircle,
    Mic,
    MonitorPlay,
    Server,
    Shield,
    Trophy,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Group = 'games' | 'servers' | 'sites' | 'bots';

type Idea = {
    key: string;
    group: Group;
    icon: LucideIcon;
    title: () => string;
    text: () => string;
    /** Права OAuth, які знадобляться. */
    scopes: string[];
    /** Куди йти далі: пакет у каталозі чи документація. */
    link: { href: string; label: () => string };
    code?: string;
    /** Розділ сайту, без якого ідея не має сенсу (вимкнений — ідею не показуємо). */
    module?: string;
    voice?: boolean;
};

const IDEAS: Idea[] = [
    {
        key: 'login-code',
        group: 'games',
        icon: Gamepad2,
        title: () => tr('Вхід у гру кодом з телефона'),
        text: () =>
            tr(
                'Гра показує 8 символів і QR — гравець підтверджує на телефоні. Без паролів і браузера в грі; працює на ПК, консолі й телевізорі.',
            ),
        scopes: ['profile'],
        link: {
            href: '/developers/plugins/unity',
            label: () => tr('SDK для Unity, Unreal, Godot'),
        },
        code: 'var code = await gc.StartDeviceLogin();\n// покажіть code.user_code\nawait gc.WaitForLogin(code);',
    },
    {
        key: 'presence',
        group: 'games',
        icon: Users,
        title: () => tr('Друзі бачать, у що ви граєте'),
        text: () =>
            tr(
                '«В матчі · Dust2» у профілі GameCon і в списку друзів у вашій грі: друзі приєднуються в один натиск через запрошення.',
            ),
        scopes: ['friends', 'presence', 'invites'],
        link: { href: '/developers/sdk', label: () => tr('SDK і пісочниця') },
        code: "sdk.setPresence('В матчі · Dust2', 'lobby-42');\nsdk.invite('friend', 'lobby-42');",
        module: 'friends',
    },
    {
        key: 'achievements',
        group: 'games',
        icon: Medal,
        title: () => tr('Досягнення й таблиці лідерів'),
        text: () =>
            tr(
                'Досягнення гри з’являються в профілі гравця, а таблиця тижня — у вашій грі й на GameCon. Сервер гри може відкривати їх сам (серверний ключ).',
            ),
        scopes: ['achievements'],
        link: { href: '/developers/sdk', label: () => tr('SDK і пісочниця') },
        code: "sdk.unlockAchievement('first_win');\nsdk.submitScore('weekly', 1520);",
    },
    {
        key: 'overlay',
        group: 'games',
        icon: MonitorPlay,
        title: () => tr('Оверлей GameCon поверх гри'),
        text: () =>
            tr(
                'Паті, чат, сім’я чи клан і крапля з панеллю — безбарвне скло, кліки проходять у гру. Розкладку налаштовуєте в порталі, гравець — під себе.',
            ),
        scopes: ['profile', 'friends', 'chat'],
        link: { href: '/developers/sdk', label: () => tr('Редактор оверлею') },
    },
    {
        key: 'voice',
        group: 'games',
        icon: Mic,
        title: () => tr('Голос у лобі й матчі'),
        text: () =>
            tr(
                'Голосова кімната на кожне лобі: ключ — ваш ідентифікатор матчу. Кімнати різних ігор ізольовані, слухачі можуть бути без мікрофона.',
            ),
        scopes: ['voice'],
        link: { href: '/developers/sdk', label: () => tr('SDK і пісочниця') },
        code: "const { url, token } = (await sdk.joinVoice('match-42')).data;",
        voice: true,
    },
    {
        key: 'chat',
        group: 'games',
        icon: MessageCircle,
        title: () => tr('Чат GameCon у вашому застосунку'),
        text: () =>
            tr(
                'Бесіди гравця, повідомлення й особисті чати за ніком — у власному інтерфейсі застосунку чи лаунчера.',
            ),
        scopes: ['chat'],
        link: { href: '/developers/sdk', label: () => tr('SDK і пісочниця') },
        code: "const { data } = await sdk.chat.direct('friend');\nawait sdk.chat.send(data.id, 'Го в паті?');",
        module: 'messages',
    },
    {
        key: 'family-hq',
        group: 'servers',
        icon: Shield,
        title: () => tr('Штаб сім’ї в лаунчері RP-сервера'),
        text: () =>
            tr(
                'Склад, ранги, казна й свій баланс — у лаунчері чи меню сервера. Учасники бачать, хто зараз онлайн.',
            ),
        scopes: ['groups'],
        link: {
            href: '/developers/servers',
            label: () => tr('Для серверів GTA'),
        },
        code: 'GET /api/developer/v1/groups/families/{id}/members',
        module: 'families',
    },
    {
        key: 'clan-manage',
        group: 'servers',
        icon: Trophy,
        title: () => tr('Клани й гільдії: склад і заявки з гри'),
        text: () =>
            tr(
                'Лідер приймає заявки, міняє ранги й виганяє прямо з гри — без відкриття сайту. Права — лише в того, хто керує кланом на GameCon.',
            ),
        scopes: ['groups', 'groups:manage'],
        link: { href: '/developers/sdk', label: () => tr('SDK і пісочниця') },
        code: "sdk.groups.manageClanMember(clanId, memberId, 'accept');",
        module: 'clans',
    },
    {
        key: 'server-login',
        group: 'servers',
        icon: Server,
        title: () => tr('«Увійти через GameCon» на сервері'),
        text: () =>
            tr(
                'Гравець заходить на сервер акаунтом GameCon: нік, аватар і сім’я підтягуються самі, а адміністрація бачить перевірений профіль.',
            ),
        scopes: ['profile'],
        link: {
            href: '/developers/servers',
            label: () => tr('Для серверів GTA'),
        },
        module: 'servers',
    },
    {
        key: 'site-login',
        group: 'sites',
        icon: Globe,
        title: () => tr('Вхід через GameCon на сайті й форумі'),
        text: () =>
            tr(
                'Готові плагіни для WordPress, phpBB, XenForo, Discourse й інших — без жодного рядка коду; пакети для Laravel, Next.js, Python.',
            ),
        scopes: ['profile', 'email'],
        link: { href: '/developers/plugins', label: () => tr('Плагіни й SDK') },
    },
    {
        key: 'music',
        group: 'sites',
        icon: Headphones,
        title: () => tr('Музика GameCon у лаунчері'),
        text: () =>
            tr(
                'Що грає зараз і пульт: пауза, наступний трек, гучність — на будь-якому пристрої гравця.',
            ),
        scopes: ['music'],
        link: { href: '/developers/sdk', label: () => tr('SDK і пісочниця') },
        code: "await sdk.music.command('next');",
        module: 'music',
    },
    {
        key: 'bots',
        group: 'bots',
        icon: Bot,
        title: () => tr('Боти: сповіщення від гри й сервера'),
        text: () =>
            tr(
                'Сервер гри надсилає гравцю сповіщення в GameCon («Турнір за 10 хвилин»), а бот відповідає в чатах. Ключ бота — у «Розробникам».',
            ),
        scopes: ['notifications'],
        link: { href: '/developers', label: () => tr('Боти й ключі') },
        code: 'POST /api/developer/v1/server/notify',
    },
];

const GROUPS: [Group | 'all', () => string][] = [
    ['all', () => tr('Усі')],
    ['games', () => tr('Ігри')],
    ['servers', () => tr('Сервери')],
    ['sites', () => tr('Сайти й лаунчери')],
    ['bots', () => tr('Боти')],
];

/** Ідеї інтеграцій (№304): що можна зробити з GameCon у своїй грі, на сервері, сайті чи в боті. */
export default function DeveloperIdeas({
    enabled,
    voice,
}: {
    enabled: string[];
    voice: boolean;
}) {
    const [group, setGroup] = useState<Group | 'all'>('all');
    // Розділ вимкнено (чи голосового сервера немає) — ідеї для нього не показуємо.
    const ideas = IDEAS.filter(
        (idea) =>
            (!idea.module || enabled.includes(idea.module)) &&
            (!idea.voice || voice),
    );
    const shown = ideas.filter(
        (idea) => group === 'all' || idea.group === group,
    );
    const groups = GROUPS.filter(
        ([key]) => key === 'all' || ideas.some((idea) => idea.group === key),
    );

    return (
        <>
            <Head title={tr('Ідеї інтеграцій')} />
            <div className="mx-auto max-w-5xl space-y-3.5 px-4 py-6">
                <Link
                    href="/developers"
                    className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white"
                >
                    <ArrowLeft className="size-4" />
                    {tr('Розробникам')}
                </Link>
                <header>
                    <h1 className="font-display text-3xl font-bold text-white">
                        {tr('Ідеї інтеграцій')}
                    </h1>
                    <p className="mt-2 max-w-2xl text-white/65">
                        {tr(
                            'Готові сценарії: що гравці отримають від GameCon у вашій грі, на сервері, сайті чи в боті — і з чого почати.',
                        )}
                    </p>
                </header>
                <nav
                    className="gc-solid-2 flex max-w-full flex-wrap gap-1 rounded-xl p-1 text-sm"
                    aria-label={tr('Типи інтеграцій')}
                >
                    {groups.map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setGroup(key)}
                            aria-pressed={group === key}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-medium transition',
                                group === key
                                    ? 'bg-primary text-white'
                                    : 'text-white/60 hover:text-white',
                            )}
                        >
                            {label()}
                        </button>
                    ))}
                </nav>
                <div className="grid gap-3 md:grid-cols-2">
                    {shown.map((idea) => (
                        <article
                            key={idea.key}
                            className="gc-solid flex flex-col gap-3 rounded-2xl p-4"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                                    <idea.icon className="size-5" aria-hidden />
                                </span>
                                <div className="min-w-0">
                                    <h2 className="font-semibold text-white">
                                        {idea.title()}
                                    </h2>
                                    <p className="mt-1 text-sm leading-relaxed text-white/65">
                                        {idea.text()}
                                    </p>
                                </div>
                            </div>
                            {idea.code && (
                                <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs leading-relaxed text-white/80">
                                    <code>{idea.code}</code>
                                </pre>
                            )}
                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                                <span className="flex flex-wrap gap-1">
                                    {idea.scopes.map((scope) => (
                                        <code
                                            key={scope}
                                            className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/60"
                                        >
                                            {scope}
                                        </code>
                                    ))}
                                </span>
                                <Link
                                    href={idea.link.href}
                                    className="text-sm font-medium text-primary hover:underline"
                                >
                                    {idea.link.label()} →
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </>
    );
}

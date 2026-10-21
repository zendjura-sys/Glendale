import { Head, Link } from '@inertiajs/react';
import {
    Clapperboard,
    Download,
    Gamepad2,
    Heart,
    MessageCircle,
    Music2,
    Share2,
    Sparkles,
    Trophy,
    Users,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, animate, m, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/gc/user-avatar';
import { tr, pluralForm } from '@/lib/i18n';
import { EASE_OUT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { UserCard } from '@/types';

/**
 * «Підсумки року» — історія з карток, як Stories: дотик праворуч — далі, ліворуч — назад,
 * утримання — пауза, картки йдуть самі. Порожні розділи пропускаються. Остання картка —
 * підсумок, який можна поділитися картинкою (малюється тут же, на canvas).
 */

type Persona =
    | 'melomaniac'
    | 'cinephile'
    | 'author'
    | 'soul'
    | 'gamer'
    | 'newcomer';

type Wrapped = {
    year: number;
    user: UserCard;
    joined_this_year: boolean;
    active_days: number;
    posts: {
        count: number;
        reactions: number;
        comments: number;
        top: {
            id: number;
            body: string;
            likes: number;
            comments: number;
            image: string | null;
        } | null;
    };
    social: {
        new_friends: number;
        messages: number;
        call_minutes: number;
        best_friend: { user: UserCard; messages: number } | null;
        profile_visitors: number;
    };
    music: {
        plays: number;
        top_tracks: {
            title: string;
            artist: string;
            plays: number;
            cover_url: string | null;
        }[];
        top_artist: { name: string; plays: number } | null;
        added: number;
        listen_parties: number;
    };
    cinema: {
        watched: number;
        favorites: { title: string; slug: string; poster: string | null }[];
        watch_parties: number;
    };
    games: {
        play_days: number;
        top_games: { name: string; slug: string; cover: string | null }[];
        top_server: { name: string; icon: string | null; days: number } | null;
        votes: number;
        moments: number;
    };
    progress: { xp: number; quests: number };
    persona: Persona;
};

/** Скільки триває картка, мс. */
const SLIDE_MS = 7000;

const PERSONAS: Record<Persona, { title: string; text: string }> = {
    melomaniac: {
        title: tr('Меломан'),
        text: tr('Музика звучала в тебе частіше, ніж будь-що інше.'),
    },
    cinephile: {
        title: tr('Кіноман'),
        text: tr('Фільми й серіали стали твоїм другим домом.'),
    },
    author: {
        title: tr('Автор'),
        text: tr('Твої пости читала вся стрічка.'),
    },
    soul: {
        title: tr('Душа компанії'),
        text: tr('Друзі, чати й дзвінки — ти завжди на зв’язку.'),
    },
    gamer: {
        title: tr('Геймер'),
        text: tr('Ігри й сервери знали тебе в обличчя.'),
    },
    newcomer: {
        title: tr('Новачок'),
        text: tr('Усе тільки починається — наступний рік буде твоїм.'),
    },
};

/** Тло кожної картки: пласкі кольорові плями на глибокому індиго. */
const TONES = [
    'radial-gradient(90% 60% at 20% 10%, #4f46e5 0%, transparent 60%), radial-gradient(80% 60% at 90% 90%, #c026d3 0%, transparent 60%), #120b3d',
    'radial-gradient(90% 60% at 80% 0%, #db2777 0%, transparent 60%), radial-gradient(80% 60% at 0% 100%, #7c3aed 0%, transparent 60%), #1a0b33',
    'radial-gradient(90% 60% at 10% 90%, #0891b2 0%, transparent 60%), radial-gradient(80% 60% at 100% 10%, #4f46e5 0%, transparent 60%), #0b1638',
    'radial-gradient(90% 60% at 90% 80%, #9333ea 0%, transparent 60%), radial-gradient(80% 60% at 0% 0%, #2563eb 0%, transparent 60%), #120b3d',
    'radial-gradient(90% 60% at 50% 0%, #e11d48 0%, transparent 60%), radial-gradient(80% 60% at 50% 100%, #f59e0b55 0%, transparent 60%), #1c0b22',
    'radial-gradient(90% 60% at 0% 50%, #059669 0%, transparent 60%), radial-gradient(80% 60% at 100% 50%, #4f46e5 0%, transparent 60%), #08192a',
];

type Slide = { key: string; render: () => ReactNode };

/** Число, що набігає від нуля (без руху — одразу кінцеве). */
function Count({ value }: { value: number }) {
    const reduce = useReducedMotion();
    const [shown, setShown] = useState(reduce ? value : 0);

    useEffect(() => {
        if (reduce) {
            setShown(value);

            return;
        }
        const controls = animate(0, value, {
            duration: 1.2,
            ease: EASE_OUT,
            onUpdate: (v) => setShown(Math.round(v)),
        });

        return () => controls.stop();
    }, [value, reduce]);

    return <>{shown.toLocaleString('uk-UA')}</>;
}

/** Елементи картки з’являються по черзі. */
function Rise({ i = 0, children }: { i?: number; children: ReactNode }) {
    const reduce = useReducedMotion();

    return (
        <m.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                ease: EASE_OUT,
                delay: 0.15 + i * 0.12,
            }}
        >
            {children}
        </m.div>
    );
}

function Kicker({
    icon: Icon,
    children,
}: {
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <p className="flex items-center gap-2 text-sm font-medium text-white/70">
            <Icon className="size-4" />
            {children}
        </p>
    );
}

function Big({ value, label }: { value: number; label: string }) {
    return (
        <div>
            <p className="font-display text-6xl leading-none font-bold tracking-tight text-white tabular-nums">
                <Count value={value} />
            </p>
            <p className="mt-2 text-lg text-white/75">{label}</p>
        </div>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div className="rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/15 ring-inset">
            <p className="font-display text-2xl font-bold text-white tabular-nums">
                <Count value={value} />
            </p>
            <p className="text-sm text-white/65">{label}</p>
        </div>
    );
}

function Cover({ src, className }: { src: string | null; className?: string }) {
    // Обкладинка не завантажилась — показуємо значок замість «битої» картинки.
    const [broken, setBroken] = useState(false);

    return src && !broken ? (
        <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className={cn('object-cover', className)}
        />
    ) : (
        <span
            className={cn(
                'flex items-center justify-center bg-white/10 text-white/60',
                className,
            )}
        >
            <Music2 className="size-5" />
        </span>
    );
}

function n(count: number, forms: [string, string, string]): string {
    return pluralForm(count, forms);
}

function buildSlides(w: Wrapped): Slide[] {
    const slides: Slide[] = [];
    const persona = PERSONAS[w.persona];

    slides.push({
        key: 'intro',
        render: () => (
            <div className="flex flex-col gap-8">
                <Rise>
                    <UserAvatar user={w.user} size="xl" showOnline={false} />
                </Rise>
                <Rise i={1}>
                    <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight text-white">
                        {tr('Твій {year} у GameCon', { year: w.year })}
                    </h1>
                </Rise>
                <Rise i={2}>
                    <p className="text-xl text-white/80">
                        {w.joined_this_year
                            ? tr(
                                  'Ти з нами з цього року — і вже стільки встиг(-ла)!',
                              )
                            : tr('Згадаймо, яким він був.')}
                    </p>
                </Rise>
                {w.active_days > 0 && (
                    <Rise i={3}>
                        <Big
                            value={w.active_days}
                            label={n(w.active_days, [
                                tr('день разом'),
                                tr('дні разом'),
                                tr('днів разом'),
                            ])}
                        />
                    </Rise>
                )}
            </div>
        ),
    });

    if (w.posts.count > 0 || w.posts.comments > 0) {
        slides.push({
            key: 'posts',
            render: () => (
                <div className="flex flex-col gap-8">
                    <Rise>
                        <Kicker icon={Sparkles}>{tr('Стрічка')}</Kicker>
                    </Rise>
                    <Rise i={1}>
                        <Big
                            value={w.posts.count}
                            label={n(w.posts.count, [
                                tr('пост за рік'),
                                tr('пости за рік'),
                                tr('постів за рік'),
                            ])}
                        />
                    </Rise>
                    <Rise i={2}>
                        <div className="grid grid-cols-2 gap-3">
                            <Stat
                                value={w.posts.reactions}
                                label={tr('реакцій на них')}
                            />
                            <Stat
                                value={w.posts.comments}
                                label={tr('коментарів написано')}
                            />
                        </div>
                    </Rise>
                    {w.posts.top && (
                        <Rise i={3}>
                            <div className="overflow-hidden rounded-3xl bg-white/[0.08] ring-1 ring-white/15 ring-inset">
                                {w.posts.top.image && (
                                    <img
                                        src={w.posts.top.image}
                                        alt=""
                                        className="aspect-[16/9] w-full object-cover"
                                    />
                                )}
                                <div className="p-4">
                                    <p className="text-sm text-white/60">
                                        {tr('Найпопулярніший пост')}
                                    </p>
                                    {w.posts.top.body && (
                                        <p className="mt-1 line-clamp-3 text-white">
                                            {w.posts.top.body}
                                        </p>
                                    )}
                                    <p className="mt-2 flex items-center gap-1.5 text-sm text-white/75">
                                        <Heart className="size-4 fill-current text-pink-400" />
                                        {w.posts.top.likes}
                                    </p>
                                </div>
                            </div>
                        </Rise>
                    )}
                </div>
            ),
        });
    }

    const s = w.social;
    if (s.messages > 0 || s.new_friends > 0 || s.best_friend) {
        slides.push({
            key: 'social',
            render: () => (
                <div className="flex flex-col gap-8">
                    <Rise>
                        <Kicker icon={Users}>{tr('Друзі')}</Kicker>
                    </Rise>
                    {s.best_friend ? (
                        <Rise i={1}>
                            <div className="flex flex-col gap-4">
                                <UserAvatar
                                    user={s.best_friend.user}
                                    size="xl"
                                    showOnline={false}
                                />
                                <p className="font-display text-4xl leading-tight font-bold text-white">
                                    {tr('{name} — твоя людина року', {
                                        name:
                                            s.best_friend.user.first_name ||
                                            s.best_friend.user.name,
                                    })}
                                </p>
                                <p className="text-lg text-white/75">
                                    {tr('{count} повідомлень на двох', {
                                        count: s.best_friend.messages.toLocaleString(
                                            'uk-UA',
                                        ),
                                    })}
                                </p>
                            </div>
                        </Rise>
                    ) : (
                        <Rise i={1}>
                            <Big
                                value={s.messages}
                                label={n(s.messages, [
                                    tr('повідомлення'),
                                    tr('повідомлення'),
                                    tr('повідомлень'),
                                ])}
                            />
                        </Rise>
                    )}
                    <Rise i={2}>
                        <div className="grid grid-cols-2 gap-3">
                            <Stat
                                value={s.new_friends}
                                label={tr('нових друзів')}
                            />
                            <Stat
                                value={s.messages}
                                label={tr('повідомлень надіслано')}
                            />
                            {s.call_minutes > 0 && (
                                <Stat
                                    value={s.call_minutes}
                                    label={tr('хвилин у дзвінках')}
                                />
                            )}
                            {s.profile_visitors > 0 && (
                                <Stat
                                    value={s.profile_visitors}
                                    label={tr('гостей профілю')}
                                />
                            )}
                        </div>
                    </Rise>
                </div>
            ),
        });
    }

    const mu = w.music;
    if (mu.plays > 0 || mu.added > 0) {
        slides.push({
            key: 'music',
            render: () => (
                <div className="flex flex-col gap-7">
                    <Rise>
                        <Kicker icon={Music2}>{tr('Музика')}</Kicker>
                    </Rise>
                    <Rise i={1}>
                        <Big
                            value={mu.plays}
                            label={n(mu.plays, [
                                tr('прослуховування'),
                                tr('прослуховування'),
                                tr('прослуховувань'),
                            ])}
                        />
                    </Rise>
                    {mu.top_artist && (
                        <Rise i={2}>
                            <p className="text-lg text-white/75">
                                {tr('Твій виконавець року')}
                            </p>
                            <p className="font-display text-3xl font-bold text-white">
                                {mu.top_artist.name}
                            </p>
                        </Rise>
                    )}
                    {mu.top_tracks.length > 0 && (
                        <Rise i={3}>
                            <ol className="grid gap-2.5">
                                {mu.top_tracks.map((t, i) => (
                                    <li
                                        key={`${t.title}-${t.artist}`}
                                        className="flex items-center gap-3"
                                    >
                                        <span className="w-5 text-right font-display text-lg font-bold text-white/50 tabular-nums">
                                            {i + 1}
                                        </span>
                                        <Cover
                                            src={t.cover_url}
                                            className="size-12 shrink-0 rounded-xl"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold text-white">
                                                {t.title}
                                            </span>
                                            <span className="block truncate text-sm text-white/60">
                                                {t.artist}
                                            </span>
                                        </span>
                                        <span className="text-sm text-white/60 tabular-nums">
                                            ×{t.plays}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </Rise>
                    )}
                </div>
            ),
        });
    }

    const c = w.cinema;
    if (c.watched > 0) {
        slides.push({
            key: 'cinema',
            render: () => (
                <div className="flex flex-col gap-8">
                    <Rise>
                        <Kicker icon={Clapperboard}>{tr('Кіно')}</Kicker>
                    </Rise>
                    <Rise i={1}>
                        <Big
                            value={c.watched}
                            label={n(c.watched, [
                                tr('фільм чи серіал переглянуто'),
                                tr('фільми й серіали переглянуто'),
                                tr('фільмів і серіалів переглянуто'),
                            ])}
                        />
                    </Rise>
                    {c.favorites.length > 0 && (
                        <Rise i={2}>
                            <div className="grid grid-cols-3 gap-3">
                                {c.favorites.map((movie) => (
                                    <figure key={movie.slug}>
                                        <Cover
                                            src={movie.poster}
                                            className="aspect-[2/3] w-full rounded-2xl"
                                        />
                                        <figcaption className="mt-1.5 line-clamp-2 text-sm text-white/80">
                                            {movie.title}
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </Rise>
                    )}
                    {c.watch_parties > 0 && (
                        <Rise i={3}>
                            <Stat
                                value={c.watch_parties}
                                label={tr('спільних переглядів з друзями')}
                            />
                        </Rise>
                    )}
                </div>
            ),
        });
    }

    const g = w.games;
    if (g.play_days > 0 || g.votes > 0 || g.moments > 0) {
        slides.push({
            key: 'games',
            render: () => (
                <div className="flex flex-col gap-8">
                    <Rise>
                        <Kicker icon={Gamepad2}>{tr('Ігри')}</Kicker>
                    </Rise>
                    {g.play_days > 0 && (
                        <Rise i={1}>
                            <Big
                                value={g.play_days}
                                label={n(g.play_days, [
                                    tr('ігровий день'),
                                    tr('ігрові дні'),
                                    tr('ігрових днів'),
                                ])}
                            />
                        </Rise>
                    )}
                    {g.top_games.length > 0 && (
                        <Rise i={2}>
                            <div className="flex gap-3">
                                {g.top_games.map((game) => (
                                    <figure key={game.slug} className="w-1/3">
                                        <Cover
                                            src={game.cover}
                                            className="aspect-[3/4] w-full rounded-2xl"
                                        />
                                        <figcaption className="mt-1.5 line-clamp-2 text-sm text-white/80">
                                            {game.name}
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </Rise>
                    )}
                    <Rise i={3}>
                        <div className="grid grid-cols-2 gap-3">
                            {g.top_server && (
                                <div className="col-span-2 flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/15 ring-inset">
                                    <Cover
                                        src={g.top_server.icon}
                                        className="size-11 rounded-xl"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm text-white/65">
                                            {tr('Сервер року')}
                                        </p>
                                        <p className="truncate font-semibold text-white">
                                            {g.top_server.name}
                                        </p>
                                    </div>
                                </div>
                            )}
                            {g.votes > 0 && (
                                <Stat
                                    value={g.votes}
                                    label={tr('голосів за сервер')}
                                />
                            )}
                            {g.moments > 0 && (
                                <Stat
                                    value={g.moments}
                                    label={tr('моментів')}
                                />
                            )}
                        </div>
                    </Rise>
                </div>
            ),
        });
    }

    if (w.progress.xp > 0) {
        slides.push({
            key: 'progress',
            render: () => (
                <div className="flex flex-col gap-8">
                    <Rise>
                        <Kicker icon={Trophy}>{tr('Завдання')}</Kicker>
                    </Rise>
                    <Rise i={1}>
                        <Big
                            value={w.progress.xp}
                            label={tr('досвіду зароблено')}
                        />
                    </Rise>
                    <Rise i={2}>
                        <Stat
                            value={w.progress.quests}
                            label={tr('щоденних завдань виконано')}
                        />
                    </Rise>
                </div>
            ),
        });
    }

    slides.push({
        key: 'persona',
        render: () => (
            <div className="flex flex-col gap-6">
                <Rise>
                    <p className="text-lg text-white/75">
                        {tr('Твій {year} — це…', { year: w.year })}
                    </p>
                </Rise>
                <Rise i={1}>
                    <p className="font-display text-6xl leading-none font-bold tracking-tight text-white">
                        {persona.title}
                    </p>
                </Rise>
                <Rise i={2}>
                    <p className="text-xl text-white/80">{persona.text}</p>
                </Rise>
            </div>
        ),
    });

    return slides;
}

/** Ключові цифри для підсумкової картки й картинки. */
function summaryStats(w: Wrapped): { value: number; label: string }[] {
    const stat = (value: number, forms: [string, string, string]) => ({
        value,
        label: n(value, forms),
    });

    return [
        stat(w.active_days, [
            tr('день з GameCon'),
            tr('дні з GameCon'),
            tr('днів з GameCon'),
        ]),
        stat(w.posts.count, [tr('пост'), tr('пости'), tr('постів')]),
        stat(w.social.new_friends, [
            tr('новий друг'),
            tr('нові друзі'),
            tr('нових друзів'),
        ]),
        stat(w.music.plays, [
            tr('прослуховування'),
            tr('прослуховування'),
            tr('прослуховувань'),
        ]),
        stat(w.cinema.watched, [
            tr('перегляд'),
            tr('перегляди'),
            tr('переглядів'),
        ]),
        stat(w.games.play_days, [
            tr('ігровий день'),
            tr('ігрові дні'),
            tr('ігрових днів'),
        ]),
    ]
        .filter((s) => s.value > 0)
        .slice(0, 4);
}

/** Картинка 1080×1350 для поширення: малюється на canvas, без сторонніх сервісів. */
async function shareImage(w: Wrapped): Promise<Blob | null> {
    await document.fonts?.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#120b3d';
    ctx.fillRect(0, 0, 1080, 1350);
    const glow = (x: number, y: number, r: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(18,11,61,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1080, 1350);
    };
    glow(180, 160, 760, 'rgba(79,70,229,0.9)');
    glow(960, 1250, 760, 'rgba(192,38,211,0.75)');

    const font = (weight: number, size: number) =>
        `${weight} ${size}px Montserrat, system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = font(600, 40);
    ctx.globalAlpha = 0.75;
    ctx.fillText(tr('Підсумки року · GameCon'), 90, 100);
    ctx.globalAlpha = 1;
    ctx.font = font(800, 200);
    ctx.fillText(String(w.year), 80, 170);
    ctx.font = font(700, 56);
    ctx.fillText(w.user.name.slice(0, 28), 90, 410);
    ctx.font = font(500, 40);
    ctx.globalAlpha = 0.8;
    ctx.fillText(PERSONAS[w.persona].title, 90, 486);
    ctx.globalAlpha = 1;

    summaryStats(w).forEach((s, i) => {
        const x = 90 + (i % 2) * 470;
        const y = 640 + Math.floor(i / 2) * 260;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(x, y, 430, 220, 36);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = font(800, 88);
        ctx.fillText(s.value.toLocaleString('uk-UA'), x + 40, y + 36);
        ctx.font = font(500, 34);
        ctx.globalAlpha = 0.75;
        ctx.fillText(s.label, x + 40, y + 148);
        ctx.globalAlpha = 1;
    });

    ctx.font = font(600, 36);
    ctx.globalAlpha = 0.7;
    ctx.fillText('gamecon.online', 90, 1220);
    ctx.globalAlpha = 1;

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function Summary({ w }: { w: Wrapped }) {
    const [busy, setBusy] = useState(false);
    const stats = summaryStats(w);

    const share = async () => {
        setBusy(true);
        try {
            const blob = await shareImage(w);
            if (!blob) return;
            const file = new File([blob], `gamecon-${w.year}.png`, {
                type: 'image/png',
            });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator
                    .share({
                        files: [file],
                        title: tr('Мій {year} у GameCon', { year: w.year }),
                    })
                    .catch(() => {});
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } finally {
            setBusy(false);
        }
    };
    const canShareFiles =
        typeof navigator !== 'undefined' && 'share' in navigator;

    return (
        <div className="flex flex-col gap-6">
            <Rise>
                <div className="rounded-3xl bg-white/[0.08] p-5 ring-1 ring-white/15 ring-inset">
                    <div className="flex items-center gap-3">
                        <UserAvatar
                            user={w.user}
                            size="lg"
                            showOnline={false}
                        />
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                                {w.user.name}
                            </p>
                            <p className="text-sm text-white/65">
                                {PERSONAS[w.persona].title} · {w.year}
                            </p>
                        </div>
                    </div>
                    {stats.length > 0 && (
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            {stats.map((s) => (
                                <div key={s.label}>
                                    <p className="font-display text-3xl font-bold text-white tabular-nums">
                                        {s.value.toLocaleString('uk-UA')}
                                    </p>
                                    <p className="text-sm text-white/65">
                                        {s.label}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Rise>
            <Rise i={1}>
                <div
                    className="flex flex-col gap-3"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={share}
                        disabled={busy}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold text-[#120b3d] transition hover:bg-white/90 disabled:opacity-60"
                    >
                        {canShareFiles ? (
                            <Share2 className="size-5" />
                        ) : (
                            <Download className="size-5" />
                        )}
                        {canShareFiles
                            ? tr('Поділитися')
                            : tr('Завантажити картинку')}
                    </button>
                    <Link
                        href="/feed"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/10 px-6 font-semibold text-white ring-1 ring-white/20 transition ring-inset hover:bg-white/15"
                    >
                        <MessageCircle className="size-5" />
                        {tr('До стрічки')}
                    </Link>
                </div>
            </Rise>
        </div>
    );
}

function Teaser({ opensAt }: { opensAt: string }) {
    const date = new Date(opensAt).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
    });

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-6 text-white"
            style={{ background: TONES[0] }}
        >
            <Head title={tr('Підсумки року')} />
            <div className="max-w-sm text-center">
                <Sparkles className="mx-auto size-10 text-white/80" />
                <h1 className="mt-4 font-display text-3xl font-bold">
                    {tr('Підсумки року ще готуються')}
                </h1>
                <p className="mt-3 text-white/75">
                    {tr(
                        'Твої картки з’являться {date}: пости, друзі, музика, кіно й ігри за весь рік.',
                        { date },
                    )}
                </p>
                <Link
                    href="/feed"
                    className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-semibold text-[#120b3d]"
                >
                    {tr('До стрічки')}
                </Link>
            </div>
        </div>
    );
}

export default function WrappedPage({
    wrapped,
    opens_at,
    preview,
}: {
    wrapped: Wrapped | null;
    opens_at: string;
    preview: boolean;
}) {
    if (!wrapped) return <Teaser opensAt={opens_at} />;

    return <Story w={wrapped} preview={preview} />;
}

function Story({ w, preview }: { w: Wrapped; preview: boolean }) {
    const reduce = useReducedMotion();
    const slides = useMemo(() => {
        const list = buildSlides(w);
        list.push({ key: 'summary', render: () => <Summary w={w} /> });

        return list;
    }, [w]);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const started = useRef(0);
    const last = index === slides.length - 1;

    const go = useCallback(
        (delta: number) => {
            setIndex((i) =>
                Math.min(Math.max(i + delta, 0), slides.length - 1),
            );
            setProgress(0);
        },
        [slides.length],
    );

    // Таймер картки: стоїть на паузі, на останній картці й коли вкладка прихована.
    useEffect(() => {
        if (paused || last) return;
        started.current = performance.now() - progress * SLIDE_MS;
        let frame = 0;
        const tick = (now: number) => {
            if (document.hidden) {
                started.current = now - progress * SLIDE_MS;
            }
            const p = Math.min((now - started.current) / SLIDE_MS, 1);
            setProgress(p);
            if (p >= 1) {
                go(1);

                return;
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
        // progress навмисно не в залежностях: таймер перезапускається лише на зміну картки чи паузи.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, paused, last, go]);

    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') go(1);
            if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', key);

        return () => window.removeEventListener('keydown', key);
    }, [go]);

    // Ліва третина — назад, решта — далі (на останній картці лише назад: там кнопки).
    const tap = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const back = e.clientX - rect.left < rect.width / 3;
        if (back) go(-1);
        else if (!last) go(1);
    };

    return (
        <div
            className="fixed inset-0 overflow-hidden text-white transition-[background] duration-700"
            style={{ background: TONES[index % TONES.length] }}
        >
            <Head title={tr('Підсумки {year}', { year: w.year })} />
            <div className="relative mx-auto flex h-full max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                <div className="flex gap-1.5" aria-hidden>
                    {slides.map((slide, i) => (
                        <span
                            key={slide.key}
                            className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
                        >
                            <span
                                className="block h-full rounded-full bg-white"
                                style={{
                                    width: `${i < index ? 100 : i === index ? (last ? 100 : progress * 100) : 0}%`,
                                }}
                            />
                        </span>
                    ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-white/80">
                        {tr('Підсумки {year}', { year: w.year })}
                        {preview && (
                            <span className="ml-2 text-white/50">
                                · {tr('попередній перегляд')}
                            </span>
                        )}
                    </p>
                    <Link
                        href="/feed"
                        aria-label={tr('Закрити')}
                        className="flex size-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                    >
                        <X className="size-6" />
                    </Link>
                </div>

                <div
                    className="relative flex min-h-0 flex-1 cursor-pointer items-center select-none"
                    onPointerDown={() => setPaused(true)}
                    onPointerUp={(e) => {
                        setPaused(false);
                        tap(e);
                    }}
                    onPointerLeave={() => setPaused(false)}
                    role="button"
                    tabIndex={-1}
                    aria-label={tr('Далі')}
                >
                    <AnimatePresence mode="wait">
                        <m.div
                            key={slides[index].key}
                            className="w-full"
                            initial={reduce ? false : { opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduce ? undefined : { opacity: 0, x: -24 }}
                            transition={{ duration: 0.3, ease: EASE_OUT }}
                        >
                            {slides[index].render()}
                        </m.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

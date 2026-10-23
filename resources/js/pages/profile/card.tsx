import { Head, Link } from '@inertiajs/react';
import {
    Crown,
    Download,
    Gamepad2,
    Link2,
    Music2,
    Server,
    Share2,
    Swords,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/gc/user-avatar';
import { initials } from '@/lib/format';
import { tr } from '@/lib/i18n';
import type { UserCard } from '@/types';

type Game = {
    level: number;
    title: string;
    badges: { earned: number; total: number };
    since: number;
    family: { name: string; tag: string | null } | null;
    clan: { name: string; tag: string | null } | null;
    season: { level: number; max: number } | null;
    games: string[];
    servers: string[];
    artist: string | null;
};

/** Кольори картки — палітра сайту; кнопки — кольори Discord (blurple і сірий). */
const D = {
    accent: '#2F7BFF',
    bg: '#0b1020',
    card: 'rgba(255,255,255,0.05)',
    panel: 'rgba(255,255,255,0.08)',
    button: '#2a3146',
    text: '#FFFFFF',
    soft: 'rgba(255,255,255,0.85)',
    muted: 'rgba(255,255,255,0.55)',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/** Рядки тексту під ширину: без обрізання «…», довге переноситься. */
function wrap(
    ctx: CanvasRenderingContext2D,
    text: string,
    width: number,
): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > width && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);

    return lines;
}

/** Найбільший розмір шрифту (не більше max), за якого текст уміщується в ширину. */
function fit(
    ctx: CanvasRenderingContext2D,
    text: string,
    weight: number,
    max: number,
    width: number,
    font: string,
): number {
    let size = max;
    ctx.font = `${weight} ${size}px ${font}`;
    while (size > 28 && ctx.measureText(text).width > width) {
        size -= 2;
        ctx.font = `${weight} ${size}px ${font}`;
    }

    return size;
}

/** Картинка 1080×1350 для поширення: малюється на canvas, без сторонніх сервісів. */
async function drawCard(
    profile: UserCard,
    game: Game,
    qr: string,
    url: string,
): Promise<Blob | null> {
    await document.fonts?.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const pad = 72;
    const inner = 1080 - pad * 2;

    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#0b1020');
    bg.addColorStop(1, '#050608');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);
    // Банер з неоновим акцентом сайту.
    const banner = ctx.createLinearGradient(0, 0, 1080, 260);
    banner.addColorStop(0, '#1d4ed8');
    banner.addColorStop(1, D.accent);
    ctx.fillStyle = banner;
    ctx.fillRect(0, 0, 1080, 260);

    // Аватар із «вирізом» кольору тла.
    ctx.fillStyle = '#0a0e1a';
    ctx.beginPath();
    ctx.arc(pad + 110, 260, 122, 0, Math.PI * 2);
    ctx.fill();
    const avatar = profile.avatar_url
        ? await loadImage(profile.avatar_url)
        : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad + 110, 260, 110, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) {
        ctx.drawImage(avatar, pad, 150, 220, 220);
    } else {
        ctx.fillStyle = D.button;
        ctx.fillRect(pad, 150, 220, 220);
        ctx.fillStyle = D.text;
        ctx.font = `700 80px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials(profile.name), pad + 110, 264);
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Рівень — бейдж праворуч від аватара.
    ctx.fillStyle = D.panel;
    ctx.beginPath();
    ctx.roundRect(1080 - pad - 300, 290, 300, 84, 42);
    ctx.fill();
    ctx.fillStyle = D.accent;
    ctx.font = `700 38px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(tr('Рівень {n}', { n: game.level }), 1080 - pad - 150, 345);
    ctx.textAlign = 'left';

    // Ім’я: зменшуємо шрифт, щоб уміщалося цілим.
    let y = 470;
    const nameSize = fit(ctx, profile.name, 800, 72, inner, font);
    ctx.fillStyle = D.text;
    ctx.fillText(profile.name, pad, y);
    y += 50;
    ctx.fillStyle = D.muted;
    ctx.font = `500 36px ${font}`;
    ctx.fillText(`@${profile.username} · ${game.title}`, pad, y);
    y += nameSize > 60 ? 50 : 44;

    // Панель фактів.
    const facts: [string, string][] = [];
    if (game.games.length) facts.push([tr('Ігри'), game.games.join(', ')]);
    if (game.servers.length)
        facts.push([tr('Сервери'), game.servers.join(', ')]);
    const groups = [
        game.family
            ? `${game.family.tag ? `[${game.family.tag}] ` : ''}${game.family.name}`
            : null,
        game.clan ? game.clan.name : null,
    ].filter(Boolean) as string[];
    if (groups.length) facts.push([tr('Сім’я й клан'), groups.join(', ')]);
    if (game.artist) facts.push([tr('Слухає найчастіше'), game.artist]);

    const blocks = facts.map(([label, value]) => {
        ctx.font = `500 38px ${font}`;
        return { label, lines: wrap(ctx, value, inner - 64).slice(0, 3) };
    });
    const panelHeight =
        blocks.reduce((h, b) => h + 54 + b.lines.length * 50 + 24, 0) + 24;
    if (blocks.length) {
        ctx.fillStyle = D.card;
        ctx.beginPath();
        ctx.roundRect(pad, y, inner, panelHeight, 24);
        ctx.fill();
        let by = y + 60;
        for (const block of blocks) {
            ctx.fillStyle = D.muted;
            ctx.font = `700 26px ${font}`;
            ctx.fillText(block.label, pad + 32, by);
            by += 50;
            ctx.fillStyle = D.soft;
            ctx.font = `500 38px ${font}`;
            for (const line of block.lines) {
                ctx.fillText(line, pad + 32, by);
                by += 50;
            }
            by += 24;
        }
        y += panelHeight + 32;
    }

    // Статистика й QR.
    const stats = [
        [tr('Нагороди'), `${game.badges.earned}/${game.badges.total}`],
        ...(game.season
            ? [[tr('Сезон'), `${game.season.level}/${game.season.max}`]]
            : []),
        [tr('У GameCon з'), String(game.since)],
    ];
    const statsY = Math.max(y, 1350 - pad - 210);
    stats.forEach(([label, value], i) => {
        const x = pad + i * 210;
        ctx.fillStyle = D.text;
        ctx.font = `800 54px ${font}`;
        ctx.fillText(value, x, statsY + 90);
        ctx.fillStyle = D.muted;
        ctx.font = `600 26px ${font}`;
        ctx.fillText(label, x, statsY + 132);
    });
    const qrImage = await loadImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`,
    );
    if (qrImage) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(1080 - pad - 200, statsY, 200, 200, 20);
        ctx.fill();
        ctx.drawImage(qrImage, 1080 - pad - 190, statsY + 10, 180, 180);
    }
    ctx.fillStyle = D.muted;
    ctx.font = `500 24px ${font}`;
    ctx.fillText(url.replace(/^https?:\/\//, ''), pad, statsY + 190);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="font-display text-xl font-bold text-white tabular-nums">
                {value}
            </div>
            <div className="text-xs leading-snug text-white/50">{label}</div>
        </div>
    );
}

/** Game Card: картка гравця — переглянути, зберегти картинкою, поділитися. Кнопки — кольорів Discord. */
export default function ProfileCard({
    profile,
    game,
    url,
    qr,
}: {
    profile: UserCard;
    game: Game;
    url: string;
    qr: string;
}) {
    const [busy, setBusy] = useState(false);
    const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

    const save = async (share: boolean) => {
        setBusy(true);
        try {
            const blob = await drawCard(profile, game, qr, url);
            if (!blob) throw new Error('canvas');
            const file = new File([blob], `gamecard-${profile.username}.png`, {
                type: 'image/png',
            });
            if (share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: profile.name,
                    url,
                });
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = file.name;
                link.click();
                URL.revokeObjectURL(link.href);
            }
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
                toast.error(tr('Не вдалося зберегти картку.'));
            }
        } finally {
            setBusy(false);
        }
    };

    const facts = [
        game.games.length > 0 && {
            icon: Gamepad2,
            label: tr('Ігри'),
            text: game.games.join(', '),
        },
        game.servers.length > 0 && {
            icon: Server,
            label: tr('Сервери'),
            text: game.servers.join(', '),
        },
        game.family && {
            icon: Crown,
            label: tr('Сім’я'),
            text: `${game.family.tag ? `[${game.family.tag}] ` : ''}${game.family.name}`,
        },
        game.clan && { icon: Swords, label: tr('Клан'), text: game.clan.name },
        game.artist && {
            icon: Music2,
            label: tr('Слухає найчастіше'),
            text: game.artist,
        },
    ].filter(Boolean) as {
        icon: typeof Crown;
        label: string;
        text: string;
    }[];

    const button =
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50';

    return (
        <>
            <Head title={tr('Game Card · {name}', { name: profile.name })} />
            <div className="mx-auto max-w-md space-y-3">
                <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(160deg,#0b1020,#050608)]">
                    <div className="h-24 bg-[linear-gradient(120deg,#1d4ed8,#2F7BFF)]" />
                    <div className="px-4 pb-4">
                        <div className="-mt-12 flex items-end justify-between gap-3">
                            <div className="rounded-full bg-[#0a0e1a] p-1.5">
                                <UserAvatar user={profile} size="xl" />
                            </div>
                            <span className="mb-1 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                                {tr('Рівень {n}', { n: game.level })}
                            </span>
                        </div>
                        <h1 className="mt-3 font-display text-2xl leading-tight font-bold break-words text-white">
                            {profile.name}
                        </h1>
                        <p className="mt-0.5 text-sm break-words text-white/55">
                            @{profile.username} · {game.title}
                        </p>

                        {facts.length > 0 && (
                            <div className="mt-4 space-y-3 rounded-[10px] bg-white/[0.05] p-3.5">
                                {facts.map(({ icon: Icon, label, text }) => (
                                    <div key={label}>
                                        <p className="flex items-center gap-1.5 text-xs font-semibold text-white/50">
                                            <Icon className="size-3.5" />
                                            {label}
                                        </p>
                                        <p className="mt-0.5 text-sm break-words text-white/85">
                                            {text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 flex items-end justify-between gap-4 rounded-[10px] bg-white/[0.05] p-3.5">
                            <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-3">
                                <Stat
                                    label={tr('Нагороди')}
                                    value={`${game.badges.earned}/${game.badges.total}`}
                                />
                                {game.season && (
                                    <Stat
                                        label={tr('Сезон')}
                                        value={`${game.season.level}/${game.season.max}`}
                                    />
                                )}
                                <Stat
                                    label={tr('У GameCon з')}
                                    value={String(game.since)}
                                />
                            </div>
                            <div
                                className="shrink-0 rounded-[6px] bg-white p-1.5 [&_svg]:size-20"
                                dangerouslySetInnerHTML={{ __html: qr }}
                            />
                        </div>
                    </div>
                </section>

                <div className="grid gap-2 sm:grid-cols-2">
                    {canShare ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void save(true)}
                            className={`${button} bg-[#5865F2] hover:bg-[#4752C4]`}
                        >
                            <Share2 className="size-4" />
                            {tr('Поділитися')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                void navigator.clipboard?.writeText(url);
                                toast.success(tr('Посилання скопійовано.'));
                            }}
                            className={`${button} bg-[#5865F2] hover:bg-[#4752C4]`}
                        >
                            <Link2 className="size-4" />
                            {tr('Скопіювати посилання')}
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void save(false)}
                        className={`${button} bg-[#4E5058] hover:bg-[#6D6F78]`}
                    >
                        <Download className="size-4" />
                        {tr('Зберегти картинкою')}
                    </button>
                    <Link
                        href={`/${profile.username}`}
                        className={`${button} bg-transparent text-white/60 hover:text-white sm:col-span-2`}
                    >
                        {tr('Відкрити профіль')}
                    </Link>
                </div>
            </div>
        </>
    );
}

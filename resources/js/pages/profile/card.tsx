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

const ACCENT = '#2F7BFF';

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
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

    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#0b1020');
    bg.addColorStop(1, '#050608');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);
    const glow = ctx.createRadialGradient(880, 160, 0, 880, 160, 620);
    glow.addColorStop(0, 'rgba(47,123,255,0.35)');
    glow.addColorStop(1, 'rgba(47,123,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1350);

    // Аватар (без аватара — ініціали на акцентному тлі).
    const avatar = profile.avatar_url
        ? await loadImage(profile.avatar_url)
        : null;
    ctx.save();
    ctx.beginPath();
    ctx.arc(170, 200, 90, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) {
        ctx.drawImage(avatar, 80, 110, 180, 180);
    } else {
        ctx.fillStyle = ACCENT;
        ctx.fillRect(80, 110, 180, 180);
        ctx.fillStyle = '#fff';
        ctx.font = `700 64px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials(profile.name), 170, 204);
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#fff';
    ctx.font = `800 64px ${font}`;
    ctx.fillText(profile.name, 300, 190, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `500 34px ${font}`;
    ctx.fillText(`@${profile.username}`, 300, 245, 700);

    // Рівень і звання.
    ctx.fillStyle = ACCENT;
    ctx.font = `800 150px ${font}`;
    ctx.fillText(String(game.level), 80, 470);
    const levelWidth = ctx.measureText(String(game.level)).width;
    ctx.fillStyle = '#fff';
    ctx.font = `700 44px ${font}`;
    ctx.fillText(tr('рівень'), 100 + levelWidth, 410);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `500 36px ${font}`;
    ctx.fillText(game.title, 100 + levelWidth, 460, 900 - levelWidth);

    let y = 580;
    const row = (label: string, value: string) => {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `600 28px ${font}`;
        ctx.fillText(label, 80, y);
        ctx.fillStyle = '#fff';
        ctx.font = `600 40px ${font}`;
        ctx.fillText(value, 80, y + 52, 920);
        y += 130;
    };
    if (game.games.length) row(tr('Ігри'), game.games.join(' · '));
    if (game.servers.length) row(tr('Сервери'), game.servers.join(' · '));
    const groups = [
        game.family
            ? `${game.family.tag ? `[${game.family.tag}] ` : ''}${game.family.name}`
            : null,
        game.clan ? game.clan.name : null,
    ].filter(Boolean);
    if (groups.length) row(tr('Сім’я й клан'), groups.join(' · '));
    if (game.artist) row(tr('Слухає найчастіше'), game.artist);

    // Нижній рядок: нагороди, сезон, рік.
    const stats = [
        [tr('Нагороди'), `${game.badges.earned}/${game.badges.total}`],
        ...(game.season
            ? [[tr('Сезон'), `${game.season.level}/${game.season.max}`]]
            : []),
        [tr('У GameCon з'), String(game.since)],
    ];
    stats.forEach(([label, value], i) => {
        const x = 80 + i * 230;
        ctx.fillStyle = '#fff';
        ctx.font = `800 52px ${font}`;
        ctx.fillText(value, x, 1180);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = `600 26px ${font}`;
        ctx.fillText(label, x, 1222);
    });

    // QR на профіль.
    const qrImage = await loadImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`,
    );
    if (qrImage) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(800, 1030, 200, 200, 18);
        ctx.fill();
        ctx.drawImage(qrImage, 810, 1040, 180, 180);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `500 24px ${font}`;
    ctx.fillText(url.replace(/^https?:\/\//, ''), 80, 1300, 900);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="font-display text-xl font-bold text-white tabular-nums">
                {value}
            </div>
            <div className="truncate text-xs text-white/45">{label}</div>
        </div>
    );
}

/** Game Card: картка гравця з QR на профіль — переглянути, зберегти картинкою, поділитися. */
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
            text: game.games.join(' · '),
        },
        game.servers.length > 0 && {
            icon: Server,
            text: game.servers.join(' · '),
        },
        game.family && {
            icon: Crown,
            text: `${game.family.tag ? `[${game.family.tag}] ` : ''}${game.family.name}`,
        },
        game.clan && { icon: Swords, text: game.clan.name },
        game.artist && {
            icon: Music2,
            text: tr('Слухає найчастіше: {artist}', { artist: game.artist }),
        },
    ].filter(Boolean) as { icon: typeof Crown; text: string }[];

    return (
        <>
            <Head title={tr('Game Card · {name}', { name: profile.name })} />
            <div className="mx-auto max-w-md space-y-4">
                <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(160deg,#0b1020,#050608)] p-6">
                    <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/25 blur-3xl" />
                    <div className="relative flex items-center gap-4">
                        <UserAvatar user={profile} size="xl" />
                        <div className="min-w-0">
                            <h1 className="truncate font-display text-2xl font-bold text-white">
                                {profile.name}
                            </h1>
                            <p className="truncate text-sm text-white/50">
                                @{profile.username}
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-6 flex items-end gap-3">
                        <span className="font-display text-6xl leading-none font-black text-primary tabular-nums">
                            {game.level}
                        </span>
                        <div className="pb-1">
                            <div className="text-sm font-semibold text-white">
                                {tr('рівень')}
                            </div>
                            <div className="text-sm text-white/55">
                                {game.title}
                            </div>
                        </div>
                    </div>

                    {facts.length > 0 && (
                        <div className="relative mt-5 space-y-2.5 text-sm">
                            {facts.map(({ icon: Icon, text }) => (
                                <p
                                    key={text}
                                    className="flex items-start gap-2 text-white/80"
                                >
                                    <Icon className="mt-0.5 size-4 shrink-0 text-white/45" />
                                    {text}
                                </p>
                            ))}
                        </div>
                    )}

                    <div className="relative mt-6 flex items-end justify-between gap-4 border-t border-white/[0.08] pt-5">
                        <div className="grid flex-1 grid-cols-3 gap-3">
                            <Stat
                                label={tr('Нагороди')}
                                value={`${game.badges.earned}/${game.badges.total}`}
                            />
                            {game.season ? (
                                <Stat
                                    label={tr('Сезон')}
                                    value={`${game.season.level}/${game.season.max}`}
                                />
                            ) : (
                                <span />
                            )}
                            <Stat
                                label={tr('У GameCon з')}
                                value={String(game.since)}
                            />
                        </div>
                        <div
                            className="shrink-0 rounded-[8px] bg-white p-1.5 [&_svg]:size-20"
                            dangerouslySetInnerHTML={{ __html: qr }}
                        />
                    </div>
                </section>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void save(false)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-white/[0.08] text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-50"
                    >
                        <Download className="size-4" />
                        {tr('Зберегти картинкою')}
                    </button>
                    {canShare ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void save(true)}
                            className="btn-glow inline-flex h-11 items-center justify-center gap-2 rounded-control text-sm font-semibold disabled:opacity-50"
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
                            className="btn-glow inline-flex h-11 items-center justify-center gap-2 rounded-control text-sm font-semibold"
                        >
                            <Link2 className="size-4" />
                            {tr('Посилання')}
                        </button>
                    )}
                </div>
                <p className="text-center">
                    <Link
                        href={`/${profile.username}`}
                        className="text-sm text-white/60 hover:text-white"
                    >
                        {tr('Відкрити профіль')}
                    </Link>
                </p>
            </div>
        </>
    );
}

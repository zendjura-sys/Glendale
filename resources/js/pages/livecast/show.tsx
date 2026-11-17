import { Head, Link } from "@inertiajs/react";
import {
    ArrowLeft,
    ExternalLink,
    Gift,
    HeartHandshake,
    Loader2,
    LogOut,
    Radio,
    Send,
    Users,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/gc/user-avatar";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { joinBroadcast, leaveVoice, useVoice } from "@/lib/voice";
import type { LiveCastCard, LiveCastDonation } from "@/pages/livecast/index";
import type { UserCard } from "@/types";

type StreamGift = { key: string; emoji: string; label: string };

type ChatMsg = {
    id: number;
    kind: string;
    gift_key: string | null;
    gift: StreamGift | null;
    meta?: {
        provider?: string;
        donor?: string;
        amount?: number;
        currency?: string;
        message?: string;
    } | null;
    body: string;
    created_at: string | null;
    user: UserCard | null;
};

type State = {
    broadcast: LiveCastCard & { ended_at?: string | null };
    messages: ChatMsg[];
    gifts: StreamGift[];
    me: { is_host: boolean; can_publish: boolean } | null;
    can_manage: boolean;
    go_live_on_app?: boolean;
};

/** Сторінка стріму на сайті: перегляд, чат, подарунки, донати. Без виходу в ефір. */
export default function LiveCastShow(initial: State) {
    const [state, setState] = useState<State>(initial);
    const [text, setText] = useState("");
    const [giftBusy, setGiftBusy] = useState<string | null>(null);
    const voice = useVoice();
    const chatEnd = useRef<HTMLDivElement>(null);
    const { broadcast: stream } = state;
    const inStream =
        voice.kind === "broadcast" &&
        voice.roomId === stream.id &&
        voice.status !== "idle";
    const gifts = state.gifts?.length
        ? state.gifts
        : [
              { key: "rose", emoji: "🌹", label: tr("Троянда") },
              { key: "fire", emoji: "🔥", label: tr("Вогонь") },
              { key: "heart", emoji: "💜", label: tr("Серце") },
              { key: "gg", emoji: "🎮", label: "GG" },
          ];
    const donations: LiveCastDonation[] = stream.donations ?? [];

    const refresh = useCallback(async () => {
        try {
            setState(await api<State>("GET", `/livecast/${stream.id}/state`));
        } catch {
            // Мережа — наступне опитування.
        }
    }, [stream.id]);

    useEffect(() => {
        const ms = stream.status === "live" ? 2500 : 15000;
        const id = window.setInterval(refresh, ms);

        return () => window.clearInterval(id);
    }, [refresh, stream.status]);

    useEffect(() => {
        if (stream.status === "ended" && inStream) void leaveVoice();
    }, [stream.status, inStream]);

    useEffect(() => {
        chatEnd.current?.scrollIntoView({ behavior: "smooth" });
    }, [state.messages.length]);

    const connect = async () => {
        try {
            await joinBroadcast({ id: stream.id, title: stream.title });
        } catch (e) {
            toast.error(
                e instanceof ApiError
                    ? e.message
                    : tr("Не вдалося підключитись"),
            );
        }
    };

    const send = async (e: FormEvent) => {
        e.preventDefault();
        const body = text.trim();
        if (!body) return;
        setText("");
        try {
            setState(
                await api<State>("POST", `/livecast/${stream.id}/messages`, {
                    body,
                }),
            );
        } catch (err) {
            toast.error(
                err instanceof ApiError ? err.message : tr("Не вдалося"),
            );
            setText(body);
        }
    };

    const sendGift = async (key: string) => {
        setGiftBusy(key);
        try {
            setState(
                await api<State>("POST", `/livecast/${stream.id}/gifts`, {
                    gift: key,
                }),
            );
        } catch (err) {
            toast.error(
                err instanceof ApiError ? err.message : tr("Не вдалося"),
            );
        } finally {
            setGiftBusy(null);
        }
    };

    const primary = voice.videos.find((v) => v.screen) ?? voice.videos[0];

    return (
        <>
            <Head title={`${stream.title} · LiveCast`} />
            <div className="mx-auto grid w-full max-w-6xl gap-3 px-1 py-2 pb-28 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                        <Link
                            href="/livecast"
                            aria-label={tr("До LiveCast")}
                            className="grid size-10 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06]"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        {stream.status === "live" && (
                            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-xs font-bold text-white">
                                LIVE
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-sm text-white/55">
                            <Users className="size-4" />
                            {stream.viewers}
                        </span>
                        <span className="ml-auto text-xs font-semibold text-white/40">
                            LiveCast
                        </span>
                    </div>

                    <div className="gc-solid overflow-hidden rounded-3xl">
                        <div className="relative aspect-video bg-black/70">
                            {primary ? (
                                <VideoMount tile={primary} />
                            ) : (
                                <div className="absolute inset-0 grid place-items-center text-white/50">
                                    <p className="text-sm">
                                        {inStream
                                            ? tr("Очікування відео…")
                                            : tr("Підключіться, щоб дивитись")}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3 p-4 sm:p-5">
                            <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                                {stream.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3">
                                {stream.host && (
                                    <Link
                                        href={`/${stream.host.username}`}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline"
                                    >
                                        <UserAvatar
                                            user={stream.host}
                                            size="sm"
                                        />
                                        {stream.host.name}
                                    </Link>
                                )}
                                {stream.category && (
                                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60">
                                        {stream.category}
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {!inStream && stream.status === "live" && (
                                    <button
                                        type="button"
                                        onClick={() => void connect()}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white"
                                    >
                                        {voice.status === "connecting" ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Radio className="size-4" />
                                        )}
                                        {tr("Дивитись")}
                                    </button>
                                )}
                                {inStream && (
                                    <button
                                        type="button"
                                        onClick={() => void leaveVoice()}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white"
                                    >
                                        <LogOut className="size-4" />
                                        {tr("Вийти")}
                                    </button>
                                )}
                                {state.me?.is_host &&
                                    !state.me.can_publish &&
                                    stream.status === "live" && (
                                        <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-xs text-white/55">
                                            {tr(
                                                "Вихід в ефір — у застосунку GameCon",
                                            )}
                                        </span>
                                    )}
                            </div>

                            {donations.length > 0 && (
                                <div className="space-y-2 border-t border-white/10 pt-3">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/45 uppercase">
                                        <HeartHandshake className="size-3.5" />
                                        {tr("Підтримати стрім")}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {donations.map((d) => (
                                            <a
                                                key={`${d.provider}-${d.url}`}
                                                href={d.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25"
                                            >
                                                {d.name}
                                                <ExternalLink className="size-3.5 opacity-70" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {stream.status === "ended" && (
                                <p className="text-sm text-white/55">
                                    {tr("Стрім завершено · пік глядачів: {n}", {
                                        n: stream.peak_viewers,
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <aside className="gc-solid flex h-[min(70vh,640px)] flex-col rounded-3xl p-3">
                    <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-white/45 uppercase">
                        {tr("Чат стріму")}
                    </p>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
                        {state.messages.length === 0 && (
                            <p className="py-6 text-center text-sm text-white/40">
                                {tr("Поки тихо — напишіть першим")}
                            </p>
                        )}
                        {state.messages.map((m) => (
                            <div
                                key={m.id}
                                className={cn(
                                    "flex gap-2 text-sm",
                                    m.kind === "gift" &&
                                        "rounded-xl bg-rose-500/10 px-2 py-1.5",
                                    m.kind === "donation" &&
                                        "rounded-xl bg-emerald-500/15 px-2 py-1.5",
                                )}
                            >
                                {m.user ? (
                                    <UserAvatar
                                        user={m.user}
                                        size="xs"
                                        className="mt-0.5 shrink-0"
                                    />
                                ) : (
                                    <div className="mt-0.5 size-7 shrink-0 rounded-full bg-white/10" />
                                )}
                                <div className="min-w-0">
                                    {m.kind === "donation" ? (
                                        <span className="break-words font-semibold text-emerald-200">
                                            {m.body}
                                        </span>
                                    ) : (
                                        <>
                                            <span className="font-semibold text-white/80">
                                                {m.user?.name ?? "…"}
                                            </span>{" "}
                                            {m.kind === "gift" && m.gift ? (
                                                <span className="font-semibold text-rose-200">
                                                    {m.gift.emoji}{" "}
                                                    {m.gift.label}
                                                </span>
                                            ) : (
                                                <span className="break-words text-white/70">
                                                    {m.body}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEnd} />
                    </div>
                    {stream.status === "live" && (
                        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                                {gifts.map((g) => (
                                    <button
                                        key={g.key}
                                        type="button"
                                        disabled={giftBusy === g.key}
                                        title={g.label}
                                        onClick={() => void sendGift(g.key)}
                                        className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg hover:bg-white/12 disabled:opacity-50"
                                    >
                                        {giftBusy === g.key ? (
                                            <Loader2 className="size-4 animate-spin text-white/70" />
                                        ) : (
                                            g.emoji
                                        )}
                                    </button>
                                ))}
                                <span className="ml-1 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-white/35 uppercase">
                                    <Gift className="size-3" />
                                    {tr("Подарунки")}
                                </span>
                            </div>
                            <form onSubmit={send} className="flex gap-2">
                                <Input
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    maxLength={280}
                                    placeholder={tr("Повідомлення…")}
                                    className="flex-1"
                                />
                                <button
                                    type="submit"
                                    aria-label={tr("Надіслати")}
                                    className="grid size-10 place-items-center rounded-xl bg-white/[0.08] text-white hover:bg-white/15"
                                >
                                    <Send className="size-4" />
                                </button>
                            </form>
                        </div>
                    )}
                </aside>
            </div>
        </>
    );
}

function VideoMount({
    tile,
}: {
    tile: {
        id: string;
        el: HTMLVideoElement;
        local: boolean;
        screen: boolean;
        name: string;
    };
}) {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = host.current;
        if (!node) return;
        node.replaceChildren(tile.el);
        void tile.el.play().catch(() => undefined);

        return () => {
            if (tile.el.parentElement === node) node.removeChild(tile.el);
        };
    }, [tile.el, tile.id]);

    return (
        <div className="relative h-full w-full">
            <div
                ref={host}
                className="absolute inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-contain"
            />
        </div>
    );
}

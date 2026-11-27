import {
    Bell,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    MapPin,
    Trash2,
    Users,
    X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
    Button,
    Card,
    Cover,
    Loading,
    Masonry,
    PageHeader,
    Select,
    StatTile,
    Tabs,
    useAction,
    useSite,
    useToast,
} from "@/components/kit";
import { hasPage } from "@/pages";
import { useNav } from "@/lib/nav";

type Ev = {
    key: string;
    kind: "family" | "clan" | "server" | "game";
    id: number;
    title: string;
    type_label: string;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
    all_day: boolean;
    where: { name: string; url: string };
    status: "going" | "declined" | null;
    going_count: number;
    can_decline: boolean;
    rsvp_url: string;
    image: string | null;
    host?: string | null;
    url: string | null;
    can_delete?: boolean;
    delete_url?: string;
    games?: { name: string; url: string }[];
};
type Page = {
    events: Ev[];
    kind: string | null;
    kinds: Record<string, string>;
    reminder_lead: number;
    reminder_leads: number[];
    feed_url: string | null;
};

const KIND_TONE: Record<string, string> = {
    family: "bg-violet-400",
    clan: "bg-amber-400",
    server: "bg-emerald-400",
    game: "bg-neon-cyan",
};
const dayKey = (d: Date): string =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const leadLabel = (m: number): string =>
    m >= 1440 ? `${m / 1440} доба` : m >= 60 ? `${m / 60} год` : `${m} хв`;
const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** «Події»: усі події сімей, кланів, серверів та ігор в одному календарі — з «піду», нагадуваннями й релізами. */
export function EventsPage() {
    const [tab, setTab] = useState<"mine" | "releases">("mine");
    const [kind, setKind] = useState("");
    const page = useSite<Page>(`/events${kind ? `?kind=${kind}` : ""}`);
    const releases = useSite<{ events: Ev[] }>(
        tab === "releases" ? "/events/releases" : null,
    );
    const { run } = useAction();
    const toast = useToast();
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [day, setDay] = useState<string | null>(null);
    const list =
        (tab === "mine" ? page.data?.events : releases.data?.events) ?? [];
    const byDay = useMemo(() => {
        const map = new Map<string, Ev[]>();
        for (const e of list) {
            const k = dayKey(new Date(e.starts_at));
            map.set(k, [...(map.get(k) ?? []), e]);
        }
        return map;
    }, [list]);
    if (!page.data) return <Loading error={page.error} />;
    const d = page.data;
    const shown = day ? (byDay.get(day) ?? []) : list;
    const groups = new Map<string, Ev[]>();
    for (const e of shown) {
        const label = new Date(e.starts_at).toLocaleDateString("uk-UA", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });
        groups.set(label, [...(groups.get(label) ?? []), e]);
    }
    const reload = async (): Promise<void> => {
        await page.reload();
        if (tab === "releases") await releases.reload();
    };
    const going = list.filter((e) => e.status === "going").length;
    const week = list.filter(
        (e) => new Date(e.starts_at).getTime() - Date.now() < 7 * 86400e3,
    ).length;
    return (
        <div className="flex h-full flex-col">
            <PageHeader
                title="Події"
                subtitle="Сім’ї, клани, сервери й ігри в одному календарі"
            />
            <Tabs
                tabs={[
                    {
                        id: "mine",
                        label: "Мій календар",
                        badge: d.events.length || null,
                    },
                    { id: "releases", label: "Релізи ігор" },
                ]}
                value={tab}
                onChange={(t) => (setTab(t), setDay(null))}
            />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0 space-y-4">
                    {tab === "mine" && (
                        <div className="flex flex-wrap gap-1.5">
                            {[["", "Усі"], ...Object.entries(d.kinds)].map(
                                ([k, label]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setKind(k)}
                                        className={`flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm ring-1 transition ${kind === k ? "bg-white/10 text-white ring-white/25" : "text-white/60 ring-white/10 hover:bg-white/5"}`}
                                    >
                                        {k && (
                                            <span
                                                className={`size-2 rounded-full ${KIND_TONE[k]}`}
                                            />
                                        )}
                                        {label}
                                    </button>
                                ),
                            )}
                        </div>
                    )}
                    {day && (
                        <button
                            type="button"
                            onClick={() => setDay(null)}
                            className="flex items-center gap-1.5 text-sm text-neon-cyan"
                        >
                            <X size={14} /> Показати всі дні
                        </button>
                    )}
                    {tab === "releases" && !releases.data && (
                        <Loading error={releases.error} />
                    )}
                    {shown.length === 0 &&
                        (tab === "mine" || releases.data) && (
                            <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                                <CalendarDays
                                    size={36}
                                    className="mb-3 text-white/25"
                                />
                                <p className="font-semibold">
                                    {day
                                        ? "Цього дня подій немає"
                                        : "Найближчим часом подій немає"}
                                </p>
                                <p className="mt-1 max-w-sm text-sm text-white/45">
                                    Події ваших сімей, кланів, улюблених
                                    серверів та ігор зʼявляться тут автоматично
                                    — разом із нагадуваннями.
                                </p>
                            </div>
                        )}
                    <Masonry min={380}>
                        {[...groups.entries()].map(([label, items]) => (
                            <section
                                key={label}
                                className="mb-5 break-inside-avoid"
                            >
                                <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/45 uppercase">
                                    {label}
                                </h3>
                                <div className="space-y-3">
                                    {items.map((e) => (
                                        <EventCard
                                            key={e.key}
                                            e={e}
                                            onRsvp={(g) =>
                                                void run(
                                                    "POST",
                                                    e.rsvp_url,
                                                    { going: g },
                                                    g
                                                        ? "Ви йдете ✅"
                                                        : "Позначено: не піду",
                                                    reload,
                                                )
                                            }
                                            onDelete={() =>
                                                e.delete_url &&
                                                void run(
                                                    "DELETE",
                                                    e.delete_url,
                                                    undefined,
                                                    "Подію видалено.",
                                                    reload,
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </Masonry>
                </div>
                <aside className="space-y-4">
                    <MonthGrid
                        month={month}
                        setMonth={setMonth}
                        byDay={byDay}
                        day={day}
                        setDay={setDay}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Цього тижня" value={week} accent />
                        <StatTile label="Я йду" value={going} />
                    </div>
                    <Card
                        title={
                            <span className="flex items-center gap-2">
                                <Bell size={15} /> Нагадування
                            </span>
                        }
                    >
                        <p className="mb-2 text-sm text-white/55">
                            Нагадаємо про подію, на яку ви йдете, заздалегідь:
                        </p>
                        <Select
                            value={d.reminder_lead}
                            onChange={(e) =>
                                void run(
                                    "PUT",
                                    "/events/reminder",
                                    { lead: Number(e.target.value) },
                                    "Нагадування збережено.",
                                    page.reload,
                                )
                            }
                        >
                            {d.reminder_leads.map((m) => (
                                <option key={m} value={m}>
                                    за {leadLabel(m)}
                                </option>
                            ))}
                        </Select>
                    </Card>
                    {d.feed_url && (
                        <Card title="Календар телефона">
                            <p className="mb-3 text-sm text-white/55">
                                Додайте посилання в Google чи Apple Календар —
                                події підтягуватимуться самі.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    small
                                    onClick={() =>
                                        void navigator.clipboard
                                            .writeText(d.feed_url!)
                                            .then(() =>
                                                toast("Посилання скопійовано."),
                                            )
                                    }
                                >
                                    <Copy size={14} /> Копіювати
                                </Button>
                                <Button
                                    small
                                    onClick={() =>
                                        void run(
                                            "POST",
                                            "/events/feed/reset",
                                            undefined,
                                            "Посилання календаря оновлено — старе більше не працює.",
                                            page.reload,
                                        )
                                    }
                                >
                                    Нове посилання
                                </Button>
                            </div>
                        </Card>
                    )}
                </aside>
            </div>
        </div>
    );
}

function EventCard({
    e,
    onRsvp,
    onDelete,
}: {
    e: Ev;
    onRsvp: (going: boolean) => void;
    onDelete: () => void;
}) {
    const nav = useNav();
    const at = new Date(e.starts_at);
    const where = e.where.url.split("?")[0];
    return (
        <div className="flex overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
            <div className="relative w-24 shrink-0">
                {e.image ? (
                    <Cover src={e.image} className="h-full w-full" />
                ) : (
                    <div className="grid h-full place-items-center bg-gradient-to-b from-white/[0.06] to-transparent text-center">
                        <div>
                            <p className="text-2xl leading-none font-black">
                                {at.getDate()}
                            </p>
                            <p className="text-[11px] text-white/50 uppercase">
                                {at.toLocaleDateString("uk-UA", {
                                    month: "short",
                                })}
                            </p>
                        </div>
                    </div>
                )}
                <span
                    className={`absolute top-0 left-0 h-full w-1 ${KIND_TONE[e.kind]}`}
                />
            </div>
            <div className="min-w-0 flex-1 p-3">
                <p className="text-[11px] text-white/45">
                    {e.all_day
                        ? "Увесь день"
                        : at.toLocaleTimeString("uk-UA", {
                              hour: "2-digit",
                              minute: "2-digit",
                          })}{" "}
                    · {e.type_label}
                    {e.host ? ` · ${e.host}` : ""}
                </p>
                <p className="truncate font-semibold">{e.title}</p>
                <button
                    type="button"
                    disabled={!hasPage(where)}
                    onClick={() => nav.go(e.where.url)}
                    className="flex max-w-full items-center gap-1 truncate text-xs text-white/55 enabled:hover:text-neon-cyan"
                >
                    <MapPin size={11} /> {e.where.name}
                </button>
                {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-white/50">
                        {e.description}
                    </p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onRsvp(e.status !== "going")}
                        className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ${e.status === "going" ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/40" : "ring-white/15 hover:bg-white/5"}`}
                    >
                        <Check size={13} />{" "}
                        {e.status === "going" ? "Я йду" : "Піду"}
                    </button>
                    {e.can_decline && e.status !== "declined" && (
                        <button
                            type="button"
                            onClick={() => onRsvp(false)}
                            className="h-8 rounded-lg px-2.5 text-xs text-white/50 ring-1 ring-white/10 hover:bg-white/5"
                        >
                            Не піду
                        </button>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-xs text-white/45">
                        <Users size={12} /> {e.going_count}
                    </span>
                    {e.can_delete && (
                        <button
                            type="button"
                            title="Видалити"
                            onClick={onDelete}
                            className="grid size-8 place-items-center rounded-lg text-white/40 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function MonthGrid({
    month,
    setMonth,
    byDay,
    day,
    setDay,
}: {
    month: Date;
    setMonth: (d: Date) => void;
    byDay: Map<string, Ev[]>;
    day: string | null;
    setDay: (d: string | null) => void;
}) {
    const start = (month.getDay() + 6) % 7;
    const days = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0,
    ).getDate();
    const today = dayKey(new Date());
    const cells = [
        ...Array.from({ length: start }, () => null),
        ...Array.from(
            { length: days },
            (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
        ),
    ];
    return (
        <Card>
            <div className="mb-3 flex items-center">
                <p className="flex-1 font-semibold capitalize">
                    {month.toLocaleDateString("uk-UA", {
                        month: "long",
                        year: "numeric",
                    })}
                </p>
                <button
                    type="button"
                    onClick={() =>
                        setMonth(
                            new Date(
                                month.getFullYear(),
                                month.getMonth() - 1,
                                1,
                            ),
                        )
                    }
                    className="grid size-8 place-items-center rounded-lg hover:bg-white/5"
                >
                    <ChevronLeft size={16} />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        setMonth(
                            new Date(
                                month.getFullYear(),
                                month.getMonth() + 1,
                                1,
                            ),
                        )
                    }
                    className="grid size-8 place-items-center rounded-lg hover:bg-white/5"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/40">
                {WEEK.map((w) => (
                    <span key={w}>{w}</span>
                ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((c, i) => {
                    if (!c) return <span key={i} />;
                    const k = dayKey(c);
                    const items = byDay.get(k) ?? [];
                    return (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setDay(day === k ? null : k)}
                            className={`relative grid aspect-square place-items-center rounded-lg text-sm transition ${day === k ? "bg-neon-cyan/20 ring-1 ring-neon-cyan/60" : k === today ? "bg-white/10" : "hover:bg-white/5"} ${items.length ? "font-semibold" : "text-white/55"}`}
                        >
                            {c.getDate()}
                            {items.length > 0 && (
                                <span className="absolute bottom-1 flex gap-0.5">
                                    {[...new Set(items.map((e) => e.kind))]
                                        .slice(0, 3)
                                        .map((kd) => (
                                            <span
                                                key={kd}
                                                className={`size-1 rounded-full ${KIND_TONE[kd]}`}
                                            />
                                        ))}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}

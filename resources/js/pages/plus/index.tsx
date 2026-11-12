import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { m, useReducedMotion } from 'motion/react';
import {
    Check,
    Gift,
    Image as ImageIcon,
    Layers,
    Megaphone,
    Palette,
    Phone,
    Shield,
    Sparkles,
    Tag,
    Ticket,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { PlusTabs } from '@/components/billing/plus-tabs';
import { FamilyLogo } from '@/components/families/family-logo';
import { PlusBadge, plusNameProps } from '@/components/gc/plus';
import { titleColor, UserTitle } from '@/components/gc/user-title';
import { UserAvatar } from '@/components/gc/user-avatar';
import { perPeriod, periodLabel, useKind } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { buyProduct, PRODUCT_LABELS } from '@/lib/plus';
import { cn } from '@/lib/utils';
import { GiftCardArt, GIFT_THEMES } from '@/components/plus/gift-card';
import type { GiftTheme } from '@/components/plus/gift-card';
import type { FamilyCard, PlusMark } from '@/types';

type State = {
    active: boolean;
    until: string | null;
    /** Автопродовження збереженою карткою (Білінг). */
    renewal: {
        id: number;
        product: string;
        payer_id: number;
        failed: boolean;
    } | null;
};

type Style = {
    name?: string;
    frame?: string;
    motion?: string;
    theme?: string;
    accent?: string;
    fx?: string;
    header?: string;
};

type Props = {
    state: State;
    style: Style;
    options: {
        names: Record<string, string[]>;
        frames: Record<string, string[]>;
        accents: Record<string, string[]>;
        effects: string[];
        headers: string[];
        motions?: string[];
        themes?: Record<string, string[]>;
    };
    products: Record<string, { available: boolean }>;
    families: (FamilyCard & { state: State; style: Style })[];
    title: {
        name: string | null;
        color: string;
        next_change: string | null;
        colors: string[];
    };
    trial?: { days: number; available: boolean; used: boolean };
    friends?: { username: string; name: string; avatar_url: string | null }[];
    sent_gifts?: {
        id: number;
        days: number;
        status: 'scheduled' | 'delivered';
        deliver_at: string | null;
        delivered_at: string | null;
        recipient: { name: string; username: string } | null;
    }[];
    payments: {
        id: number;
        product: string;
        amount: number;
        currency: string;
        status: string;
        receipt_url: string | null;
        created_at: string;
    }[];
};

const PERKS = (): { icon: LucideIcon; title: string; text: string }[] => [
    {
        icon: Sparkles,
        title: tr('Значок і колір ніку'),
        text: tr(
            'Позначка GameCon+ біля імені всюди на сайті, 8 кольорів і 3 градієнти ніку.',
        ),
    },
    {
        icon: ImageIcon,
        title: tr('Анімований профіль'),
        text: tr(
            'GIF-аватар і GIF-обкладинка, рамка аватара (сезонна змінюється щомісяця), власні кольори сторінки.',
        ),
    },
    {
        icon: Layers,
        title: tr('Більше місця'),
        text: tr(
            'До 25 персонажів RP і 20 фото в кожного, 3 закріплені записи, файли в чатах до 200 МБ, 5 оголошень у «Пошук паті».',
        ),
    },
    {
        icon: Users,
        title: tr('Увага й зручність'),
        text: tr(
            'Раз на добу — підняти своє паті нагору на годину. Набори стікерів GameCon+ і ще 5 реакцій.',
        ),
    },
    {
        icon: Shield,
        title: tr('Чесно для всіх'),
        text: tr(
            'Бонусне 4-те завдання дня дає досвід у рівень, але не очки сезону — рейтинг лишається чесним.',
        ),
    },
];

const btn =
    'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-40';
const primary = cn(btn, 'bg-primary text-white hover:opacity-90');
const secondary = cn(btn, 'gc-solid-2 text-white/85 hover:bg-white/10');

export default function PlusPage({
    state,
    style,
    options,
    families,
    payments,
    title,
    friends,
    sent_gifts,
    trial,
}: Props) {
    const plans = useKind('plus');
    const user = usePage().props.auth.user;
    const busy: string | null = null;
    const buy = (
        product: string,
        extra: Record<string, string | number> = {},
    ) => buyProduct(product, extra);

    return (
        <>
            <Head title="GameCon+" />
            <div className="mx-auto max-w-4xl space-y-5">
                <PlusTabs current="plus" />
                <section className="gc-solid rounded-2xl p-5 sm:p-7">
                    <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-white sm:text-3xl">
                        <PlusBadge className="size-7 rounded-lg [&_svg]:size-5" />
                        GameCon+
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-white/60">
                        {tr(
                            'Підтримайте GameCon і отримайте оформлення, більше місця й зручності. Усе, що вже безкоштовне, лишається безкоштовним.',
                        )}
                    </p>
                    {state.active && (
                        <div className="gc-solid-2 mt-3 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
                            <Check className="size-5 text-emerald-300" />
                            <span className="text-sm text-white">
                                {state.until
                                    ? tr('GameCon+ активний до {date}', {
                                          date: formatDate(state.until),
                                      })
                                    : tr('GameCon+ активний')}
                                <span
                                    className={cn(
                                        state.renewal?.failed
                                            ? 'text-amber-200'
                                            : 'text-white/50',
                                    )}
                                >
                                    {' · '}
                                    {state.renewal
                                        ? state.renewal.failed
                                            ? tr(
                                                  'автопродовження не вдалося — перевірте картку',
                                              )
                                            : tr('автопродовження карткою')
                                        : tr('без автопродовження')}
                                </span>
                            </span>
                        </div>
                    )}

                    {trial?.available && !state.active && (
                        <TrialOffer days={trial.days} />
                    )}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {plans.map(([product, plan], i) => (
                            <div
                                key={product}
                                className={cn(
                                    'flex flex-col gap-3 rounded-2xl p-4',
                                    plan.badge ||
                                        (plans.length > 1 &&
                                            i === plans.length - 1)
                                        ? 'border-indigo-400/40 bg-indigo-500/[0.07]'
                                        : 'gc-solid-2',
                                )}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-semibold text-white">
                                        {periodLabel(plan)}
                                    </span>
                                    {plan.badge && (
                                        <span className="rounded-chip bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">
                                            {plan.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="font-display text-3xl font-bold text-white">
                                    {plan.old_price && (
                                        <span className="mr-2 text-lg text-white/35 line-through">
                                            {plan.old_price.toLocaleString(
                                                'uk-UA',
                                            )}
                                        </span>
                                    )}
                                    {plan.price.toLocaleString('uk-UA')} ₴
                                    <span className="ml-1 text-sm font-medium text-white/45">
                                        {perPeriod(plan.days)}
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    className={primary}
                                    onClick={() => buy(product)}
                                >
                                    {state.active
                                        ? tr('Продовжити')
                                        : tr('Оформити')}
                                </button>
                            </div>
                        ))}
                        {plans.length === 0 && (
                            <p className="text-sm text-white/45">
                                {tr('Зараз GameCon+ не продається.')}
                            </p>
                        )}
                    </div>
                    <p className="mt-3 text-xs text-white/40">
                        {tr(
                            'Оплата карткою Visa / Mastercard, Apple Pay чи Google Pay через monobank. Автопродовження вмикаєте ви самі: ціна списується зі збереженої картки за добу до кінця періоду, вимкнути можна будь-коли в «Оплата й підписки». Дні нової покупки додаються після чинного періоду. Повернення — див. «Повернення коштів».',
                        )}
                    </p>
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                    {PERKS().map(({ icon: Icon, title, text }) => (
                        <div key={title} className="gc-solid rounded-2xl p-5">
                            <span className="flex items-center gap-2 font-semibold text-white">
                                <Icon className="size-4 text-indigo-300" />
                                {title}
                            </span>
                            <p className="mt-1.5 text-sm text-white/55">
                                {text}
                            </p>
                        </div>
                    ))}
                </section>

                {state.active && user && (
                    <StyleEditor
                        style={style}
                        options={options}
                        preview={user}
                    />
                )}

                {state.active && <TitleForm title={title} />}

                <GiftForm
                    buy={buy}
                    busy={busy}
                    friends={friends ?? []}
                    sent={sent_gifts ?? []}
                />
                <RedeemForm />

                <FamilyPlans
                    families={families}
                    options={options}
                    buy={buy}
                    busy={busy}
                    plus={state.active}
                />

                <OtherPurchases />

                {payments.length > 0 && (
                    <section className="gc-solid rounded-2xl p-5">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Історія оплат')}
                        </h2>
                        <ul className="mt-3 divide-y divide-white/[0.06]">
                            {payments.map((p) => (
                                <li
                                    key={p.id}
                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                                >
                                    <span className="min-w-0 flex-1 text-white">
                                        {PRODUCT_LABELS()[p.product] ??
                                            p.product}
                                    </span>
                                    <span className="text-white/45">
                                        {formatDate(p.created_at)}
                                    </span>
                                    <span className="text-white/80 tabular-nums">
                                        {(p.amount / 100).toFixed(2)}{' '}
                                        {p.currency}
                                    </span>
                                    {p.status === 'refunded' && (
                                        <span className="text-xs text-amber-200">
                                            {tr('Повернено')}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </>
    );
}

function Swatch({
    colors,
    active,
    onClick,
    label,
    round = false,
}: {
    colors: string[];
    active: boolean;
    onClick: () => void;
    label: string;
    round?: boolean;
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'size-9 shrink-0 border-2 transition',
                round ? 'rounded-full' : 'rounded-xl',
                active
                    ? 'border-white'
                    : 'border-transparent hover:border-white/40',
            )}
            style={{
                backgroundImage: colors.length
                    ? `linear-gradient(135deg, ${colors.length === 1 ? `${colors[0]}, ${colors[0]}` : colors.join(', ')})`
                    : 'conic-gradient(#22d3ee, #6366f1, #f472b6, #f59e0b, #22d3ee)',
            }}
        />
    );
}

function StyleEditor({
    style,
    options,
    preview,
}: {
    style: Style;
    options: Props['options'];
    preview: { name: string; avatar_url: string | null; id: number };
}) {
    const form = useForm<Style>({
        name: style.name ?? '',
        frame: style.frame ?? '',
        accent: style.accent ?? '',
        fx: style.fx ?? '',
        header: style.header ?? '',
        motion: style.motion ?? '',
        theme: style.theme ?? '',
    });
    const mark = {
        name: form.data.name ? (options.names[form.data.name] ?? null) : null,
        frame: form.data.frame
            ? (options.frames[form.data.frame] ?? null)
            : null,
        fx: (form.data.fx || null) as PlusMark['fx'],
        motion: (form.data.motion || null) as PlusMark['motion'],
    };
    const nameProps = plusNameProps(mark);
    const accentColors = (form.data.theme &&
        options.themes?.[form.data.theme]) ||
        (form.data.accent && options.accents[form.data.accent]) || [
            '#6366f1',
            '#a855f7',
            '#22d3ee',
        ];
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/plus/style', { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="gc-solid space-y-4 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Palette className="size-5 text-indigo-300" />
                {tr('Оформлення')}
            </h2>
            <div className="gc-solid-2 flex items-center gap-3 rounded-2xl p-3">
                <UserAvatar user={{ ...preview, plus: mark }} size="lg" />
                <span className="flex items-center gap-1.5 font-semibold text-white">
                    <span
                        className={nameProps.className}
                        style={nameProps.style}
                    >
                        {preview.name}
                    </span>
                    <PlusBadge />
                </span>
            </div>
            <div>
                <p className="mb-2 text-sm text-white/60">{tr('Колір ніку')}</p>
                <div className="flex flex-wrap gap-2">
                    <Swatch
                        colors={['#ffffff']}
                        active={!form.data.name}
                        onClick={() => form.setData('name', '')}
                        label={tr('Стандартний')}
                    />
                    {Object.entries(options.names).map(([key, colors]) => (
                        <Swatch
                            key={key}
                            colors={colors}
                            active={form.data.name === key}
                            onClick={() => form.setData('name', key)}
                            label={key}
                        />
                    ))}
                </div>
            </div>
            <div>
                <p className="mb-2 text-sm text-white/60">
                    {tr('Рамка аватара')}
                </p>
                <div className="flex flex-wrap gap-2">
                    <Swatch
                        colors={['#ffffff22']}
                        active={!form.data.frame}
                        onClick={() => form.setData('frame', '')}
                        label={tr('Без рамки')}
                        round
                    />
                    {Object.entries(options.frames).map(([key, colors]) => (
                        <Swatch
                            key={key}
                            colors={colors}
                            active={form.data.frame === key}
                            onClick={() => form.setData('frame', key)}
                            label={key === 'season' ? tr('Сезонна') : key}
                            round
                        />
                    ))}
                </div>
            </div>
            {form.data.frame && (options.motions ?? []).length > 0 && (
                <EffectPicker
                    label={tr('Рух рамки')}
                    value={form.data.motion ?? ''}
                    options={options.motions ?? []}
                    names={FRAME_MOTION()}
                    onChange={(value) => form.setData('motion', value)}
                />
            )}
            <EffectPicker
                label={tr('Анімація ніку')}
                value={form.data.fx ?? ''}
                options={options.effects}
                names={NAME_FX()}
                onChange={(value) => form.setData('fx', value)}
            />
            {options.themes && (
                <EffectPicker
                    label={tr('Ексклюзивна тема профілю')}
                    value={form.data.theme ?? ''}
                    options={Object.keys(options.themes)}
                    names={PROFILE_THEMES()}
                    onChange={(value) => form.setData('theme', value)}
                    preview={(key) => {
                        const colors = options.themes?.[key];

                        return (
                            <span
                                className={cn(
                                    'relative block h-12 w-full overflow-hidden rounded-lg',
                                    !colors && 'gc-solid-2',
                                )}
                                style={
                                    colors
                                        ? {
                                              backgroundImage: `radial-gradient(circle at 20% 20%, ${colors[0]} 0%, transparent 55%), radial-gradient(circle at 80% 30%, ${colors[1]} 0%, transparent 55%), radial-gradient(circle at 50% 100%, ${colors[2]} 0%, transparent 60%)`,
                                          }
                                        : undefined
                                }
                            >
                                {colors && (
                                    <span
                                        className={`profile-pattern profile-pattern-${THEME_PATTERN[key] ?? 'grid'}`}
                                    />
                                )}
                            </span>
                        );
                    }}
                />
            )}
            {!form.data.theme && (
                <AccentPicker
                    value={form.data.accent ?? ''}
                    accents={options.accents}
                    onChange={(value) => form.setData('accent', value)}
                    label={tr('Кольори сторінки профілю')}
                />
            )}
            <EffectPicker
                label={tr('Ефект шапки профілю')}
                value={form.data.header ?? ''}
                options={options.headers}
                names={HEADER_FX()}
                onChange={(value) => form.setData('header', value)}
                preview={(key) => (
                    <span className="gc-solid-2 relative block h-9 w-full overflow-hidden rounded-lg">
                        {key === 'aurora' && (
                            <span
                                className="profile-aurora absolute inset-x-0 bottom-0 h-2/3 [mask-image:linear-gradient(to_top,black,transparent)] opacity-60"
                                style={{
                                    backgroundImage: `linear-gradient(90deg, ${accentColors.join(', ')}, ${accentColors[0]})`,
                                }}
                            />
                        )}
                        {key === 'rim' && (
                            <span
                                className="profile-rim"
                                style={{
                                    backgroundImage: `linear-gradient(120deg, ${accentColors.join(', ')}, ${accentColors[0]})`,
                                }}
                            />
                        )}
                    </span>
                )}
            />
            <button
                type="submit"
                className={primary}
                disabled={form.processing}
            >
                {tr('Зберегти')}
            </button>
        </form>
    );
}

const NAME_FX = (): Record<string, string> => ({
    '': tr('Без анімації'),
    flow: tr('Перелив'),
    shine: tr('Відблиск'),
    neon: tr('Неон'),
    rainbow: tr('Веселка'),
});

const FRAME_MOTION = (): Record<string, string> => ({
    '': tr('Статична'),
    spin: tr('Перелив по колу'),
    pulse: tr('Дихання світла'),
    glint: tr('Відблиск'),
});

const PROFILE_THEMES = (): Record<string, string> => ({
    '': tr('Без теми'),
    glacier: tr('Льодовик'),
    midnight: tr('Північ'),
    sakura: tr('Сакура'),
    toxic: tr('Токсик'),
    ember: tr('Жар'),
    gold: tr('Золото'),
});

/** Візерунок теми (як у config/plus.php) — для прев’ю. */
const THEME_PATTERN: Record<string, string> = {
    glacier: 'grid',
    midnight: 'stars',
    sakura: 'waves',
    toxic: 'hex',
    ember: 'waves',
    gold: 'stars',
};

const HEADER_FX = (): Record<string, string> => ({
    '': tr('Без ефекту'),
    aurora: tr('Сяйво обкладинки'),
    rim: tr('Жива рамка'),
});

/** Вибір ефекту: «без ефекту» + варіанти з сервера (із прев’ю, якщо є). */
function EffectPicker({
    label,
    value,
    options,
    names,
    onChange,
    preview,
}: {
    label: string;
    value: string;
    options: string[];
    names: Record<string, string>;
    onChange: (value: string) => void;
    preview?: (key: string) => ReactNode;
}) {
    return (
        <div>
            <p className="mb-2 text-sm text-white/60">{label}</p>
            <div className="grid grid-cols-3 gap-2">
                {['', ...options].map((key) => (
                    <button
                        key={key || 'none'}
                        type="button"
                        aria-pressed={value === key}
                        onClick={() => onChange(key)}
                        className={cn(
                            'flex flex-col items-stretch gap-2 rounded-2xl p-2.5 text-xs font-medium transition',
                            value === key
                                ? 'border-indigo-400/60 bg-indigo-500/10 text-white'
                                : 'text-white/65 hover:border-white/25',
                        )}
                    >
                        {preview?.(key)}
                        {names[key] ?? key}
                    </button>
                ))}
            </div>
        </div>
    );
}

function AccentPicker({
    value,
    accents,
    onChange,
    label,
}: {
    value: string;
    accents: Record<string, string[]>;
    onChange: (value: string) => void;
    label: string;
}) {
    return (
        <div>
            <p className="mb-2 text-sm text-white/60">{label}</p>
            <div className="flex flex-wrap gap-2">
                <Swatch
                    colors={['#ffffff22']}
                    active={!value}
                    onClick={() => onChange('')}
                    label={tr('Стандартні')}
                />
                {Object.entries(accents).map(([key, colors]) => (
                    <Swatch
                        key={key}
                        colors={colors.slice(0, 3)}
                        active={value === key}
                        onClick={() => onChange(key)}
                        label={key}
                    />
                ))}
            </div>
        </div>
    );
}

function GiftForm({
    buy,
    busy,
    friends,
    sent,
}: {
    buy: (product: string, extra?: Record<string, string | number>) => void;
    busy: string | null;
    friends: NonNullable<Props['friends']>;
    sent: NonNullable<Props['sent_gifts']>;
}) {
    const me = usePage().props.auth.user;
    const gifts = useKind('gift');
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');
    const [theme, setTheme] = useState<GiftTheme>('ice');
    const [later, setLater] = useState(false);
    const [date, setDate] = useState('');
    const query = username.trim().replace(/^@/, '').toLowerCase();
    const picked = friends.find((f) => f.username.toLowerCase() === query);
    const matches =
        query && !picked
            ? friends
                  .filter(
                      (f) =>
                          f.username.toLowerCase().includes(query) ||
                          f.name.toLowerCase().includes(query),
                  )
                  .slice(0, 5)
            : [];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const ready =
        username.trim().length > 1 && busy === null && (!later || !!date);
    const days = (gifts[0]?.[1] as { days?: number } | undefined)?.days ?? 30;

    return (
        <section className="gc-solid flex flex-col gap-4 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Gift className="size-5 text-indigo-300" />
                {tr('Подарувати другу')}
            </h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <div className="flex flex-col gap-3">
                    <div className="relative">
                        <input
                            value={username}
                            onChange={(event) =>
                                setUsername(event.target.value)
                            }
                            placeholder={tr('Нік друга, напр. @olena')}
                            aria-label={tr('Кому')}
                            className="input-glass h-10 w-full rounded-xl px-3 text-sm"
                        />
                        {matches.length > 0 && (
                            <ul className="gc-solid absolute inset-x-0 top-11 z-10 overflow-hidden rounded-xl p-1 shadow-xl">
                                {matches.map((f) => (
                                    <li key={f.username}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setUsername(f.username)
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white hover:bg-white/[0.06]"
                                        >
                                            <span className="min-w-0 flex-1 truncate">
                                                {f.name}
                                            </span>
                                            <span className="text-xs text-white/45">
                                                @{f.username}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <textarea
                        value={message}
                        maxLength={200}
                        rows={3}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={tr(
                            'Побажання на листівці (необов’язково)',
                        )}
                        className="input-glass rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-white/50">
                            {tr('Оформлення')}
                        </span>
                        {GIFT_THEMES().map((t) => (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setTheme(t.value)}
                                aria-pressed={theme === t.value}
                                className={cn(
                                    'h-8 rounded-lg px-3 text-xs font-semibold',
                                    theme === t.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-white/[0.06] text-white/70',
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-white/50">
                            {tr('Коли вручити')}
                        </span>
                        <button
                            type="button"
                            onClick={() => setLater(false)}
                            aria-pressed={!later}
                            className={cn(
                                'h-8 rounded-lg px-3 text-xs font-semibold',
                                !later
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-white/[0.06] text-white/70',
                            )}
                        >
                            {tr('Одразу')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setLater(true)}
                            aria-pressed={later}
                            className={cn(
                                'h-8 rounded-lg px-3 text-xs font-semibold',
                                later
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-white/[0.06] text-white/70',
                            )}
                        >
                            {tr('У день…')}
                        </button>
                        {later && (
                            <input
                                type="date"
                                min={tomorrow}
                                value={date}
                                onChange={(event) =>
                                    setDate(event.target.value)
                                }
                                aria-label={tr('Дата вручення')}
                                className="input-glass h-8 rounded-lg px-2 text-xs"
                            />
                        )}
                    </div>
                    <p className="text-xs text-white/45">
                        {tr(
                            'Разова оплата без підписки. Друг отримає сповіщення й листівку в день вручення.',
                        )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {gifts.map(([product, plan]) => (
                            <button
                                key={product}
                                type="button"
                                className={secondary}
                                disabled={!ready}
                                onClick={() =>
                                    buy(product, {
                                        username: username.trim(),
                                        gift_message: message.trim(),
                                        gift_theme: theme,
                                        ...(later && date
                                            ? { gift_at: date }
                                            : {}),
                                    })
                                }
                            >
                                {periodLabel(plan)} ·{' '}
                                {plan.price.toLocaleString('uk-UA')} ₴
                            </button>
                        ))}
                    </div>
                </div>
                <GiftCardArt
                    theme={theme}
                    from={me?.name ?? ''}
                    to={picked?.name ?? username.trim().replace(/^@/, '')}
                    days={days}
                    message={message.trim() || null}
                />
            </div>
            {sent.length > 0 && (
                <div>
                    <p className="mb-1.5 text-xs font-semibold text-white/55">
                        {tr('Надіслані подарунки')}
                    </p>
                    <ul className="space-y-1">
                        {sent.map((g) => (
                            <li key={g.id}>
                                <Link
                                    href={`/plus/gifts/${g.id}`}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.05]"
                                >
                                    <Gift className="size-4 text-indigo-300" />
                                    <span className="min-w-0 flex-1 truncate text-white">
                                        {g.recipient?.name ?? '—'}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-xs',
                                            g.status === 'delivered'
                                                ? 'text-emerald-400'
                                                : 'text-amber-300',
                                        )}
                                    >
                                        {g.status === 'delivered'
                                            ? tr('вручено')
                                            : tr('буде {date}', {
                                                  date: new Date(
                                                      g.deliver_at ?? '',
                                                  ).toLocaleDateString('uk-UA'),
                                              })}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

/** Пробний період: один раз на акаунт, без картки й без автосписання. */
function TrialOffer({ days }: { days: number }) {
    const reduce = useReducedMotion();
    const [busy, setBusy] = useState(false);

    return (
        <m.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-primary/10 p-4"
        >
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
                <Sparkles className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                    {tr('{n} днів GameCon+ безкоштовно', { n: days })}
                </p>
                <p className="text-sm text-white/60">
                    {tr(
                        'Без картки й без автоматичного списання. Наприкінці нагадаємо — продовжите, лише якщо сподобається.',
                    )}
                </p>
            </div>
            <button
                type="button"
                disabled={busy}
                onClick={() =>
                    router.post(
                        '/plus/trial',
                        {},
                        {
                            preserveScroll: true,
                            onStart: () => setBusy(true),
                            onFinish: () => setBusy(false),
                        },
                    )
                }
                className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
                {tr('Спробувати')}
            </button>
        </m.div>
    );
}

function RedeemForm() {
    const form = useForm({ code: '' });

    return (
        <form
            className="gc-solid flex flex-col gap-3 rounded-2xl p-5"
            onSubmit={(event) => {
                event.preventDefault();
                form.post('/plus/redeem', {
                    preserveScroll: true,
                    onSuccess: () => form.reset(),
                });
            }}
        >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Ticket className="size-5 text-indigo-300" />
                {tr('Промокод')}
            </h2>
            <p className="text-sm text-white/55">
                {tr('Є код від GameCon або партнерів? Введіть його тут.')}
            </p>
            <input
                value={form.data.code}
                onChange={(event) => form.setData('code', event.target.value)}
                placeholder="GAMECON-2026"
                className="input-glass h-10 rounded-xl px-3 text-sm uppercase"
            />
            {form.errors.code && (
                <p className="text-xs text-red-400">{form.errors.code}</p>
            )}
            <button
                type="submit"
                className={cn(secondary, 'self-start')}
                disabled={form.processing || form.data.code.trim() === ''}
            >
                {tr('Активувати')}
            </button>
        </form>
    );
}

function FamilyPlans({
    families,
    options,
    buy,
    busy,
    plus,
}: {
    families: Props['families'];
    options: Props['options'];
    buy: (product: string, extra?: Record<string, string | number>) => void;
    busy: string | null;
    plus: boolean;
}) {
    const plans = useKind('family');
    const discount = usePage().props.billing?.family_plus_discount ?? 0;
    // Ціна для цього лідера: з власним GameCon+ — зі знижкою (так само рахує сервер).
    const priceFor = (price: number) =>
        plus && discount > 0
            ? Math.round((price * (100 - discount)) / 100)
            : price;
    return (
        <section className="gc-solid rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Users className="size-5 text-indigo-300" />
                {tr('GameCon+ для сім’ї')}
            </h2>
            <p className="mt-1 text-sm text-white/55">
                {tr(
                    'Оплачує лідер, бонуси — для всієї сім’ї: виділена картка в каталозі з позначкою GameCon+, власні кольори сторінки сім’ї, до 20 голосових кімнат замість 10.',
                )}
            </p>
            <p className="mt-2 font-display text-xl font-bold text-white">
                {plans.map(([key, plan], i) => (
                    <span key={key}>
                        {i > 0 && <span className="mx-2 text-white/25">·</span>}
                        {plus && discount > 0 && (
                            <s className="mr-1.5 text-base font-medium text-white/35">
                                {plan.price.toLocaleString('uk-UA')} ₴
                            </s>
                        )}
                        {priceFor(plan.price).toLocaleString('uk-UA')} ₴
                        <span className="text-sm font-medium text-white/45">
                            {' '}
                            {perPeriod(plan.days)}
                        </span>
                    </span>
                ))}
            </p>
            {discount > 0 && (
                <div
                    className={cn(
                        'mt-3 rounded-xl px-3.5 py-3 text-sm leading-relaxed',
                        plus
                            ? 'bg-emerald-500/10 text-emerald-200'
                            : 'bg-sky-500/10 text-sky-200',
                    )}
                >
                    <p className="font-semibold">
                        {plus
                            ? tr('Ваша знижка −{n}% уже врахована', {
                                  n: discount,
                              })
                            : tr('−{n}% для підписників GameCon+', {
                                  n: discount,
                              })}
                    </p>
                    <p className="mt-0.5 text-[13px] opacity-85">
                        {tr(
                            'Що це: лідер сім’ї, у якого є власний GameCon+, платить за GameCon+ для сім’ї на {n}% менше — і при першій оплаті, і при автопродовженні, поки його підписка активна. Для чого: щоб лідеру не доводилося платити повну ціну двічі — за себе й за сім’ю.',
                            { n: discount },
                        )}
                    </p>
                </div>
            )}
            {families.length === 0 ? (
                <p className="mt-3 text-sm text-white/40">
                    {tr('Підключити може лише лідер верифікованої сім’ї.')}
                </p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {families.map((family) => (
                        <FamilyRow
                            key={family.id}
                            family={family}
                            options={options}
                            buy={buy}
                            busy={busy}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function FamilyRow({
    family,
    options,
    buy,
    busy,
}: {
    family: Props['families'][number];
    options: Props['options'];
    buy: (product: string, extra?: Record<string, string | number>) => void;
    busy: string | null;
}) {
    const plans = useKind('family');
    const [accent, setAccent] = useState(family.style.accent ?? '');

    return (
        <li className="gc-solid-2 space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3">
                <FamilyLogo family={family} size="md" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">
                        <span className="text-amber-300">[{family.tag}]</span>{' '}
                        {family.name}
                    </span>
                    <span className="text-xs text-white/45">
                        {family.state.active && family.state.until
                            ? tr('GameCon+ до {date}', {
                                  date: formatDate(family.state.until),
                              })
                            : tr('Без GameCon+')}
                        {family.state.renewal && ` · ${tr('автопродовження')}`}
                    </span>
                </span>
                {plans.map(([product, plan]) => (
                    <button
                        key={product}
                        type="button"
                        className={cn(primary, 'h-9')}
                        disabled={busy !== null}
                        onClick={() => buy(product, { family_id: family.id })}
                    >
                        {periodLabel(plan)}
                    </button>
                ))}
            </div>
            {family.state.active && (
                <div className="space-y-3">
                    <AccentPicker
                        value={accent}
                        accents={options.accents}
                        onChange={setAccent}
                        label={tr('Кольори сторінки сім’ї')}
                    />
                    <button
                        type="button"
                        className={cn(secondary, 'h-9')}
                        onClick={() =>
                            router.put(
                                `/plus/families/${family.id}/style`,
                                { accent },
                                { preserveScroll: true },
                            )
                        }
                    >
                        {tr('Зберегти')}
                    </button>
                </div>
            )}
        </li>
    );
}

/**
 * «Інші покупки»: усе платне, що продається не тут, — з цінами з адмінки й посиланнями,
 * щоб жодна позиція каталогу не губилася. Показуємо лише те, що в продажу й чий розділ увімкнено.
 */
function OtherPurchases() {
    const modules = usePage().props.modules ?? [];
    const from = (items: [string, { price: number }][]) =>
        items.length > 0 ? Math.min(...items.map(([, p]) => p.price)) : null;
    const balance = from(useKind('balance'));
    const phone = from(useKind('phone'));
    const promo = from(useKind('promo'));
    const cards = [
        balance !== null && {
            key: 'balance',
            icon: Wallet,
            title: tr('Баланс GameCon'),
            text: tr(
                'Передоплата послуг сайту: підписки на авторів, просування спільнот, GameCon+.',
            ),
            price: balance,
            href: '/plus/billing',
        },
        phone !== null &&
            modules.includes('phone') && {
                key: 'phone',
                icon: Phone,
                title: tr('Номер +777'),
                text: tr(
                    'Власний внутрішній номер для дзвінків на GameCon; з GameCon+ — дешевше.',
                ),
                price: phone,
                href: '/phone',
            },
        promo !== null &&
            modules.includes('servers') && {
                key: 'promo',
                icon: Megaphone,
                title: tr('Просування сервера'),
                text: tr(
                    'Місце в топі, виділена картка чи банер у каталозі. Купується на сторінці вашого сервера.',
                ),
                price: promo,
                href: '/servers',
            },
    ].filter(Boolean) as {
        key: string;
        icon: LucideIcon;
        title: string;
        text: string;
        price: number;
        href: string;
    }[];
    if (cards.length === 0) return null;

    return (
        <section className="gc-solid rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold text-white">
                {tr('Інші покупки')}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {cards.map((c) => (
                    <Link
                        key={c.key}
                        href={c.href}
                        className="gc-solid-2 flex flex-col gap-1.5 rounded-xl p-4 transition hover:bg-[var(--gc-l3)]"
                    >
                        <c.icon className="size-5 text-sky-400" />
                        <span className="font-semibold text-white">
                            {c.title}
                        </span>
                        <span className="text-xs leading-relaxed text-white/55">
                            {c.text}
                        </span>
                        <span className="mt-auto pt-1 text-sm font-semibold text-white tabular-nums">
                            {tr('від {n} ₴', {
                                n: c.price.toLocaleString('uk-UA'),
                            })}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

/** Власна роль-підпис біля ніка (GameCon+): текст до 24 символів і колір; текст — раз на тиждень. */
function TitleForm({ title }: { title: Props['title'] }) {
    const form = useForm({ name: title.name ?? '', color: title.color });
    const locked =
        title.next_change !== null && form.data.name !== (title.name ?? '');

    return (
        <section className="gc-solid rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Tag className="size-5 text-sky-300" />
                {tr('Власна роль')}
            </h2>
            <p className="mt-1 text-sm text-white/55">
                {tr(
                    'Підпис біля вашого ніка в записах, коментарях і профілі. Змінити текст можна раз на тиждень, колір — будь-коли.',
                )}
            </p>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.put('/plus/title', { preserveScroll: true });
                }}
                className="mt-4 space-y-3"
            >
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        maxLength={24}
                        placeholder={tr('Наприклад: Снайпер клану')}
                        aria-label={tr('Текст ролі')}
                        className="h-11 min-w-0 flex-1 rounded-xl bg-white/[0.06] px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                    />
                    {form.data.name.trim() !== '' && (
                        <UserTitle
                            user={{
                                title: {
                                    name: form.data.name.trim(),
                                    color: form.data.color,
                                },
                            }}
                            className="px-2.5 py-1 text-xs"
                        />
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {title.colors.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => form.setData('color', c)}
                            aria-label={c}
                            aria-pressed={form.data.color === c}
                            className={cn(
                                'h-7 rounded-lg px-2.5 text-[11px] font-semibold',
                                titleColor(c),
                                form.data.color === c && 'ring-2 ring-white/60',
                            )}
                        >
                            Aa
                        </button>
                    ))}
                </div>
                {title.next_change && (
                    <p className="text-xs text-white/45">
                        {tr('Наступна зміна тексту — {date}', {
                            date: formatDate(title.next_change),
                        })}
                    </p>
                )}
                {form.errors.name && (
                    <p className="text-sm text-rose-400">{form.errors.name}</p>
                )}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={form.processing || locked}
                        className={cn(primary, 'h-10')}
                    >
                        {tr('Зберегти')}
                    </button>
                    {title.name && (
                        <button
                            type="button"
                            onClick={() =>
                                router.put(
                                    '/plus/title',
                                    { name: '' },
                                    { preserveScroll: true },
                                )
                            }
                            className="h-10 rounded-xl px-3 text-sm text-white/60 hover:text-white"
                        >
                            {tr('Прибрати')}
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}

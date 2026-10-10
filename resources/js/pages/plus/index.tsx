import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Check,
    Gift,
    Image as ImageIcon,
    Layers,
    Palette,
    Shield,
    Sparkles,
    Ticket,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PlusTabs } from '@/components/billing/plus-tabs';
import { FamilyLogo } from '@/components/families/family-logo';
import { PlusBadge, plusNameStyle } from '@/components/gc/plus';
import { UserAvatar } from '@/components/gc/user-avatar';
import { money, openTopup } from '@/lib/billing';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { buyProduct, PLUS_PRICES, PRODUCT_LABELS } from '@/lib/plus';
import type { PlusProduct } from '@/lib/plus';
import { cn } from '@/lib/utils';
import type { FamilyCard } from '@/types';

type State = {
    active: boolean;
    until: string | null;
    /** Автопродовження з рахунку (Білінг). */
    renewal: {
        id: number;
        product: string;
        payer_id: number;
        failed: boolean;
    } | null;
};

type Style = { name?: string; frame?: string; accent?: string };

type Props = {
    state: State;
    style: Style;
    options: {
        names: Record<string, string[]>;
        frames: Record<string, string[]>;
        accents: Record<string, string[]>;
    };
    products: Record<string, { available: boolean }>;
    families: (FamilyCard & { state: State; style: Style })[];
    payments: {
        id: number;
        product: string;
        amount: number;
        currency: string;
        status: string;
        receipt_url: string | null;
        created_at: string;
    }[];
    /** Баланс рахунку, копійки. */
    balance: number;
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
const primary = cn(
    btn,
    'bg-[var(--btn-primary,#6366f1)] text-white hover:opacity-90',
);
const secondary = cn(btn, 'bg-white/[0.06] text-white/85 hover:bg-white/10');

export default function PlusPage({
    state,
    style,
    options,
    products,
    families,
    payments,
    balance,
}: Props) {
    const user = usePage().props.auth.user;
    const busy: string | null = null;
    const buy = (
        product: PlusProduct,
        extra: Record<string, string | number> = {},
    ) => buyProduct(product, extra);
    const can = (product: PlusProduct) => products[product]?.available === true;

    return (
        <>
            <Head title="GameCon+" />
            <div className="mx-auto max-w-4xl space-y-5">
                <PlusTabs current="plus" balance={balance} />
                <section className="glass rounded-3xl p-5 sm:p-7">
                    <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-white sm:text-3xl">
                        <PlusBadge className="size-7 rounded-lg [&_svg]:size-5" />
                        GameCon+
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-white/60">
                        {tr(
                            'Підтримайте GameCon і отримайте оформлення, більше місця й зручності. Усе, що вже безкоштовне, лишається безкоштовним.',
                        )}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
                        <Wallet className="size-5 text-indigo-300" />
                        <span className="text-sm text-white">
                            {tr('На рахунку')}{' '}
                            <b className="tabular-nums">{money(balance)}</b>
                        </span>
                        <span className="ml-auto flex gap-2">
                            <button
                                type="button"
                                className={cn(primary, 'h-9')}
                                onClick={() => openTopup()}
                            >
                                {tr('Поповнити')}
                            </button>
                            <Link
                                href="/plus/billing"
                                className={cn(secondary, 'h-9')}
                            >
                                {tr('Рахунок')}
                            </Link>
                        </span>
                    </div>
                    {state.active && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
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
                                                  'для автопродовження бракує коштів',
                                              )
                                            : tr('автопродовження з рахунку')
                                        : tr('без автопродовження')}
                                </span>
                            </span>
                        </div>
                    )}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {(['plus_month', 'plus_year'] as const).map(
                            (product) => (
                                <div
                                    key={product}
                                    className={cn(
                                        'flex flex-col gap-3 rounded-2xl border p-4',
                                        product === 'plus_year'
                                            ? 'border-indigo-400/40 bg-indigo-500/[0.07]'
                                            : 'border-white/10 bg-white/[0.03]',
                                    )}
                                >
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="font-semibold text-white">
                                            {product === 'plus_month'
                                                ? tr('Місяць')
                                                : tr('Рік')}
                                        </span>
                                        {product === 'plus_year' && (
                                            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-200">
                                                {tr(
                                                    '−28% · 2 місяці в подарунок',
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-display text-3xl font-bold text-white">
                                        {PLUS_PRICES[product].toLocaleString(
                                            'uk-UA',
                                        )}{' '}
                                        ₴
                                        <span className="ml-1 text-sm font-medium text-white/45">
                                            {product === 'plus_month'
                                                ? tr('/ місяць')
                                                : tr('/ рік')}
                                        </span>
                                    </p>
                                    <button
                                        type="button"
                                        className={primary}
                                        disabled={!can(product)}
                                        onClick={() => buy(product)}
                                    >
                                        {!can(product)
                                            ? tr('Зараз не продається')
                                            : state.active
                                              ? tr('Продовжити')
                                              : tr('Оформити')}
                                    </button>
                                </div>
                            ),
                        )}
                    </div>
                    <p className="mt-3 text-xs text-white/40">
                        {tr(
                            'Оплата — з рахунку GameCon, його поповнюють донатом. Жодних автосписань з картки: автопродовження списує ціну лише з рахунку й вимикається будь-коли. Дні нової покупки додаються після чинного періоду. Повернення протягом 14 днів — див. «Повернення коштів».',
                        )}
                    </p>
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                    {PERKS().map(({ icon: Icon, title, text }) => (
                        <div key={title} className="glass rounded-3xl p-5">
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

                <div className="grid gap-5 md:grid-cols-2">
                    <GiftForm can={can} buy={buy} busy={busy} />
                    <RedeemForm />
                </div>

                <FamilyPlans
                    families={families}
                    options={options}
                    can={can}
                    buy={buy}
                    busy={busy}
                />

                {payments.length > 0 && (
                    <section className="glass rounded-3xl p-5">
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
    });
    const mark = {
        name: form.data.name ? (options.names[form.data.name] ?? null) : null,
        frame: form.data.frame
            ? (options.frames[form.data.frame] ?? null)
            : null,
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put('/plus/style', { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Palette className="size-5 text-indigo-300" />
                {tr('Оформлення')}
            </h2>
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
                <UserAvatar user={{ ...preview, plus: mark }} size="lg" />
                <span className="flex items-center gap-1.5 font-semibold text-white">
                    <span style={plusNameStyle(mark)}>{preview.name}</span>
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
            <AccentPicker
                value={form.data.accent ?? ''}
                accents={options.accents}
                onChange={(value) => form.setData('accent', value)}
                label={tr('Кольори сторінки профілю')}
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
    can,
    buy,
    busy,
}: {
    can: (product: PlusProduct) => boolean;
    buy: (
        product: PlusProduct,
        extra?: Record<string, string | number>,
    ) => void;
    busy: string | null;
}) {
    const [username, setUsername] = useState('');
    const ready = username.trim().length > 1 && busy === null;

    return (
        <section className="glass flex flex-col gap-3 rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Gift className="size-5 text-indigo-300" />
                {tr('Подарувати другу')}
            </h2>
            <p className="text-sm text-white/55">
                {tr('Разова оплата без підписки. Друг отримає сповіщення.')}
            </p>
            <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={tr('Нік друга, напр. @olena')}
                className="input-glass h-10 rounded-xl px-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
                {(['gift_month', 'gift_year'] as const).map((product) => (
                    <button
                        key={product}
                        type="button"
                        className={secondary}
                        disabled={!ready || !can(product)}
                        onClick={() =>
                            buy(product, { username: username.trim() })
                        }
                    >
                        {product === 'gift_month'
                            ? tr('Місяць · {price} ₴', {
                                  price: PLUS_PRICES[product],
                              })
                            : tr('Рік · {price} ₴', {
                                  price: PLUS_PRICES[product].toLocaleString(
                                      'uk-UA',
                                  ),
                              })}
                    </button>
                ))}
            </div>
        </section>
    );
}

function RedeemForm() {
    const form = useForm({ code: '' });

    return (
        <form
            className="glass flex flex-col gap-3 rounded-3xl p-5"
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
                <p className="text-xs text-rose-300">{form.errors.code}</p>
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
    can,
    buy,
    busy,
}: {
    families: Props['families'];
    options: Props['options'];
    can: (product: PlusProduct) => boolean;
    buy: (
        product: PlusProduct,
        extra?: Record<string, string | number>,
    ) => void;
    busy: string | null;
}) {
    return (
        <section className="glass rounded-3xl p-5">
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
                {PLUS_PRICES.family_month} ₴
                <span className="text-sm font-medium text-white/45">
                    {' '}
                    {tr('/ місяць')}
                </span>
                <span className="mx-2 text-white/25">·</span>
                {PLUS_PRICES.family_year.toLocaleString('uk-UA')} ₴
                <span className="text-sm font-medium text-white/45">
                    {' '}
                    {tr('/ рік')}
                </span>
            </p>
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
                            can={can}
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
    can,
    buy,
    busy,
}: {
    family: Props['families'][number];
    options: Props['options'];
    can: (product: PlusProduct) => boolean;
    buy: (
        product: PlusProduct,
        extra?: Record<string, string | number>,
    ) => void;
    busy: string | null;
}) {
    const [accent, setAccent] = useState(family.style.accent ?? '');

    return (
        <li className="space-y-3 rounded-2xl bg-white/[0.04] p-4">
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
                        {family.state.renewal &&
                            ` · ${tr('автопродовження з рахунку')}`}
                    </span>
                </span>
                {(['family_month', 'family_year'] as const).map((product) => (
                    <button
                        key={product}
                        type="button"
                        className={cn(primary, 'h-9')}
                        disabled={!can(product) || busy !== null}
                        onClick={() => buy(product, { family_id: family.id })}
                    >
                        {product === 'family_month' ? tr('Місяць') : tr('Рік')}
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

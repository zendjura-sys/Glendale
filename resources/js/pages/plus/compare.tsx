import { Head, Link } from '@inertiajs/react';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { PlusTabs } from '@/components/billing/plus-tabs';
import { PlusBadge } from '@/components/gc/plus';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Product = {
    key: string;
    kind: 'plus' | 'family';
    name: string;
    price: number;
    days: number;
    recurring: boolean;
};
type Pair = [number | null, number | null];

type Props = {
    products: Product[];
    limits: Record<string, Pair>;
    reactions: number;
    frames: number;
    themes: number;
    family_discount: number;
    trial_days: number;
    state: { active: boolean; trial: boolean };
};

type Cell = boolean | string;
type Row = { label: string; free: Cell; plus: Cell; family?: Cell };

const uah = (n: number) => `${n.toLocaleString('uk-UA')} ₴`;

function Value({ v }: { v: Cell }) {
    if (v === true) {
        return (
            <Check
                className="mx-auto size-4 text-emerald-400"
                aria-label={tr('Так')}
            />
        );
    }
    if (v === false) {
        return (
            <Minus
                className="mx-auto size-4 text-white/25"
                aria-label={tr('Ні')}
            />
        );
    }

    return <span className="font-semibold text-white tabular-nums">{v}</span>;
}

/** GameCon+ → «Тарифи»: що дає кожен варіант, ціни з каталогу й часті питання. */
export default function PlusCompare(props: Props) {
    const { products, limits, reactions, frames, themes, state } = props;
    const reduce = useReducedMotion();
    const [open, setOpen] = useState<number | null>(0);
    const month = products.find((p) => p.kind === 'plus' && p.days < 60);
    const year = products.find((p) => p.kind === 'plus' && p.days >= 300);
    const family = products.find((p) => p.kind === 'family');
    const saving =
        month && year
            ? Math.round(
                  (1 - year.price / ((month.price * year.days) / month.days)) *
                      100,
              )
            : 0;
    const lim = (key: string, i: 0 | 1): Cell => {
        const v = limits[key]?.[i];

        return v === null || v === undefined
            ? i === 0
                ? tr('стандарт')
                : '—'
            : String(v);
    };

    const rows: { group: string; items: Row[] }[] = [
        {
            group: tr('Вигляд'),
            items: [
                {
                    label: tr('Значок GameCon+ біля імені'),
                    free: false,
                    plus: true,
                    family: tr('значок сім’ї'),
                },
                { label: tr('Колір і анімація ніку'), free: false, plus: true },
                {
                    label: tr('Рамки аватара (з рухом)'),
                    free: false,
                    plus: String(frames),
                },
                {
                    label: tr('Ексклюзивні теми профілю'),
                    free: false,
                    plus: String(themes),
                },
                {
                    label: tr('GIF-аватар і відеообкладинка'),
                    free: false,
                    plus: true,
                },
                {
                    label: tr('Власна роль-підпис біля ніку'),
                    free: false,
                    plus: true,
                },
            ],
        },
        {
            group: tr('Більше місця'),
            items: [
                {
                    label: tr('Персонажі RP'),
                    free: lim('characters', 0),
                    plus: lim('characters', 1),
                },
                {
                    label: tr('Фото в персонажа'),
                    free: lim('character_photos', 0),
                    plus: lim('character_photos', 1),
                },
                {
                    label: tr('Закріплені записи'),
                    free: lim('pinned_posts', 0),
                    plus: lim('pinned_posts', 1),
                },
                {
                    label: tr('Файли в чатах, МБ'),
                    free: lim('message_file_mb', 0),
                    plus: lim('message_file_mb', 1),
                },
                {
                    label: tr('Оголошення «Пошук паті»'),
                    free: lim('party_open', 0),
                    plus: lim('party_open', 1),
                },
                {
                    label: tr('Голосові кімнати сім’ї'),
                    free: lim('family_voice_rooms', 0),
                    plus: '—',
                    family: lim('family_voice_rooms', 1),
                },
            ],
        },
        {
            group: tr('Зручність'),
            items: [
                {
                    label: tr('Додаткові реакції'),
                    free: false,
                    plus: `+${reactions}`,
                },
                {
                    label: tr('Підняти своє паті нагору'),
                    free: false,
                    plus: tr('раз на добу'),
                },
                {
                    label: tr('Набори стікерів GameCon+'),
                    free: false,
                    plus: true,
                },
                {
                    label: tr('Усе, що безкоштовне зараз'),
                    free: true,
                    plus: true,
                    family: true,
                },
            ],
        },
    ];

    const faq: [string, string][] = [
        [
            tr('Чи стане щось платним, якщо я не оформлю GameCon+?'),
            tr(
                'Ні. Стрічка, чати, сім’ї, клани, кіно й музика лишаються безкоштовними. GameCon+ — це оформлення, більше місця й зручності.',
            ),
        ],
        [
            tr('Як скасувати підписку?'),
            tr(
                'У «Оплата й підписки» вимкніть автопродовження — GameCon+ діятиме до кінця оплаченого періоду, потім просто вимкнеться.',
            ),
        ],
        [
            tr('Що буде з оформленням після кінця підписки?'),
            tr(
                'Рамка, колір ніку й тема ховаються, але налаштування зберігаються — повернуться, щойно знову оформите GameCon+.',
            ),
        ],
        [
            tr('Як працює пробний період?'),
            tr(
                'Один раз на акаунт, без картки й без автоматичного списання. Наприкінці нагадаємо — продовжите, лише якщо сподобається.',
            ),
        ],
        [
            tr('Чим GameCon+ для сім’ї відрізняється від особистого?'),
            tr(
                'Його оформлює лідер для всієї сім’ї: значок і кольори сім’ї, більше голосових кімнат. Особистий GameCon+ — для вашого профілю.',
            ),
        ],
        [
            tr('Можна подарувати GameCon+ другові?'),
            tr(
                'Так: на сторінці GameCon+ оберіть друга, напишіть побажання й день вручення. Оплата разова, без підписки.',
            ),
        ],
        [
            tr('Як повернути кошти?'),
            tr(
                'Підписку GameCon+ повертаємо повністю протягом 24 годин від оплати. Подвійне списання чи збій — завжди. Деталі — у «Політиці повернення коштів».',
            ),
        ],
        [
            tr('Чи можна оплатити в застосунку?'),
            tr(
                'У застосунку оплата — лише через Google Play, ціни там показує Google Play. На сайті — карткою через monobank.',
            ),
        ],
    ];

    return (
        <>
            <Head title={tr('Тарифи GameCon+')} />
            <div className="mx-auto max-w-5xl space-y-5">
                <PlusTabs current="plus" />

                <section className="grid gap-3 md:grid-cols-3">
                    <div className="gc-solid flex flex-col rounded-2xl p-5">
                        <p className="font-display text-lg font-bold text-white">
                            {tr('Безкоштовно')}
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                            {tr(
                                'Усе головне: стрічка, чати, сім’ї, кіно, музика.',
                            )}
                        </p>
                        <p className="mt-4 font-display text-3xl font-bold text-white">
                            0 ₴
                        </p>
                    </div>
                    <div className="gc-solid relative flex flex-col rounded-2xl p-5 ring-2 ring-primary/60">
                        <p className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <PlusBadge className="size-6 rounded-md [&_svg]:size-4" />
                            GameCon+
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                            {tr('Оформлення, більше місця й зручності.')}
                        </p>
                        <p className="mt-4 font-display text-3xl font-bold text-white">
                            {month ? uah(month.price) : '—'}
                            <span className="ml-1 text-sm font-medium text-white/45">
                                {tr('/ місяць')}
                            </span>
                        </p>
                        {year && (
                            <p className="mt-1 text-sm text-white/60">
                                {tr('або {price} на рік', {
                                    price: uah(year.price),
                                })}
                                {saving > 0 && (
                                    <span className="ml-1.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
                                        {tr('−{n}%', { n: saving })}
                                    </span>
                                )}
                            </p>
                        )}
                        <Link
                            href="/plus"
                            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                        >
                            {state.active
                                ? tr('Мій GameCon+')
                                : state.trial
                                  ? tr('Спробувати {n} днів безкоштовно', {
                                        n: props.trial_days,
                                    })
                                  : tr('Оформити')}
                        </Link>
                    </div>
                    <div className="gc-solid flex flex-col rounded-2xl p-5">
                        <p className="font-display text-lg font-bold text-white">
                            {tr('GameCon+ для сім’ї')}
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                            {tr('Оформлює лідер для всієї сім’ї.')}
                        </p>
                        <p className="mt-4 font-display text-3xl font-bold text-white">
                            {family ? uah(family.price) : '—'}
                            <span className="ml-1 text-sm font-medium text-white/45">
                                {tr('/ місяць')}
                            </span>
                        </p>
                        {props.family_discount > 0 && (
                            <p className="mt-1 text-sm text-white/60">
                                {tr('−{n}% лідерам з власним GameCon+', {
                                    n: props.family_discount,
                                })}
                            </p>
                        )}
                    </div>
                </section>

                <section className="gc-solid overflow-x-auto rounded-2xl">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead>
                            <tr className="text-xs text-white/45">
                                <th className="px-4 py-3 text-left font-medium">
                                    {tr('Можливість')}
                                </th>
                                <th className="w-28 px-2 py-3 font-medium">
                                    {tr('Безкоштовно')}
                                </th>
                                <th className="w-28 px-2 py-3 font-semibold text-white">
                                    GameCon+
                                </th>
                                <th className="w-28 px-2 py-3 font-medium">
                                    {tr('Сім’я')}
                                </th>
                            </tr>
                        </thead>
                        {rows.map((g) => (
                            <tbody key={g.group}>
                                <tr>
                                    <th
                                        colSpan={4}
                                        className="bg-white/[0.03] px-4 py-2 text-left text-xs font-semibold text-white/55"
                                    >
                                        {g.group}
                                    </th>
                                </tr>
                                {g.items.map((r) => (
                                    <tr key={r.label}>
                                        <td className="px-4 py-2.5 text-white/80">
                                            {r.label}
                                        </td>
                                        <td className="px-2 py-2.5 text-center text-white/60">
                                            <Value v={r.free} />
                                        </td>
                                        <td className="bg-primary/[0.06] px-2 py-2.5 text-center">
                                            <Value v={r.plus} />
                                        </td>
                                        <td className="px-2 py-2.5 text-center text-white/60">
                                            <Value v={r.family ?? false} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                    </table>
                </section>

                <section className="gc-solid rounded-2xl p-5">
                    <h2 className="mb-3 font-display text-lg font-bold text-white">
                        {tr('Часті питання')}
                    </h2>
                    <ul className="space-y-1">
                        {faq.map(([q, a], i) => (
                            <li key={q}>
                                <button
                                    type="button"
                                    aria-expanded={open === i}
                                    onClick={() =>
                                        setOpen(open === i ? null : i)
                                    }
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white hover:bg-white/[0.04]"
                                >
                                    <span className="flex-1">{q}</span>
                                    <ChevronDown
                                        className={cn(
                                            'size-4 shrink-0 text-white/50 transition-transform',
                                            open === i && 'rotate-180',
                                        )}
                                    />
                                </button>
                                <AnimatePresence initial={false}>
                                    {open === i && (
                                        <m.p
                                            initial={
                                                reduce
                                                    ? false
                                                    : { height: 0, opacity: 0 }
                                            }
                                            animate={{
                                                height: 'auto',
                                                opacity: 1,
                                            }}
                                            exit={
                                                reduce
                                                    ? { opacity: 0 }
                                                    : { height: 0, opacity: 0 }
                                            }
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden px-3 pb-3 text-sm leading-relaxed text-white/65"
                                        >
                                            {a}
                                        </m.p>
                                    )}
                                </AnimatePresence>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 px-3 text-xs text-white/45">
                        {tr('Ціни й умови оплати —')}{' '}
                        <Link
                            href="/pricing"
                            className="text-sky-400 hover:underline"
                        >
                            {tr('сторінка «Ціни»')}
                        </Link>
                        {', '}
                        <Link
                            href="/refund-policy"
                            className="text-sky-400 hover:underline"
                        >
                            {tr('повернення коштів')}
                        </Link>
                        .
                    </p>
                </section>
            </div>
        </>
    );
}

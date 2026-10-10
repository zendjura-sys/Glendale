import { Link, usePage } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { PlusBadge } from '@/components/gc/plus';
import { LegalShell } from '@/components/legal/legal-shell';
import type { LegalLabels } from '@/components/legal/legal-shell';
import { tr } from '@/lib/i18n';
import { PRODUCT_LABELS } from '@/lib/plus';

type Product = {
    key: string;
    kind: 'plus' | 'gift' | 'family' | 'promo';
    price: number;
    days: number;
    recurring: boolean;
};

type Pair = [number | null, number | null];

type Props = {
    locale: string;
    labels: LegalLabels;
    products: Product[];
    /** Ліміти [без GameCon+, з GameCon+] з config/plus.php. */
    limits: Record<string, Pair>;
    reactions: number;
};

/** Бонуси з актуальних лімітів: змінили ліміт у config/plus.php — змінився й текст. */
const perks = (limits: Props['limits'], reactions: number): string[] => {
    const plus = (key: string) => limits[key]?.[1] ?? null;
    const list = [
        tr('Значок GameCon+ і колір ніку'),
        tr('GIF-аватар і обкладинка, рамка аватара, кольори профілю'),
    ];
    if (plus('characters') !== null) {
        list.push(
            tr('До {a} персонажів RP і {b} фото в кожного', {
                a: plus('characters') ?? 0,
                b: plus('character_photos') ?? 0,
            }),
        );
    }
    if (plus('pinned_posts') !== null) {
        list.push(
            tr('{n} закріплені записи', { n: plus('pinned_posts') ?? 0 }),
        );
    }
    if (plus('message_file_mb') !== null) {
        list.push(
            tr('Файли в чатах до {n} МБ', { n: plus('message_file_mb') ?? 0 }),
        );
    }
    if (plus('party_open') !== null) {
        list.push(
            tr('{n} оголошень у «Пошук паті» й підняття раз на добу', {
                n: plus('party_open') ?? 0,
            }),
        );
    }
    if (reactions > 0) {
        list.push(tr('Стікери GameCon+ і ще {n} реакцій', { n: reactions }));
    }

    return list;
};

/** Групи — лише ті, що є в каталозі зараз, у сталому порядку. */
const GROUPS = (): Record<Product['kind'], string> => ({
    plus: 'GameCon+',
    family: tr('GameCon+ для сім’ї'),
    gift: tr('Подарунок другу'),
    promo: tr('Просування сервера'),
});

/**
 * Публічна сторінка цін (для гостей). Ціни — з config/plus.php, лише товари в продажу;
 * оплата — з рахунку GameCon, який поповнюють донатом.
 */
export default function Pricing({
    locale,
    labels,
    products,
    limits,
    reactions,
}: Props) {
    const user = usePage().props.auth?.user;
    const groups = (Object.keys(GROUPS()) as Product['kind'][])
        .filter((kind) => products.some((p) => p.kind === kind))
        .map((kind) => ({ kind, title: GROUPS()[kind] }));

    return (
        <LegalShell title={labels.pricing} locale={locale} labels={labels}>
            <section className="glass rounded-3xl p-5 sm:p-8">
                <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-white sm:text-3xl">
                    <PlusBadge className="size-7 rounded-lg [&_svg]:size-5" />
                    {labels.pricing}
                </h1>
                <p className="mt-2 text-sm text-white/60">
                    {tr(
                        'GameCon безкоштовний. GameCon+ — добровільна підписка з оформленням і зручностями; усе базове лишається безкоштовним.',
                    )}
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {perks(limits, reactions).map((perk) => (
                        <li
                            key={perk}
                            className="flex gap-2 text-sm text-white/75"
                        >
                            <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                            {perk}
                        </li>
                    ))}
                </ul>

                <div className="mt-6 space-y-5">
                    {groups.map((group) => (
                        <div key={group.kind}>
                            <h2 className="mb-2 font-display text-lg font-bold text-white">
                                {group.title}
                            </h2>
                            <ul className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.03]">
                                {products
                                    .filter((p) => p.kind === group.kind)
                                    .map((p) => (
                                        <li
                                            key={p.key}
                                            className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                                        >
                                            <span className="min-w-0 flex-1 text-white/85">
                                                {PRODUCT_LABELS()[p.key] ??
                                                    p.key}
                                            </span>
                                            <span className="font-semibold text-white tabular-nums">
                                                {p.price.toLocaleString(
                                                    'uk-UA',
                                                )}{' '}
                                                ₴
                                            </span>
                                            <span className="w-full text-xs text-white/40 sm:w-auto">
                                                {p.kind === 'plus' ||
                                                p.kind === 'family'
                                                    ? tr(
                                                          'з рахунку · автопродовження за бажанням',
                                                      )
                                                    : tr(
                                                          'разова оплата з рахунку',
                                                      )}
                                            </span>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <p className="mt-6 text-xs text-white/45">
                    {tr(
                        'Ціни в гривнях. Покупки оплачуються з особистого рахунку GameCon, який поповнюють донатом (Donatello та інші сервіси). Автопродовження — лише з рахунку й вимикається будь-коли. Повернення протягом 14 днів — див.',
                    )}{' '}
                    <Link
                        href={`/refund-policy?lang=${locale}`}
                        className="text-indigo-200 underline"
                    >
                        {labels.refund}
                    </Link>
                    .
                </p>
                <Link
                    href={user ? '/plus' : '/register'}
                    className="mt-5 inline-flex h-11 items-center rounded-xl bg-[var(--btn-primary,#6366f1)] px-5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                    {user ? tr('Оформити GameCon+') : tr('Зареєструватися')}
                </Link>
            </section>
        </LegalShell>
    );
}

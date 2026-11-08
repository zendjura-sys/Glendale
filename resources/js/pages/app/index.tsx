import { Head } from '@inertiajs/react';
import {
    BellRing,
    Clapperboard,
    MessageCircle,
    QrCode as QrIcon,
    Shield,
    Sparkles,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import {
    DESKTOP_STORES,
    MOBILE_STORES,
    StoreButton,
} from '@/components/app-promo/store-buttons';
import type { StoreKey } from '@/components/app-promo/store-buttons';
import { InstallGuides } from '@/components/app-promo/install-guides';
import { tr } from '@/lib/i18n';

type Props = {
    links: Partial<Record<StoreKey, string>>;
    version: string | null;
    screens: string[];
};

type Device = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'other';

/** Яка платформа в людини: першою покажемо кнопку її магазину чи файлу. */
function platform(): Device {
    if (typeof navigator === 'undefined') return 'other';
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
    if (/Linux|X11/i.test(ua)) return 'linux';

    return 'other';
}

/** Що підходить платформі найкраще — у порядку переваги. */
const PREFERRED: Record<Device, StoreKey[]> = {
    ios: ['app_store'],
    android: [
        'google_play',
        'galaxy_store',
        'app_gallery',
        'xiaomi',
        'amazon',
        'apk',
    ],
    windows: ['microsoft_store', 'windows'],
    macos: ['macos', 'app_store'],
    linux: ['linux'],
    other: [],
};

/** Група кнопок («На телефон» / «На комп'ютер»); кнопки без посилань не показуємо. */
function StoreGroup({
    title,
    keys,
    links,
    preferred,
}: {
    title: string;
    keys: StoreKey[];
    links: Partial<Record<StoreKey, string>>;
    preferred: StoreKey | null;
}) {
    const available = keys.filter((k) => links[k]);
    if (available.length === 0) return null;
    const sorted =
        preferred && available.includes(preferred)
            ? [preferred, ...available.filter((k) => k !== preferred)]
            : available;

    return (
        <div className="mt-6">
            <p className="mb-2.5 text-xs font-semibold text-white/50">
                {title}
            </p>
            <div className="flex flex-wrap gap-3">
                {sorted.map((key) => (
                    <StoreButton
                        key={key}
                        store={key}
                        url={links[key] as string}
                        highlight={key === preferred}
                    />
                ))}
            </div>
        </div>
    );
}

/** QR-код сторінки: відсканувати з комп'ютера й одразу відкрити на телефоні. */
function PageQr({ value }: { value: string }) {
    const { size, path } = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        const count = qr.getModuleCount();
        let d = '';
        for (let row = 0; row < count; row++) {
            for (let col = 0; col < count; col++) {
                if (qr.isDark(row, col)) d += `M${col + 2} ${row + 2}h1v1h-1z`;
            }
        }

        return { size: count + 4, path: d };
    }, [value]);

    return (
        <svg
            viewBox={`0 0 ${size} ${size}`}
            className="size-32 shrink-0 rounded-xl bg-white"
            shapeRendering="crispEdges"
            role="img"
            aria-label={tr('QR-код сторінки застосунку')}
        >
            <path d={path} fill="#0b1220" />
        </svg>
    );
}

/** Телефон із знімками екранів застосунку, що змінюються самі. */
function PhoneShowcase({ screens }: { screens: string[] }) {
    const reduce = useReducedMotion();
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (reduce || screens.length < 2) return;
        const id = window.setInterval(
            () => setIndex((i) => (i + 1) % screens.length),
            3200,
        );

        return () => window.clearInterval(id);
    }, [reduce, screens.length]);

    return (
        <div className="relative mx-auto w-[240px] sm:w-[270px]">
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.28),transparent_65%)]" />
            <div className="relative aspect-[9/16] overflow-hidden rounded-[34px] bg-[#05080f] p-2 shadow-[0_0_0_2px_rgba(148,197,255,0.18)]">
                <div className="relative h-full w-full overflow-hidden rounded-[27px] bg-[#0b1220]">
                    <AnimatePresence initial={false}>
                        <m.img
                            key={screens[index]}
                            src={`/images/app/${screens[index]}.webp`}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-top"
                            initial={
                                reduce ? false : { opacity: 0, scale: 1.04 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            exit={reduce ? undefined : { opacity: 0 }}
                            transition={{
                                duration: 0.6,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                        />
                    </AnimatePresence>
                </div>
            </div>
            <div className="mt-4 flex justify-center gap-1.5">
                {screens.map((s, i) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setIndex(i)}
                        aria-label={tr('Знімок {n}', { n: i + 1 })}
                        className={
                            i === index
                                ? 'h-1.5 w-5 rounded-full bg-sky-400 transition-all'
                                : 'h-1.5 w-1.5 rounded-full bg-white/25 transition-all'
                        }
                    />
                ))}
            </div>
        </div>
    );
}

const FEATURES = [
    {
        icon: Shield,
        tone: 'text-amber-400',
        title: () => tr('Сім’ї, клани й гільдії'),
        text: () =>
            tr(
                'Штаб, казна, склад і звіти — у кишені, з логотипами біля ніка.',
            ),
    },
    {
        icon: MessageCircle,
        tone: 'text-sky-400',
        title: () => tr('Чати й голос'),
        text: () => tr('Групи, канали, дзвінки й голосові кімнати для рейдів.'),
    },
    {
        icon: Clapperboard,
        tone: 'text-emerald-400',
        title: () => tr('Музика й кіно'),
        text: () => tr('Свої треки, радіо, фільми й аніме з розкладом серій.'),
    },
    {
        icon: BellRing,
        tone: 'text-red-400',
        title: () => tr('Сповіщення й тривоги'),
        text: () => tr('Push про відповіді, заходи сім’ї та мапу тривог.'),
    },
];

/** Сторінка застосунку: магазини, де він є, пряме завантаження, QR для телефона й знімки екранів. */
export default function AppDownload({ links, version, screens }: Props) {
    const [device, setDevice] = useState<Device>('other');
    useEffect(() => setDevice(platform()), []);

    // Магазин чи файл для платформи людини — першим у своїй групі й з яскравішою гранню.
    const preferred = PREFERRED[device].find((k) => links[k]) ?? null;
    const any = Object.values(links).some(Boolean);
    const mobileDevice = device === 'android' || device === 'ios';
    const groups = [
        { title: tr('На телефон і планшет'), keys: MOBILE_STORES },
        { title: tr('На комп’ютер'), keys: DESKTOP_STORES },
    ];
    if (!mobileDevice && device !== 'other') groups.reverse();
    const pageUrl =
        typeof window === 'undefined'
            ? '/app'
            : `${window.location.origin}/app`;

    return (
        <>
            <Head title={tr('Застосунок GameCon')} />
            <div className="mx-auto max-w-5xl px-4 pt-4 pb-16 sm:px-6">
                <section className="gc-solid relative overflow-hidden rounded-[28px] p-6 sm:p-10">
                    <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.25),transparent_70%)]" />
                    <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto]">
                        <div>
                            <div className="flex items-center gap-3">
                                <img
                                    src="/images/app/logo.webp"
                                    alt=""
                                    width={64}
                                    height={64}
                                    className="gc-float size-16 rounded-[18px] shadow-[0_0_24px_rgba(56,189,248,0.4)]"
                                />
                                {version && (
                                    <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-400 tabular-nums">
                                        {tr('Версія {v}', { v: version })}
                                    </span>
                                )}
                            </div>
                            <h1 className="mt-5 font-display text-3xl leading-tight font-bold tracking-tight text-white sm:text-[40px]">
                                {tr('GameCon у вашій кишені')}
                            </h1>
                            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">
                                {tr(
                                    'Один акаунт для сайту й телефона: стрічка, сім’ї, клани, чати, музика й кіно — усе, що ви робите тут, одразу видно в застосунку.',
                                )}
                            </p>

                            {any ? (
                                groups.map((g) => (
                                    <StoreGroup
                                        key={g.title}
                                        title={g.title}
                                        keys={g.keys}
                                        links={links}
                                        preferred={preferred}
                                    />
                                ))
                            ) : (
                                <p className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
                                    <Sparkles className="size-4" />
                                    {tr(
                                        'Застосунок от-от з’явиться в магазинах — заходьте трохи згодом.',
                                    )}
                                </p>
                            )}

                            {!mobileDevice &&
                                MOBILE_STORES.some((k) => links[k]) && (
                                    <div className="mt-8 flex items-center gap-4 rounded-2xl bg-[var(--gc-l2)] p-4">
                                        <PageQr value={pageUrl} />
                                        <div>
                                            <p className="flex items-center gap-2 font-semibold text-white">
                                                <QrIcon className="size-4 text-sky-400" />
                                                {tr('Наведіть камеру телефона')}
                                            </p>
                                            <p className="mt-1 text-sm text-white/60">
                                                {tr(
                                                    'Відкриється ця сторінка — із кнопкою саме вашого магазину.',
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>

                        <PhoneShowcase screens={screens} />
                    </div>
                </section>

                <InstallGuides links={links} />

                <section className="mt-6 grid gap-3 sm:grid-cols-2">
                    {FEATURES.map((f) => (
                        <div
                            key={f.title()}
                            className="gc-solid flex gap-3.5 rounded-[22px] p-5"
                        >
                            <f.icon
                                className={`mt-0.5 size-6 shrink-0 ${f.tone}`}
                            />
                            <div>
                                <h2 className="font-semibold text-white">
                                    {f.title()}
                                </h2>
                                <p className="mt-1 text-sm leading-relaxed text-white/60">
                                    {f.text()}
                                </p>
                            </div>
                        </div>
                    ))}
                </section>
            </div>
        </>
    );
}

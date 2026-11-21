import { usePage } from '@inertiajs/react';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

type Step = {
    /** Селектори за пріоритетом: береться перший видимий (док на телефоні, шапка на ПК). */
    targets: string[];
    title: () => string;
    text: () => string;
};

const STEPS: Step[] = [
    {
        targets: ['.gc-lobby-hero'],
        title: () => tr('Це ваше лобі'),
        text: () =>
            tr(
                'Тут живе все, що відбувається зараз: друзі онлайн, чати, події, ефіри. Блоки з’являються самі й зникають, коли все стихло.',
            ),
    },
    {
        targets: ['[data-tour="categories"]'],
        title: () => tr('Що показувати'),
        text: () =>
            tr(
                'Оберіть розділи й підрозділи — лобі показуватиме лише їх. Нове 7 днів позначене червоною біркою «New!».',
            ),
    },
    {
        targets: ['[data-tour="dock"]', '[data-tour="header-nav"]'],
        title: () => tr('Розділи'),
        text: () =>
            tr(
                'Ваші розділи завжди під рукою. Які й у якому порядку — налаштуйте в «Налаштування → Навігація».',
            ),
    },
    {
        targets: ['[data-tour="create"]'],
        title: () => tr('Створити'),
        text: () => tr('Допис, фото чи опитування — одним натиском.'),
    },
    {
        targets: ['.gc-lobby-search'],
        title: () => tr('Пошук'),
        text: () => tr('Люди, спільноти й дописи — почніть вводити.'),
    },
    {
        targets: ['[data-tour="menu"]'],
        title: () => tr('Меню'),
        text: () =>
            tr(
                'Усі розділи, налаштування й довідка. Тур можна пройти знову з довідки.',
            ),
    },
];

const PAD = 6;
const CARD_W = 320;

function visible(selector: string): HTMLElement | null {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
    }
    return null;
}

function targetOf(step: Step): HTMLElement | null {
    for (const selector of step.targets) {
        const el = visible(selector);
        if (el) return el;
    }
    return null;
}

/**
 * Інтерактивний тур по розділах (№278): підсвічує лобі, вибір категорій, розділи, «+», пошук
 * і меню. Сам — новим акаунтам один раз; знову — з довідки (/feed?tour=1). Кроки без
 * видимого елемента (вимкнений розділ, інший режим) пропускаються.
 */
export function SiteTour() {
    const page = usePage();
    const pending = page.props.auth?.user?.tour_pending === true;
    const onLobby = page.url.split('?')[0] === '/feed';
    const asked = /[?&]tour=1\b/.test(page.url);
    const [active, setActive] = useState(false);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const steps = useRef<Step[]>([]);

    useEffect(() => {
        if (!onLobby || (!pending && !asked)) return;
        // Даємо лобі домалюватися (блоки, док), потім збираємо кроки з видимими елементами.
        const timer = window.setTimeout(() => {
            steps.current = STEPS.filter((step) => targetOf(step) !== null);
            if (steps.current.length > 0) {
                setIndex(0);
                setActive(true);
            }
        }, 900);
        return () => window.clearTimeout(timer);
    }, [onLobby, pending, asked]);

    const step = active ? steps.current[index] : undefined;

    const measure = useCallback(() => {
        const el = step ? targetOf(step) : null;
        setRect(el ? el.getBoundingClientRect() : null);
    }, [step]);

    useLayoutEffect(() => {
        if (!step) return;
        targetOf(step)?.scrollIntoView({ block: 'center', behavior: 'auto' });
        measure();
        cardRef.current?.focus();
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [step, measure]);

    const finish = useCallback(() => {
        setActive(false);
        if (pending) void api('POST', '/tour/done').catch(() => undefined);
    }, [pending]);

    const next = useCallback(() => {
        if (index + 1 >= steps.current.length) finish();
        else setIndex((i) => i + 1);
    }, [index, finish]);

    if (!step || !rect) return null;

    const total = steps.current.length;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(CARD_W, vw - 32);
    const below = rect.bottom + PAD + 12;
    // Картка під елементом, а якщо не влазить — над ним (док унизу екрана).
    const place =
        below + 220 < vh
            ? { top: below }
            : { bottom: Math.max(16, vh - (rect.top - PAD - 12)) };
    const left = Math.min(
        Math.max(16, rect.left + rect.width / 2 - width / 2),
        vw - width - 16,
    );

    // Портал у <body>: поверх шапки й дока, хоч би які шари в розмітці сторінки.
    return createPortal(
        <div className="gc-tour" role="presentation">
            <div
                className="gc-tour__spot"
                aria-hidden
                style={{
                    top: rect.top - PAD,
                    left: rect.left - PAD,
                    width: rect.width + PAD * 2,
                    height: rect.height + PAD * 2,
                }}
            />
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="gc-tour-title"
                aria-describedby="gc-tour-text"
                tabIndex={-1}
                className="gc-tour__card"
                style={{ ...place, left, width }}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') finish();
                    if (e.key === 'ArrowRight' || e.key === 'Enter') next();
                    if (e.key === 'ArrowLeft' && index > 0)
                        setIndex((i) => i - 1);
                }}
            >
                <p className="text-xs font-semibold text-[var(--gc-accent)] tabular-nums">
                    {index + 1}/{total}
                </p>
                <h2
                    id="gc-tour-title"
                    className="mt-1 text-[17px] font-bold text-[var(--gc-text)]"
                >
                    {step.title()}
                </h2>
                <p
                    id="gc-tour-text"
                    className="mt-1.5 text-sm text-pretty text-[var(--gc-text-2)]"
                >
                    {step.text()}
                </p>
                <div className="mt-4 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={finish}
                        className="gc-ghost-btn"
                    >
                        {tr('Пропустити')}
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        className="gc-tour__next ml-auto"
                    >
                        {index + 1 === total ? tr('Готово') : tr('Далі')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

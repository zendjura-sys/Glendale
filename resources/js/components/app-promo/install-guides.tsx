import { ChevronDown } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { STORES } from '@/components/app-promo/store-buttons';
import type { StoreKey } from '@/components/app-promo/store-buttons';
import { tr } from '@/lib/i18n';

type Guide = {
    key: StoreKey;
    file: string;
    steps: () => ReactNode[];
    note?: () => string;
};

/** Команда в терміналі — моноширинним шрифтом, щоб легко скопіювати. */
function Cmd({ children }: { children: string }) {
    return (
        <code className="mt-1.5 block overflow-x-auto rounded-xl bg-[#05080f] px-3 py-2 font-mono text-[13px] whitespace-pre text-sky-200">
            {children}
        </code>
    );
}

const GUIDES: Guide[] = [
    {
        key: 'apk',
        file: '.apk',
        steps: () => [
            tr('Натисніть «APK для Android» і дочекайтеся завантаження файлу.'),
            tr(
                'Відкрийте файл у сповіщенні про завантаження або в застосунку «Файли» → «Завантаження».',
            ),
            tr(
                'Якщо телефон попросить, дозвольте встановлення з цього джерела: «Налаштування» → «Безпека» → «Встановлення невідомих застосунків» → оберіть браузер чи «Файли» → «Дозволити».',
            ),
            tr('Натисніть «Встановити», а потім «Відкрити».'),
            tr('Увійдіть у свій акаунт GameCon — той самий, що й на сайті.'),
        ],
        note: () =>
            tr(
                'Нові версії встановлюються поверх старої так само — дані й вхід зберігаються. Якщо Google Play Protect попередить, натисніть «Усе одно встановити»: файл з офіційного сайту.',
            ),
    },
    {
        key: 'windows',
        file: '.exe / .msix',
        steps: () => [
            tr('Натисніть «Windows» і збережіть інсталятор.'),
            tr('Відкрийте завантажений файл (зазвичай у теці «Завантаження»).'),
            tr(
                'Якщо з’явиться вікно SmartScreen «Windows захистив ваш ПК», натисніть «Докладніше» → «Однаково запустити».',
            ),
            tr(
                'Дозвольте внесення змін (контроль облікових записів) і пройдіть кроки майстра встановлення.',
            ),
            tr(
                'Запустіть GameCon з меню «Пуск» або з ярлика на робочому столі й увійдіть у свій акаунт.',
            ),
        ],
        note: () =>
            tr(
                'Потрібна Windows 10 або 11 (64-біт). Видалення — «Параметри» → «Програми» → GameCon → «Видалити».',
            ),
    },
    {
        key: 'macos',
        file: '.dmg',
        steps: () => [
            tr('Натисніть «macOS» і відкрийте завантажений файл .dmg.'),
            tr(
                'У вікні, що відкрилося, перетягніть значок GameCon у теку «Програми» (Applications).',
            ),
            tr('Відкрийте «Програми» й запустіть GameCon.'),
            tr(
                'Якщо macOS напише, що не може перевірити розробника: «Системні параметри» → «Конфіденційність і безпека» → внизу «Усе одно відкрити» → «Відкрити». Або клацніть значок із затиснутою Control → «Відкрити».',
            ),
            tr(
                'Після встановлення образ диска можна вилучити (значок у Finder → «Вилучити»).',
            ),
        ],
        note: () =>
            tr(
                'Підходить для Mac з Apple Silicon (M1–M4) та Intel, macOS 11 і новіше.',
            ),
    },
    {
        key: 'linux',
        file: '.deb / .AppImage',
        steps: () => [
            tr('Натисніть «Linux / Ubuntu» і збережіть файл.'),
            <>
                {tr(
                    'Пакет .deb (Ubuntu, Debian, Mint): двічі клацніть файл і натисніть «Встановити» в «Центрі програм» — або в терміналі:',
                )}
                <Cmd>{'sudo apt install ./gamecon*.deb'}</Cmd>
            </>,
            <>
                {tr(
                    'Файл .AppImage (будь-який дистрибутив): зробіть його виконуваним і запустіть:',
                )}
                <Cmd>{'chmod +x GameCon*.AppImage\n./GameCon*.AppImage'}</Cmd>
            </>,
            tr(
                'Якщо AppImage не запускається на Ubuntu 22.04 і новіше, встановіть бібліотеку FUSE: sudo apt install libfuse2.',
            ),
            tr('Знайдіть GameCon у меню програм і увійдіть у свій акаунт.'),
        ],
        note: () =>
            tr(
                'Оновлення .deb — так само встановіть новий файл поверх старого; видалення — sudo apt remove gamecon.',
            ),
    },
];

/** Покрокові інструкції встановлення для файлів, що завантажуються напряму (лише ті, де є посилання). */
export function InstallGuides({
    links,
}: {
    links: Partial<Record<StoreKey, string>>;
}) {
    const reduce = useReducedMotion();
    const guides = GUIDES.filter((g) => links[g.key]);
    const [open, setOpen] = useState<StoreKey | null>(null);
    if (guides.length === 0) return null;

    return (
        <section className="gc-solid mt-6 rounded-[22px] p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
                {tr('Як встановити без магазину')}
            </h2>
            <p className="mt-1 text-sm text-white/60">
                {tr(
                    'Покрокові інструкції для файлів, які ви завантажуєте прямо з сайту.',
                )}
            </p>
            <div className="mt-4 divide-y divide-white/[0.06]">
                {guides.map((g) => {
                    const s = STORES[g.key];
                    const isOpen = open === g.key;

                    return (
                        <div key={g.key}>
                            <button
                                type="button"
                                onClick={() => setOpen(isOpen ? null : g.key)}
                                aria-expanded={isOpen}
                                className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
                            >
                                {s.mark()}
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-white">
                                        {s.name}
                                    </span>
                                    <span className="block text-xs text-white/50">
                                        {g.file}
                                    </span>
                                </span>
                                <ChevronDown
                                    className={`size-5 shrink-0 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <m.div
                                        initial={
                                            reduce
                                                ? false
                                                : { height: 0, opacity: 0 }
                                        }
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={
                                            reduce
                                                ? undefined
                                                : { height: 0, opacity: 0 }
                                        }
                                        transition={{
                                            duration: 0.22,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <ol className="space-y-3 pb-4 pl-1">
                                            {g.steps().map((step, i) => (
                                                <li
                                                    key={i}
                                                    className="flex gap-3 text-sm leading-relaxed text-white/80"
                                                >
                                                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-500/15 text-xs font-bold text-sky-400 tabular-nums">
                                                        {i + 1}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        {step}
                                                    </span>
                                                </li>
                                            ))}
                                        </ol>
                                        {g.note && (
                                            <p className="mb-4 rounded-xl bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-200">
                                                {g.note()}
                                            </p>
                                        )}
                                    </m.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

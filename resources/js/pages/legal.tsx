import { Head, Link } from '@inertiajs/react';
import { Aurora } from '@/components/gc/aurora';
import { Logo } from '@/components/gc/logo';
import { login, register } from '@/routes';

type DocumentId = 'terms' | 'privacy';

type Section = { title: string; paragraphs: string[] };

const UPDATED = '4 жовтня 2026';

const TERMS: Section[] = [
    {
        title: 'Сервіс',
        paragraphs: [
            'GameCon — соціальна мережа на gamecon.online для спілкування, ігор, кланів, кіно, музики й сімей. Користуючись сайтом або застосунком, ви приймаєте ці умови.',
        ],
    },
    {
        title: 'Акаунт',
        paragraphs: [
            'Для більшості можливостей потрібен акаунт. Ви вказуєте правдиві дані й самі відповідаєте за доступ до нього. Вхід через Discord або Google — за вашим вибором, його можна відв’язати в налаштуваннях.',
            'Акаунт можна видалити в налаштуваннях профілю. Разом з ним зникають сторінка, записи, фото й коментарі.',
        ],
    },
    {
        title: 'Поведінка',
        paragraphs: [
            'Не публікуйте незаконний контент, погрози, домагання, чужі особисті дані без згоди й спам. Модерація може приховати матеріал, обмежити повідомлення або заблокувати акаунт.',
            'У чатах сім’ї додаткові правила може задавати керівництво сім’ї.',
        ],
    },
    {
        title: 'Ваші матеріали',
        paragraphs: [
            'Тексти, фото, музика й інші матеріали лишаються вашими. Ви дозволяєте GameCon показувати їх іншим користувачам у межах налаштувань приватності, доки матеріал є на сервісі.',
        ],
    },
    {
        title: 'Сторонні сервіси',
        paragraphs: [
            'Discord, Google, Steam і Spotify підключаються лише якщо ви самі це зробите. Їхні власні умови діють на їхньому боці. Статус «Граю в…» з Discord або Steam з’являється тільки коли ви прив’язали акаунт і не вимкнули автостатус.',
        ],
    },
    {
        title: 'Зміни',
        paragraphs: [
            'Умови можуть оновлюватися. Чинна версія завжди на цій сторінці. Якщо зміна істотна, продовження користування після публікації означає згоду з новою редакцією.',
            `Питання: social@gamecon.online. Редакція від ${UPDATED}.`,
        ],
    },
];

const PRIVACY: Section[] = [
    {
        title: 'Хто обробляє дані',
        paragraphs: [
            'Сервіс GameCon (gamecon.online) обробляє дані, щоб дати вам акаунт, стрічку, чати, ігри, кіно, музику й сім’ї.',
        ],
    },
    {
        title: 'Що ми зберігаємо',
        paragraphs: [
            'Дані акаунта: ім’я, адреса електронної пошти, ім’я користувача, пароль у вигляді хеша, аватар і те, що ви самі вписали в профіль.',
            'Те, що ви публікуєте: записи, коментарі, фото, музика, повідомлення в чатах, історії, участь у сім’ях і кланах.',
            'Технічні дані: адреса IP, тип пристрою й журнали помилок — щоб захистити акаунт і знайти збої. Для застосунка — токен push-сповіщень, якщо ви їх увімкнули.',
        ],
    },
    {
        title: 'Discord',
        paragraphs: [
            'Якщо ви входите через Discord або прив’язуєте його, ми отримуємо ідентифікатор Discord, ім’я та адресу пошти, якщо Discord її передав. Цього достатньо для входу й прив’язки профілю.',
            'Окремо бот GameCon може прочитати, у що ви зараз граєте в Discord (Rich Presence), і показати статус «Граю в…» на сайті. Це працює лише коли Discord прив’язаний, ви є на Discord-сервері GameCon, у Discord увімкнений показ активності, а в GameCon не вимкнено автостатус. Ручний статус бот не перезаписує.',
            'Ми не читаємо ваші особисті повідомлення в Discord і не пишемо від вашого імені.',
        ],
    },
    {
        title: 'Інші підключення',
        paragraphs: [
            'Google (Firebase) — для входу: ідентифікатор і пошта акаунта Google.',
            'Steam — якщо ви вказали Steam, ми зберігаємо Steam ID і можемо показати поточну гру в статусі «Граю в…».',
            'Spotify — якщо ви підключили Spotify, сервіс отримує доступ до відтворення й бібліотеки в межах, які ви підтвердили у Spotify.',
        ],
    },
    {
        title: 'Кому передаємо',
        paragraphs: [
            'Дані не продаємо. Їх бачать інші користувачі лише в межах ваших налаштувань приватності. Технічним підрядникам (хостинг, пошта, push) дані потрібні тільки щоб сервіс працював.',
        ],
    },
    {
        title: 'Скільки зберігаємо і як видалити',
        paragraphs: [
            'Дані акаунта зберігаються, поки акаунт існує. Видалення акаунта — у налаштуваннях профілю: сторінка, записи, фото й коментарі зникають. Прив’язку Discord, Google, Steam або Spotify можна зняти окремо, не видаляючи акаунт.',
            `Запит щодо даних: social@gamecon.online. Редакція від ${UPDATED}.`,
        ],
    },
];

const DOCUMENTS: Record<
    DocumentId,
    { title: string; lead: string; sections: Section[] }
> = {
    terms: {
        title: 'Умови користування',
        lead: 'Правила акаунта, публікацій і підключення Discord, Google, Steam та Spotify.',
        sections: TERMS,
    },
    privacy: {
        title: 'Політика конфіденційності',
        lead: 'Які дані зберігає GameCon і що саме читається з Discord, якщо ви самі прив’язали акаунт.',
        sections: PRIVACY,
    },
};

export default function Legal({ document }: { document: DocumentId }) {
    const doc = DOCUMENTS[document] ?? DOCUMENTS.terms;

    return (
        <>
            <Head title={doc.title} />
            <Aurora />
            <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.05] bg-[#05070f]/50 backdrop-blur-2xl">
                <div className="mx-auto flex h-16 max-w-[840px] items-center gap-4 px-5">
                    <Link href="/">
                        <Logo />
                    </Link>
                    <nav className="ml-auto flex items-center gap-2">
                        <Link
                            href={login()}
                            className="rounded-xl px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white"
                        >
                            Увійти
                        </Link>
                        <Link
                            href={register()}
                            className="btn-glow rounded-xl px-4 py-2 text-sm font-semibold text-white"
                        >
                            Реєстрація
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="relative mx-auto max-w-[840px] px-5 pt-28 pb-16">
                <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    {doc.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                    {doc.lead}
                </p>
                <div className="mt-8 space-y-6">
                    {doc.sections.map((section) => (
                        <section
                            key={section.title}
                            className="glass rounded-3xl px-5 py-5 sm:px-6"
                        >
                            <h2 className="font-display text-lg font-semibold text-white">
                                {section.title}
                            </h2>
                            {section.paragraphs.map((paragraph) => (
                                <p
                                    key={paragraph}
                                    className="mt-3 text-sm leading-relaxed text-white/70"
                                >
                                    {paragraph}
                                </p>
                            ))}
                        </section>
                    ))}
                </div>
            </main>
            <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-white/40">
                <Link href="/terms" className="hover:text-white">
                    Умови
                </Link>
                <span className="px-2 text-white/20">·</span>
                <Link href="/privacy" className="hover:text-white">
                    Конфіденційність
                </Link>
                <p className="mt-2 text-white/30">
                    © {new Date().getFullYear()} GameCon
                </p>
            </footer>
        </>
    );
}

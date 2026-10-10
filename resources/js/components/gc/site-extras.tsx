import { router, useForm } from '@inertiajs/react';
import { Keyboard, MessageSquareHeart, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Останні оновлення сайту: нова версія — нова позначка в шапці. */
const CHANGELOG = () => [
    {
        version: '2026.10.11.2',
        date: '2026-10-11',
        items: [
            tr(
                'Моменти: кліпи з YouTube, Twitch і Medal — стрічка, найкраще за тиждень і моменти на сторінці гри.',
            ),
            tr(
                '«Зараз у стрімі»: канал Twitch чи YouTube у профілі, позначка LIVE і «Друзі в ефірі» в стрічці.',
            ),
            tr(
                'Завдання дня й сезони: три завдання щодня, досвід у рівень і таблиця лідерів місяця.',
            ),
            tr(
                'Запрошення друзів: особисте посилання, досвід і бейджі за кожного друга.',
            ),
            tr(
                'Власникам серверів — аналітика за 30 днів: перегляди, переходи й голоси.',
            ),
        ],
    },
    {
        version: '2026.10.11',
        date: '2026-10-10',
        items: [
            tr(
                'Сервери: щоденне голосування, топ дня й місяця, голоси по днях для власника й бейдж «Голос спільноти».',
            ),
            tr(
                'Персонажі RP: біографія, історія, портрет і фото, сім’я на сервері — у профілі й на сторінці сервера.',
            ),
            tr(
                'Пошук паті: оголошення з грою, сервером, часом і ролями та своя голосова кімната для паті.',
            ),
            tr(
                'Сповіщення в браузері: лайки, коментарі й повідомлення приходять, навіть коли вкладку закрито.',
            ),
            tr(
                'Боти GameCon для Telegram і Discord: події з кнопками «Піду», нагадування й меню групи — без жодних команд.',
            ),
            tr(
                '«Увійти через GameCon» для серверів: власники підключають вхід і онлайн, гравці отримують позначку «підтверджений гравець».',
            ),
        ],
    },
    {
        version: '2026.10.10',
        date: '2026-10-10',
        items: [
            tr(
                'Спільноти: правила й довідник, черга постів на перевірку, мітки, свої заборонені слова, повільний режим, привітання й підписи ролей з кольором.',
            ),
            tr(
                'Акаунт: пристрої й сесії, журнал входів, завантаження своїх даних, заморожування, оскарження рішень і скарга на людину.',
            ),
            tr(
                'Події: черга, якщо місць немає, обкладинка, код відмітки, альбом після події, файл для календаря й нагадування за 10 хвилин – добу.',
            ),
            tr(
                'Стрічка: фільтр за мовою, «завтра подія вашого клану», мова оригіналу біля кожного запису.',
            ),
        ],
    },
];

const SEEN_KEY = 'gc-whats-new';
const FEEDBACK_EVENT = 'gc:feedback';
const SHORTCUTS_EVENT = 'gc:shortcuts';

function readSeen(): string | null {
    try {
        return window.localStorage.getItem(SEEN_KEY);
    } catch {
        return null;
    }
}

export function openFeedback() {
    window.dispatchEvent(new Event(FEEDBACK_EVENT));
}

export function openShortcuts() {
    window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}

/** «Що нового» в шапці: крапка, доки людина не відкрила список. */
export function WhatsNewButton() {
    const entries = CHANGELOG();
    const latest = entries[0];
    const [open, setOpen] = useState(false);
    const [seen, setSeen] = useState<string | null>(latest.version);

    useEffect(() => setSeen(readSeen()), []);

    const unseen = seen !== latest.version;
    const show = () => {
        setOpen(true);
        setSeen(latest.version);
        try {
            window.localStorage.setItem(SEEN_KEY, latest.version);
        } catch {
            // Без сховища позначка просто з’явиться знову.
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={show}
                aria-label={tr('Що нового')}
                title={tr('Що нового')}
                className={cn(
                    'relative size-11 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/[0.06] hover:text-white',
                    unseen ? 'flex' : 'hidden sm:flex',
                )}
            >
                <Sparkles className="size-[19px]" />
                {unseen && (
                    <span
                        aria-hidden
                        className="absolute top-2.5 right-2.5 size-2 rounded-full bg-gc-indigo ring-2 ring-background"
                    />
                )}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="glass-strong max-h-[85dvh] overflow-y-auto rounded-3xl border-white/10 p-6 text-white sm:max-w-lg">
                    <DialogTitle className="flex items-center gap-2 font-display text-lg">
                        <Sparkles className="size-5 text-gc-lilac-300" />
                        {tr('Що нового')}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/50">
                        {tr('Оновлення від {date}', {
                            date: formatDate(latest.date),
                        })}
                    </DialogDescription>
                    <ul className="space-y-2.5">
                        {latest.items.map((item) => (
                            <li
                                key={item}
                                className="rounded-2xl bg-white/[0.04] px-3.5 py-3 text-sm leading-relaxed text-white/80"
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            openFeedback();
                        }}
                        className="inline-flex items-center gap-2 text-sm font-medium text-gc-lilac-300 hover:text-white"
                    >
                        <MessageSquareHeart className="size-4" />
                        {tr('Розкажіть, що думаєте')}
                    </button>
                </DialogContent>
            </Dialog>
        </>
    );
}

const KINDS = () => [
    { value: 'idea', label: tr('Ідея') },
    { value: 'bug', label: tr('Помилка') },
    { value: 'other', label: tr('Інше') },
];

/** Відгук адмінам: відкривається з меню, з «Що нового» чи з клавіш. */
export function FeedbackDialog() {
    const [open, setOpen] = useState(false);
    const form = useForm({ kind: 'idea', body: '', url: '' });

    useEffect(() => {
        const onOpen = () => {
            form.setData('url', window.location.pathname);
            setOpen(true);
        };
        window.addEventListener(FEEDBACK_EVENT, onOpen);

        return () => window.removeEventListener(FEEDBACK_EVENT, onOpen);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="glass-strong rounded-3xl border-white/10 p-6 text-white sm:max-w-md">
                <DialogTitle className="font-display text-lg">
                    {tr('Відгук адмінам')}
                </DialogTitle>
                <DialogDescription className="text-sm text-white/50">
                    {tr(
                        'Ідея, помилка чи просто думка — читаємо все. Адреса сторінки додасться сама.',
                    )}
                </DialogDescription>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post('/feedback', {
                            preserveScroll: true,
                            onSuccess: () => {
                                setOpen(false);
                                form.reset('body');
                            },
                        });
                    }}
                    className="space-y-3"
                >
                    <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
                        {KINDS().map((kind) => (
                            <button
                                key={kind.value}
                                type="button"
                                onClick={() => form.setData('kind', kind.value)}
                                aria-pressed={form.data.kind === kind.value}
                                className={cn(
                                    'h-9 flex-1 rounded-lg text-sm font-medium transition',
                                    form.data.kind === kind.value
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/55 hover:text-white',
                                )}
                            >
                                {kind.label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={form.data.body}
                        onChange={(event) =>
                            form.setData('body', event.target.value)
                        }
                        rows={5}
                        maxLength={3000}
                        placeholder={tr('Що варто покращити?')}
                        className="input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    {form.errors.body && (
                        <p className="text-xs text-rose-300">
                            {form.errors.body}
                        </p>
                    )}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={
                                form.processing ||
                                form.data.body.trim().length < 5
                            }
                            className="btn-glow h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                        >
                            {tr('Надіслати')}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

const SHORTCUTS = () => [
    { keys: ['/'], label: tr('Пошук') },
    { keys: ['G', 'F'], label: tr('Новини') },
    { keys: ['G', 'M'], label: tr('Повідомлення') },
    { keys: ['G', 'P'], label: tr('Моя сторінка') },
    { keys: ['G', 'N'], label: tr('Сповіщення') },
    { keys: ['G', 'S'], label: tr('Налаштування') },
    { keys: ['?'], label: tr('Ця підказка') },
];

const GO: Record<string, (username: string) => string> = {
    f: () => '/feed',
    m: () => '/messages',
    p: (username) => `/${username}`,
    n: () => '/notifications',
    s: () => '/settings/profile',
};

function typing(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;

    return (
        el.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
    );
}

/** Гарячі клавіші сайту й підказка до них (клавіша «?»). */
export function KeyboardShortcuts({ username }: { username: string }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let pendingG = 0;
        const onKey = (event: KeyboardEvent) => {
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                typing(event.target)
            ) {
                return;
            }
            const key = event.key.toLowerCase();
            if (event.key === '?') {
                event.preventDefault();
                setOpen(true);

                return;
            }
            if (key === '/') {
                event.preventDefault();
                window.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }),
                );

                return;
            }
            if (key === 'g') {
                pendingG = Date.now();

                return;
            }
            if (pendingG && Date.now() - pendingG < 1200 && GO[key]) {
                event.preventDefault();
                pendingG = 0;
                router.visit(GO[key](username));
            }
        };
        const onOpen = () => setOpen(true);
        window.addEventListener('keydown', onKey);
        window.addEventListener(SHORTCUTS_EVENT, onOpen);

        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener(SHORTCUTS_EVENT, onOpen);
        };
    }, [username]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="glass-strong rounded-3xl border-white/10 p-6 text-white sm:max-w-sm">
                <DialogTitle className="flex items-center gap-2 font-display text-lg">
                    <Keyboard className="size-5 text-gc-lilac-300" />
                    {tr('Гарячі клавіші')}
                </DialogTitle>
                <DialogDescription className="text-sm text-white/50">
                    {tr('Працюють, коли курсор не в полі введення.')}
                </DialogDescription>
                <ul className="space-y-1.5">
                    {SHORTCUTS().map((item) => (
                        <li
                            key={item.label}
                            className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-white/80"
                        >
                            {item.label}
                            <span className="flex gap-1">
                                {item.keys.map((key) => (
                                    <kbd
                                        key={key}
                                        className="min-w-7 rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-center font-sans text-xs text-white"
                                    >
                                        {key}
                                    </kbd>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    );
}

/** Ненав’язлива підказка внизу бічної панелі (лише на комп’ютері). */
export function KeyboardHint() {
    return (
        <button
            type="button"
            onClick={openShortcuts}
            className="mt-3 hidden items-center gap-2 px-3 text-xs text-white/35 transition hover:text-white/70 lg:flex"
        >
            <Keyboard className="size-3.5" />
            {tr('Натисніть ? — гарячі клавіші')}
        </button>
    );
}

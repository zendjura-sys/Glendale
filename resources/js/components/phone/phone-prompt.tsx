import { Link, usePage } from '@inertiajs/react';
import { Loader2, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NumberPicker } from '@/components/phone/number-picker';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import type { PickerProps } from '@/lib/phones';
import type { PhoneCard } from '@/types';

/**
 * Вікно для акаунтів без номера (зареєстрованих до появи номерів): те саме, що крок після реєстрації.
 * «Пізніше» — більше не показуємо; номер завжди можна взяти в розділі «Телефон».
 */
export function PhonePrompt() {
    const show = Boolean(usePage().props.phonePrompt);
    const [open, setOpen] = useState(show);
    const [props, setProps] = useState<PickerProps | null>(null);
    const [phone, setPhone] = useState<PhoneCard | null>(null);
    useEffect(() => setOpen(show), [show]);
    useEffect(() => {
        if (!open || props) return;
        api<PickerProps>('GET', '/phone/picker')
            .then(setProps)
            .catch(() => setOpen(false));
    }, [open, props]);

    if (!open) return null;

    const close = () => {
        setOpen(false);
        void api('POST', '/phone/dismiss').catch(() => undefined);
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={tr('Отримайте свій номер')}
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        >
            <div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-[var(--matte-solid,#1c1c1f)] p-4 sm:rounded-2xl sm:p-6">
                <header className="mb-4 flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <Phone className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="font-display text-lg font-bold text-white">
                            {tr('Новинка: свій номер у GameCon')}
                        </h2>
                        <p className="text-sm text-white/55">
                            {tr(
                                'Внутрішній номер для дзвінків і повідомлень, як у грі. Випадковий — безкоштовно, а гарний можна купити.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        aria-label={tr('Закрити')}
                        className="flex size-9 items-center justify-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white"
                    >
                        <X className="size-5" />
                    </button>
                </header>
                {props ? (
                    <NumberPicker
                        props={{ ...props, phone }}
                        onPhone={setPhone}
                    />
                ) : (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-white/40" />
                    </div>
                )}
                <footer className="mt-4 flex items-center justify-between gap-3">
                    <Link
                        href="/phone"
                        onClick={() => setOpen(false)}
                        className="text-sm text-white/50 hover:text-white"
                    >
                        {tr('Відкрити «Телефон»')}
                    </Link>
                    <button
                        type="button"
                        onClick={close}
                        className="h-10 rounded-xl bg-white/[0.07] px-4 text-sm font-semibold text-white hover:bg-white/[0.11]"
                    >
                        {phone ? tr('Готово') : tr('Пізніше')}
                    </button>
                </footer>
            </div>
        </div>
    );
}

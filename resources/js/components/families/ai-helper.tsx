import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';
import { usePlugin } from '@/lib/plugins';

/**
 * Помічник сім’ї (ШІ): поле з побажанням і кнопка. Результат — лише чернетка, яку людина
 * перевіряє й зберігає звичайною кнопкою форми (там права й журнал аудиту).
 */
export function FamilyAiHelper<T>({
    url,
    field,
    label,
    placeholder,
    button,
    onResult,
    multiline = false,
}: {
    /** Адреса помічника: /f/{slug}/ai/charter|ranks|report або /clans/{slug}/ai/rules|ranks. */
    url: string;
    /** Ключ, під яким текст іде на сервер (brief / style / text). */
    field: 'brief' | 'style' | 'text';
    label: string;
    placeholder: string;
    button: string;
    onResult: (data: T) => void;
    multiline?: boolean;
}) {
    const on = usePlugin('family_ai');
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    if (!on) return null;

    const run = () => {
        if (field !== 'brief' && value.trim().length < 3) return;
        setBusy(true);
        api<T>('POST', url, { [field]: value.trim() })
            .then((data) => {
                onResult(data);
                toast.success(tr('Чернетку готово — перевірте й збережіть.'));
            })
            .catch((e: unknown) =>
                toast.error(
                    e instanceof Error && e.message
                        ? e.message
                        : tr('Помічник зараз недоступний.'),
                ),
            )
            .finally(() => setBusy(false));
    };

    return (
        <div className="gc-ai-helper">
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-[var(--gc-accent)]" />
                {label}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                {multiline ? (
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        rows={3}
                        maxLength={1500}
                        placeholder={placeholder}
                        aria-label={label}
                        className="gc-ai-input min-h-[84px] flex-1 py-2.5"
                    />
                ) : (
                    <input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === 'Enter' && (e.preventDefault(), run())
                        }
                        maxLength={800}
                        placeholder={placeholder}
                        aria-label={label}
                        className="gc-ai-input h-11 flex-1"
                    />
                )}
                <button
                    type="button"
                    onClick={run}
                    disabled={busy}
                    className="gc-primary-btn h-11 shrink-0 px-4"
                >
                    <Sparkles className="size-4" />
                    {busy ? tr('Пишу…') : button}
                </button>
            </div>
        </div>
    );
}

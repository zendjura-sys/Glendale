import { useForm } from '@inertiajs/react';
import { Globe2, Lock, Megaphone, UsersRound } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { selectClass } from '@/components/gc/admin';
import { cn } from '@/lib/utils';

const types = [
    {
        value: 'group',
        title: 'Група',
        text: 'Спілкування й обговорення: учасники пишуть на стіні.',
        icon: UsersRound,
    },
    {
        value: 'public',
        title: 'Публічна сторінка',
        text: 'Новини від імені сторінки для підписників.',
        icon: Megaphone,
    },
] as const;

export function CreateCommunityDialog({
    open,
    onOpenChange,
    categories,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: Record<string, string>;
}) {
    const form = useForm({
        name: '',
        type: 'group' as 'group' | 'public',
        category: 'games',
        privacy: 'open' as 'open' | 'closed',
    });

    const submit = () =>
        form.post('/communities', {
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-strong gap-0 rounded-3xl border-white/10 p-6 text-white sm:max-w-lg">
                <DialogTitle className="font-display text-xl">
                    Нова спільнота
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-white/50">
                    Зберіть людей навколо гри, команди, фандому чи ідеї.
                </DialogDescription>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {types.map((type) => (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => form.setData('type', type.value)}
                            className={cn(
                                'relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
                                form.data.type === type.value
                                    ? 'border-[#7c8cff]/60 bg-[#6d5dfc]/15 shadow-[0_0_30px_-10px_rgb(124_92_255/0.9)]'
                                    : 'border-white/[0.07] bg-white/[0.03] hover:border-white/15',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-10 items-center justify-center rounded-xl',
                                    form.data.type === type.value
                                        ? 'bg-gradient-brand'
                                        : 'bg-white/[0.06]',
                                )}
                            >
                                <type.icon className="size-5 text-white" />
                            </span>
                            <span className="font-semibold">{type.title}</span>
                            <span className="text-xs leading-relaxed text-white/50">
                                {type.text}
                            </span>
                        </button>
                    ))}
                </div>

                <label className="mt-5 block text-sm font-medium text-white/80">
                    Назва
                    <input
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        maxLength={100}
                        autoFocus
                        placeholder="Наприклад, «Кіберкотлета UA»"
                        className="input-glass mt-1.5 h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                </label>
                {form.errors.name && (
                    <p className="mt-1 text-xs text-rose-300">
                        {form.errors.name}
                    </p>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-white/80">
                        Тематика
                        <select
                            value={form.data.category}
                            onChange={(event) =>
                                form.setData('category', event.target.value)
                            }
                            className={cn(selectClass, 'mt-1.5 h-11 w-full')}
                        >
                            {Object.entries(categories).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {form.data.type === 'group' && (
                        <div className="text-sm font-medium text-white/80">
                            Доступ
                            <div className="mt-1.5 grid h-11 grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
                                {(
                                    [
                                        ['open', 'Відкрита', Globe2],
                                        ['closed', 'Закрита', Lock],
                                    ] as const
                                ).map(([value, label, Icon]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() =>
                                            form.setData('privacy', value)
                                        }
                                        className={cn(
                                            'inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition',
                                            form.data.privacy === value
                                                ? 'bg-white/10 text-white'
                                                : 'text-white/50 hover:text-white',
                                        )}
                                    >
                                        <Icon className="size-3.5" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                        Скасувати
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={
                            form.processing || form.data.name.trim().length < 3
                        }
                        className="btn-glow rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                        Створити
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

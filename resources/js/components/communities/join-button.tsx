import { Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronDown,
    ClipboardList,
    Clock3,
    KeyRound,
    LogIn,
    LogOut,
    Plus,
    UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePlugin } from '@/lib/plugins';
import { cn } from '@/lib/utils';
import type { CommunityCard, CommunityRole, MembershipStatus } from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    community: Pick<CommunityCard, 'slug' | 'type' | 'privacy'> & {
        has_password?: boolean;
        join_questions?: string[];
    };
    status: MembershipStatus | null;
    role?: CommunityRole | null;
    size?: 'sm' | 'md';
    className?: string;
};

export function JoinButton({
    community,
    status,
    role = null,
    size = 'md',
    className,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [asking, setAsking] = useState(false);
    const signedIn = Boolean(usePage().props.auth.user);
    const formsOn = usePlugin('join_forms');
    const isPublic = community.type === 'public';
    const height =
        size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-10 px-4 text-sm';
    const url = `/c/${community.slug}/join`;
    const options = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    // Гість (без акаунта) — спершу вхід.
    if (!signedIn) {
        return (
            <Link
                href="/login"
                className={cn(
                    'btn-glow inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
                    height,
                    className,
                )}
            >
                <LogIn className="size-4" />
                {tr('Увійти, щоб вступити')}
            </Link>
        );
    }

    if (status === null && community.has_password) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setAsking(true)}
                    className={cn(
                        'btn-glow inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
                        height,
                        className,
                    )}
                >
                    <KeyRound className="size-4" />
                    {tr('Вступити')}
                </button>
                <PasswordDialog
                    open={asking}
                    onOpenChange={setAsking}
                    url={url}
                />
            </>
        );
    }

    const questions = community.join_questions ?? [];
    if (status === null && questions.length > 0 && formsOn) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setAsking(true)}
                    className={cn(
                        'btn-glow inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
                        height,
                        className,
                    )}
                >
                    <ClipboardList className="size-4" />
                    {tr('Подати заявку')}
                </button>
                <QuestionsDialog
                    open={asking}
                    onOpenChange={setAsking}
                    url={url}
                    questions={questions}
                />
            </>
        );
    }

    if (status === null) {
        const label = isPublic
            ? tr('Підписатися')
            : community.privacy === 'closed'
              ? tr('Подати заявку')
              : tr('Вступити');

        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => router.post(url, {}, options)}
                className={cn(
                    'btn-glow inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-60',
                    height,
                    className,
                )}
            >
                {isPublic ? (
                    <Plus className="size-4" />
                ) : (
                    <UserPlus className="size-4" />
                )}
                {label}
            </button>
        );
    }

    if (status === 'pending') {
        return (
            <button
                type="button"
                disabled={busy}
                onClick={() => router.delete(url, options)}
                title={tr('Скасувати заявку')}
                className={cn(
                    'group inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.07] font-semibold text-white/80 transition hover:bg-rose-500/15 hover:text-rose-200',
                    height,
                    className,
                )}
            >
                <Clock3 className="size-4" />
                <span className="group-hover:hidden">
                    {tr('Заявку надіслано')}
                </span>
                <span className="hidden group-hover:inline">
                    {tr('Скасувати')}
                </span>
            </button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={busy}
                className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.07] font-semibold text-white transition outline-none hover:bg-white/[0.11]',
                    height,
                    className,
                )}
            >
                <Check className="size-4 text-emerald-300" />
                {isPublic ? tr('Ви підписані') : tr('Ви учасник')}
                <ChevronDown className="size-4 text-white/45" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="glass-strong w-56 rounded-2xl border-white/10 p-1.5 text-white"
            >
                {role === 'owner' ? (
                    <div className="px-2.5 py-2 text-xs leading-relaxed text-white/50">
                        {tr(
                            'Ви власник. Щоб вийти, передайте права іншому адміністратору в розділі «Учасники».',
                        )}
                    </div>
                ) : (
                    <DropdownMenuItem
                        className="rounded-lg text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                        onSelect={() => router.delete(url, options)}
                    >
                        <LogOut className="text-rose-300" />
                        {isPublic
                            ? tr('Відписатися')
                            : tr('Вийти зі спільноти')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Вступ у спільноту з паролем: пароль дає адміністрація спільноти. */
function PasswordDialog({
    open,
    onOpenChange,
    url,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
}) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        router.post(
            url,
            { password },
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onError: (errors) => setError(errors.password ?? null),
                onSuccess: () => onOpenChange(false),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-4 sm:max-w-sm">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {tr('Спільнота з паролем')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr(
                            'Введіть пароль, який дала адміністрація, — і одразу станете учасником.',
                        )}
                    </DialogDescription>
                </div>
                <form onSubmit={submit} className="space-y-3">
                    <input
                        type="password"
                        autoFocus
                        value={password}
                        onChange={(event) => {
                            setPassword(event.target.value);
                            setError(null);
                        }}
                        placeholder={tr('Пароль')}
                        className="input-glass h-11 w-full rounded-xl px-3.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
                    />
                    {error && <p className="text-xs text-rose-300">{error}</p>}
                    <button
                        type="submit"
                        disabled={busy || password === ''}
                        className="btn-glow inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                    >
                        <KeyRound className="size-4" />
                        {tr('Вступити')}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Анкета вступу до закритої спільноти: відповіді побачать адміни в заявці. */
function QuestionsDialog({
    open,
    onOpenChange,
    url,
    questions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
    questions: string[];
}) {
    const [answers, setAnswers] = useState<string[]>(() =>
        questions.map(() => ''),
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        router.post(
            url,
            { answers },
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onError: (errors) => setError(errors.answers ?? null),
                onSuccess: () => onOpenChange(false),
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-md">
                <div>
                    <DialogTitle className="font-display text-lg font-semibold text-white">
                        {tr('Анкета вступу')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-white/50">
                        {tr(
                            'Адміністрація прочитає відповіді й вирішить щодо заявки.',
                        )}
                    </DialogDescription>
                </div>
                <form onSubmit={submit} className="space-y-3">
                    {questions.map((question, i) => (
                        <label
                            key={i}
                            className="block text-sm font-medium text-white/80"
                        >
                            {question}
                            <textarea
                                autoFocus={i === 0}
                                value={answers[i]}
                                onChange={(event) => {
                                    setAnswers(
                                        answers.map((a, j) =>
                                            j === i ? event.target.value : a,
                                        ),
                                    );
                                    setError(null);
                                }}
                                rows={2}
                                maxLength={1000}
                                className="input-glass mt-1.5 w-full resize-y rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                            />
                        </label>
                    ))}
                    {error && <p className="text-xs text-rose-300">{error}</p>}
                    <button
                        type="submit"
                        disabled={busy || answers.some((a) => a.trim() === '')}
                        className="btn-glow inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                    >
                        <UserPlus className="size-4" />
                        {tr('Надіслати заявку')}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

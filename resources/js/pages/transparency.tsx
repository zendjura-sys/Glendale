import { Head, router } from '@inertiajs/react';
import { Flag, Gavel, Scale, ShieldCheck, ShieldOff } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { formatDate, shortNumber } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { motionOr, RISE } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Report = {
    key: string;
    from: string;
    to: string;
    reports: {
        total: number;
        resolved: number;
        dismissed: number;
        pending: number;
        reasons: { reason: string; count: number }[];
    };
    actions: {
        strikes: number;
        strikes_revoked: number;
        bans: number;
        ip_bans: number;
        comments_hidden: number;
        comments_restored: number;
    };
    spam: { kind: string; count: number }[];
    appeals: {
        total: number;
        accepted: number;
        rejected: number;
        median_hours: number | null;
        sla_hours: number;
    };
    verification: { requests: number; approved: number };
};

type Props = {
    quarters: { key: string; label: string; current: boolean }[];
    report: Report;
};

function reasonLabel(r: string): string {
    switch (r) {
        case 'spam':
            return tr('Спам або реклама');
        case 'abuse':
            return tr('Образи, цькування');
        case 'fake':
            return tr('Фейкові сторінки');
        case 'scam':
            return tr('Шахрайство');
        case 'cheat':
            return tr('Читерство');
        case 'child_safety':
            return tr('Безпека дітей');
        default:
            return tr('Інше');
    }
}

function spamLabel(k: string): string {
    switch (k) {
        case 'flood':
            return tr('Флуд');
        case 'repeat':
            return tr('Повтори');
        case 'new_link':
            return tr('Посилання від нових акаунтів');
        case 'group_rule':
            return tr('Правила групових чатів');
        case 'domain':
            return tr('Заборонені домени');
        case 'phishing':
            return tr('Фішинг');
        case 'profanity':
            return tr('Мат');
        case 'ip':
        case 'ip_ban':
            return tr('Блокування за IP');
        case 'guest_ban':
            return tr('Заблоковані гості чатів');
        default:
            return k;
    }
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
    return (
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
            <div className="font-display text-2xl font-bold text-white tabular-nums">
                {value}
            </div>
            <div className="text-xs text-white/55">{label}</div>
        </div>
    );
}

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
    const top = Math.max(1, ...rows.map((r) => r.count));
    if (rows.length === 0)
        return (
            <p className="text-sm text-white/45">
                {tr('За цей період — нуль.')}
            </p>
        );

    return (
        <ul className="space-y-2">
            {rows.map((r) => (
                <li key={r.label}>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/80">{r.label}</span>
                        <span className="text-white/60 tabular-nums">
                            {shortNumber(r.count)}
                        </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(r.count / top) * 100}%` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

function Section({
    icon,
    title,
    children,
    delay,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
    delay: number;
}) {
    const reduce = useReducedMotion();

    return (
        <m.section
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionOr(reduce, { ...RISE, delay })}
            className="gc-solid space-y-3 rounded-2xl p-5"
        >
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white [&_svg]:size-5 [&_svg]:text-primary">
                {icon}
                {title}
            </h2>
            {children}
        </m.section>
    );
}

export default function Transparency({ quarters, report }: Props) {
    const current = quarters.find((q) => q.key === report.key);

    return (
        <>
            <Head title={tr('Звіт прозорості')} />
            <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-0">
                <header className="space-y-2">
                    <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
                        {tr('Звіт прозорості')}
                    </h1>
                    <p className="max-w-2xl text-sm text-white/65">
                        {tr(
                            'Як працює модерація GameCon: скільки скарг надійшло, які рішення ухвалено, скільки апеляцій задоволено. Лише загальні числа — без імен і текстів.',
                        )}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {quarters.map((q) => (
                            <button
                                key={q.key}
                                type="button"
                                onClick={() =>
                                    router.get(
                                        '/transparency',
                                        { q: q.key },
                                        { preserveScroll: true },
                                    )
                                }
                                className={cn(
                                    'rounded-full px-3 py-1.5 text-sm',
                                    q.key === report.key
                                        ? 'bg-primary text-white'
                                        : 'gc-solid text-white/70',
                                )}
                            >
                                {tr(q.label)}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-white/45">
                        {formatDate(report.from)} — {formatDate(report.to)}
                        {current?.current &&
                            ` · ${tr('квартал ще триває, числа оновлюються щогодини')}`}
                    </p>
                </header>

                <Section icon={<Flag />} title={tr('Скарги')} delay={0}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Stat
                            value={shortNumber(report.reports.total)}
                            label={tr('Надійшло')}
                        />
                        <Stat
                            value={shortNumber(report.reports.resolved)}
                            label={tr('Підтверджено, вжито заходів')}
                        />
                        <Stat
                            value={shortNumber(report.reports.dismissed)}
                            label={tr('Порушення не знайдено')}
                        />
                        <Stat
                            value={shortNumber(report.reports.pending)}
                            label={tr('Ще розглядаються')}
                        />
                    </div>
                    <Bars
                        rows={report.reports.reasons.map((r) => ({
                            label: reasonLabel(r.reason),
                            count: r.count,
                        }))}
                    />
                </Section>

                <Section
                    icon={<Gavel />}
                    title={tr('Рішення модерації')}
                    delay={0.05}
                >
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Stat
                            value={shortNumber(report.actions.strikes)}
                            label={tr('Попереджень (страйків)')}
                        />
                        <Stat
                            value={shortNumber(report.actions.bans)}
                            label={tr('Заблокованих акаунтів')}
                        />
                        <Stat
                            value={shortNumber(report.actions.ip_bans)}
                            label={tr('Блокувань за IP')}
                        />
                        <Stat
                            value={shortNumber(report.actions.comments_hidden)}
                            label={tr('Прихованих коментарів')}
                        />
                        <Stat
                            value={shortNumber(
                                report.actions.comments_restored,
                            )}
                            label={tr('Коментарів повернуто після перевірки')}
                        />
                        <Stat
                            value={shortNumber(report.actions.strikes_revoked)}
                            label={tr('Попереджень скасовано')}
                        />
                    </div>
                </Section>

                <Section
                    icon={<ShieldOff />}
                    title={tr('Спам і автозахист')}
                    delay={0.1}
                >
                    <Bars
                        rows={report.spam.map((r) => ({
                            label: spamLabel(r.kind),
                            count: r.count,
                        }))}
                    />
                </Section>

                <div className="grid gap-5 md:grid-cols-2">
                    <Section
                        icon={<Scale />}
                        title={tr('Апеляції')}
                        delay={0.15}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            <Stat
                                value={shortNumber(report.appeals.total)}
                                label={tr('Подано')}
                            />
                            <Stat
                                value={shortNumber(report.appeals.accepted)}
                                label={tr('Задоволено')}
                            />
                            <Stat
                                value={shortNumber(report.appeals.rejected)}
                                label={tr('Відхилено')}
                            />
                        </div>
                        <p className="text-sm text-white/60">
                            {report.appeals.median_hours === null
                                ? tr('Відповідаємо на апеляції до {h} год.', {
                                      h: report.appeals.sla_hours,
                                  })
                                : tr(
                                      'Медіанний час відповіді — {m} год (обіцяємо до {h} год).',
                                      {
                                          m: report.appeals.median_hours,
                                          h: report.appeals.sla_hours,
                                      },
                                  )}
                        </p>
                    </Section>
                    <Section
                        icon={<ShieldCheck />}
                        title={tr('Верифікація')}
                        delay={0.2}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <Stat
                                value={shortNumber(
                                    report.verification.requests,
                                )}
                                label={tr('Заявок')}
                            />
                            <Stat
                                value={shortNumber(
                                    report.verification.approved,
                                )}
                                label={tr('Підтверджено')}
                            />
                        </div>
                    </Section>
                </div>
            </div>
        </>
    );
}

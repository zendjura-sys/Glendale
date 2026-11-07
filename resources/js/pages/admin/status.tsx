import { Head, router, useForm } from '@inertiajs/react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, selectClass } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import {
    componentLabel,
    healthDot,
    healthLabel,
    incidentStatusLabel,
    overallLabel,
} from '@/components/status/labels';
import type {
    Component,
    HealthStatus,
    Incident,
} from '@/components/status/labels';
import { Input } from '@/components/ui/input';
import { formatDate, shortTime } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    overall: HealthStatus;
    components: Component[];
    incidents: Incident[];
    statuses: string[];
};

const textareaClass =
    'input-glass min-h-20 w-full rounded-xl px-3 py-2 text-sm text-white';

/** Адмінка сторінки статусу: стан складників, оголошення збою й хід робіт. */
export default function AdminStatus({
    overall,
    components,
    incidents,
    statuses,
}: Props) {
    const form = useForm({ title: '', severity: 'minor', message: '' });

    const open = (e: FormEvent) => {
        e.preventDefault();
        form.post('/admin/status', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <>
            <Head title={tr('Статус — Адмін-панель')} />
            <PageHeader
                title={tr('Статус')}
                description={overallLabel(overall)}
                actions={
                    <a
                        href="/status"
                        target="_blank"
                        rel="noreferrer"
                        className="gc-solid flex h-10 items-center gap-2 rounded-xl px-4 text-sm text-white/80 hover:text-white"
                    >
                        <ExternalLink className="size-4" />
                        {tr('Відкрита сторінка')}
                    </a>
                }
            />

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                {components.map((c) => (
                    <div key={c.key} className="gc-solid rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'size-2 rounded-full',
                                    healthDot[c.status],
                                )}
                            />
                            <span className="text-xs text-white/50">
                                {healthLabel(c.status)}
                            </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-white">
                            {componentLabel(c.key)}
                        </p>
                        {c.latency_ms !== null && (
                            <p className="mt-0.5 text-xs text-white/35">
                                {c.latency_ms} {tr('мс')}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <form
                onSubmit={open}
                className="gc-solid mb-5 space-y-2 rounded-2xl p-4"
            >
                <h2 className="text-sm font-semibold text-white">
                    {tr('Оголосити збій')}
                </h2>
                <div className="flex flex-wrap gap-2">
                    <div className="min-w-[220px] flex-1">
                        <Input
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                            placeholder={tr(
                                'Що не працює (напр. «Не надходять сповіщення»)',
                            )}
                            className="h-10"
                        />
                        <InputError
                            message={form.errors.title}
                            className="mt-1"
                        />
                    </div>
                    <select
                        value={form.data.severity}
                        onChange={(e) =>
                            form.setData('severity', e.target.value)
                        }
                        className={selectClass}
                    >
                        <option value="minor">{tr('Часткові затримки')}</option>
                        <option value="major">{tr('Серйозний збій')}</option>
                    </select>
                </div>
                <textarea
                    value={form.data.message}
                    onChange={(e) => form.setData('message', e.target.value)}
                    placeholder={tr('Перше повідомлення для людей')}
                    className={textareaClass}
                />
                <InputError message={form.errors.message} />
                <button
                    type="submit"
                    disabled={
                        form.processing ||
                        !form.data.title.trim() ||
                        !form.data.message.trim()
                    }
                    className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                    <Plus className="size-4" /> {tr('Оголосити')}
                </button>
            </form>

            <div className="space-y-3">
                {incidents.map((incident) => (
                    <IncidentRow
                        key={incident.id}
                        incident={incident}
                        statuses={statuses}
                    />
                ))}
                {incidents.length === 0 && (
                    <p className="gc-solid rounded-2xl px-6 py-10 text-center text-sm text-white/40">
                        {tr('Інцидентів ще не було.')}
                    </p>
                )}
            </div>
        </>
    );
}

function IncidentRow({
    incident,
    statuses,
}: {
    incident: Incident;
    statuses: string[];
}) {
    const [status, setStatus] = useState(
        incident.status === 'resolved' ? 'resolved' : 'identified',
    );
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const post = () => {
        setBusy(true);
        router.post(
            `/admin/status/${incident.id}`,
            { status, message },
            {
                preserveScroll: true,
                onSuccess: () => setMessage(''),
                onFinish: () => setBusy(false),
            },
        );
    };

    const remove = () => {
        if (!confirm(tr('Видалити інцидент зі сторінки статусу?'))) {
            return;
        }

        router.delete(`/admin/status/${incident.id}`, {
            preserveScroll: true,
        });
    };

    return (
        <article className="gc-solid rounded-2xl p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="min-w-0 flex-1 font-semibold text-white">
                    {incident.title}
                </h3>
                <span className="text-xs text-white/50">
                    {incidentStatusLabel(incident.status)} ·{' '}
                    {formatDate(incident.started_at)}
                </span>
                <button
                    type="button"
                    onClick={remove}
                    aria-label={tr('Видалити')}
                    className="rounded-lg p-1.5 text-white/40 hover:text-red-400"
                >
                    <Trash2 className="size-4" />
                </button>
            </div>
            <ol className="mt-2 space-y-1.5 text-sm">
                {incident.updates.map((u, i) => (
                    <li key={i} className="text-white/75">
                        <span className="text-white/40">
                            {incidentStatusLabel(u.status)} · {shortTime(u.at)}{' '}
                            —{' '}
                        </span>
                        {u.message}
                    </li>
                ))}
            </ol>
            {incident.status !== 'resolved' && (
                <div className="mt-3 flex flex-wrap gap-2">
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={selectClass}
                    >
                        {statuses.map((s) => (
                            <option key={s} value={s}>
                                {incidentStatusLabel(s)}
                            </option>
                        ))}
                    </select>
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={tr('Що змінилося')}
                        className="h-10 min-w-[200px] flex-1"
                    />
                    <button
                        type="button"
                        onClick={post}
                        disabled={busy || message.trim().length < 3}
                        className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {tr('Опублікувати')}
                    </button>
                </div>
            )}
        </article>
    );
}

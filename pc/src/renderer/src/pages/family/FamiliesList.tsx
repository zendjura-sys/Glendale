import { Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Field, Input, Loading, Modal, PageHeader, StatTile, TextArea, useAction, useSite } from '@/components/kit';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { useNav } from '@/lib/nav';

type Card = {
    id: number;
    slug: string;
    name: string;
    tag: string | null;
    logo_url: string | null;
    members_count: number;
    is_recruiting: boolean;
    status_label: string;
    description?: string | null;
    server?: { name: string } | null;
    membership?: { status: string; rank_title: string };
};
type ListPage = { mine: Card[]; families: { data: Card[]; current_page: number; last_page: number } };

/** «Сім’ї»: мої сім’ї й пошук усіх перевірених сімей із заявкою на вступ (нік, статик, тест зі статуту). */
export function FamiliesList() {
    const nav = useNav();
    const [q, setQ] = useState('');
    const [query, setQuery] = useState('');
    const page = useSite<ListPage>(`/families${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    const [apply, setApply] = useState<Card | null>(null);
    return (
        <div className="flex h-full flex-col">
            <PageHeader title="Сім’ї" subtitle="Ваші сім’ї й пошук нової" />
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5 overflow-y-auto p-5 max-[1100px]:grid-cols-1">
                <div className="min-w-0 space-y-5">
                    {!page.data && <Loading error={page.error} />}
                    {page.data && page.data.mine.length > 0 && (
                        <Card title="Мої сім’ї">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                                {page.data.mine.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => nav.go(`/families/${f.slug}`)}
                                        className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/5 hover:bg-white/[0.07]"
                                    >
                                        <Avatar user={{ name: f.name, avatar_url: f.logo_url }} size={42} />
                                        <span className="min-w-0">
                                            <span className="block truncate font-semibold">
                                                {f.tag ? `[${f.tag}] ` : ''}
                                                {f.name}
                                            </span>
                                            <span className="block truncate text-xs text-white/50">{f.membership?.status === 'pending' ? 'Заявка на розгляді' : f.membership?.rank_title}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                    <Card
                        title="Знайти сім’ю"
                        actions={
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setQuery(q.trim());
                                }}
                                className="relative"
                            >
                                <Search size={14} className="absolute top-2.5 left-2.5 text-white/40" />
                                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Назва чи тег" className="!w-60 pl-8" />
                            </form>
                        }
                    >
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                            {page.data?.families.data.map((f) => (
                                <div key={f.id} className="flex flex-col gap-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                                    <div className="flex items-center gap-3">
                                        <Avatar user={{ name: f.name, avatar_url: f.logo_url }} size={38} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-1.5 truncate font-semibold">
                                                {f.tag ? `[${f.tag}] ` : ''}
                                                {f.name}
                                                {f.is_recruiting && <span className="rounded bg-emerald-400/15 px-1.5 text-[10px] font-medium text-emerald-300">набір</span>}
                                            </span>
                                            <span className="block truncate text-xs text-white/50">
                                                {f.server?.name} · {f.members_count} учасників
                                            </span>
                                        </span>
                                    </div>
                                    {f.description && <p className="line-clamp-2 text-xs text-white/55">{f.description}</p>}
                                    <div className="flex gap-2">
                                        <Button small onClick={() => nav.go(`/families/${f.slug}`)}>
                                            Відкрити
                                        </Button>
                                        {f.is_recruiting && !page.data?.mine.some((m) => m.id === f.id) && (
                                            <Button small tone="primary" onClick={() => setApply(f)}>
                                                Подати заявку
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
                <aside className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <StatTile label="Мої сім’ї" value={page.data?.mine.length ?? '—'} accent />
                        <StatTile label="Набирають" value={page.data ? page.data.families.data.filter((f) => f.is_recruiting).length : '—'} />
                    </div>
                    {page.data && page.data.families.data.some((f) => f.is_recruiting) && (
                        <Card
                            title={
                                <span className="flex items-center gap-2">
                                    <UserPlus size={15} /> Шукають гравців
                                </span>
                            }
                        >
                            {page.data.families.data
                                .filter((f) => f.is_recruiting)
                                .slice(0, 5)
                                .map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => nav.go(`/families/${f.slug}`)}
                                        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-white/5"
                                    >
                                        <Avatar user={{ name: f.name, avatar_url: f.logo_url }} size={30} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm">
                                                {f.tag ? `[${f.tag}] ` : ''}
                                                {f.name}
                                            </span>
                                            <span className="block truncate text-[11px] text-white/45">
                                                {f.server?.name ?? ''} · {f.members_count} учасн.
                                            </span>
                                        </span>
                                    </button>
                                ))}
                        </Card>
                    )}
                    <Card title="Як вступити">
                        <ol className="list-decimal space-y-2 pl-4 text-sm text-white/60">
                            <li>Знайдіть сім’ю на своєму сервері — позначка «набір» означає, що заявки відкриті.</li>
                            <li>Вкажіть нік у грі й статик, за потреби пройдіть тест зі статуту.</li>
                            <li>Після схвалення відкриються звіти, банк, події й голосова кімната сім’ї.</li>
                        </ol>
                    </Card>
                </aside>
            </div>
            {apply && <ApplyModal family={apply} onClose={() => setApply(null)} onDone={async () => (setApply(null), await page.reload())} />}
        </div>
    );
}

function ApplyModal({ family, onClose, onDone }: { family: Card; onClose: () => void; onDone: () => Promise<void> }) {
    const { run, busy } = useAction();
    const [f, setF] = useState({ rp_nickname: '', static_id: '', note: '' });
    const [quiz, setQuiz] = useState<{ q: string; options: string[] }[] | null>(null);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    if (quiz === null)
        void api<{ quiz?: { q: string; options: string[] }[] }>('GET', `/api/v1/site/f/${family.slug}/charter`).then(
            (c) => setQuiz(c.quiz ?? []),
            () => setQuiz([]),
        );
    return (
        <Modal title={`Заявка в [${family.tag ?? ''}] ${family.name}`} onClose={onClose}>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Нік у грі (Ім’я_Прізвище)">
                        <Input value={f.rp_nickname} maxLength={40} onChange={(e) => setF({ ...f, rp_nickname: e.target.value })} />
                    </Field>
                    <Field label="Статик">
                        <Input value={f.static_id} inputMode="numeric" onChange={(e) => setF({ ...f, static_id: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                </div>
                <Field label="Про себе">
                    <TextArea value={f.note} maxLength={1000} onChange={(e) => setF({ ...f, note: e.target.value })} />
                </Field>
                {quiz && quiz.length > 0 && (
                    <div>
                        <p className="mb-2 text-sm font-semibold">Тест зі статуту</p>
                        {quiz.map((q, i) => (
                            <div key={i} className="mb-2">
                                <p className="text-sm">{q.q}</p>
                                {q.options.map((o, j) => (
                                    <label key={j} className="flex items-center gap-2 text-sm text-white/75">
                                        <input type="radio" className="accent-[#22d3ee]" name={`a${i}`} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} /> {o}
                                    </label>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>Скасувати</Button>
                    <Button
                        tone="primary"
                        disabled={busy || !f.rp_nickname || !f.static_id}
                        onClick={() =>
                            void run(
                                'POST',
                                `/f/${family.slug}/apply`,
                                { ...f, note: f.note || null, quiz: quiz?.length ? quiz.map((_, i) => answers[i] ?? null) : undefined },
                                'Заявку надіслано!',
                                onDone,
                            )
                        }
                    >
                        Надіслати
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

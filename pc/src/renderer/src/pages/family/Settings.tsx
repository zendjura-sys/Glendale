import { useState } from 'react';
import { Button, Card, Masonry, Field, Input, Loading, TextArea, useAction, useSite } from '@/components/kit';
import type { FamilyTabProps } from './FamilyPage';

type S = {
    rates: Record<string, number>;
    deposits: { enabled: boolean; daily_rate: number; weekly_rate: number; min_amount: number; max_days: number; max_weeks: number };
    reports: { deadline_hours: number; contract_daily_limit: number; require_proof: boolean; max_proofs: number };
    rating: Record<string, number | boolean>;
    discipline: { warn_days: number; warn_limit: number; escalation: 'demote' | 'kick' };
    cashout: { min_amount: number };
    digest: { enabled: boolean; chat: boolean };
    sections: { events: boolean; warehouse: boolean; rating: boolean };
    shifts: { enabled: boolean; self_claim: boolean; week_limit: number; remind: boolean };
};
type SettingsPage = { profile: { name: string; tag: string; description: string | null; is_recruiting: boolean; logo_url: string | null }; settings: S; digest: { text: string } | null };

const LABELS: Record<string, string> = {
    bizwar_win: 'Перемога в бізварі, $', bizwar_loss: 'Поразка в бізварі, $', contract_light: 'Легкий контракт, $', contract_medium: 'Середній контракт, $', contract_heavy: 'Важкий контракт, $', investment_cashback: 'Кешбек інвестицій, %',
    daily_rate: 'Ставка за день, %', weekly_rate: 'Ставка за тиждень, %', min_amount: 'Мінімальна сума', max_days: 'Макс. днів', max_weeks: 'Макс. тижнів',
    deadline_hours: 'Звіт подати за, год', contract_daily_limit: 'Контрактів на день', require_proof: 'Докази обовʼязкові', max_proofs: 'Скріншотів до',
    bizwar: 'Рахувати бізвари', contracts: 'Рахувати контракти', investments: 'Рахувати інвестиції', events: 'Рахувати події',
    points_bizwar_win: 'Бали: перемога', points_bizwar_loss: 'Бали: поразка', points_contract_light: 'Бали: легкий', points_contract_medium: 'Бали: середній', points_contract_heavy: 'Бали: важкий', points_per_1000: 'Бали за 1000 $ інвестицій', points_event: 'Бали за подію',
    warn_days: 'Варн згорає через, дн.', warn_limit: 'Ліміт варнів', enabled: 'Увімкнено', chat: 'У чат сім’ї', warehouse: 'Склад', rating: 'Рейтинг', self_claim: 'Брати зміни самостійно', week_limit: 'Змін на тиждень (0 — без ліміту)', remind: 'Нагадувати',
};
const GROUPS: { key: keyof S; title: string }[] = [
    { key: 'rates', title: 'Ставки' },
    { key: 'reports', title: 'Звіти' },
    { key: 'deposits', title: 'Депозити' },
    { key: 'cashout', title: 'Виведення' },
    { key: 'rating', title: 'Рейтинг і бали' },
    { key: 'discipline', title: 'Дисципліна' },
    { key: 'sections', title: 'Розділи' },
    { key: 'shifts', title: 'Зміни' },
    { key: 'digest', title: 'Тижневий підсумок' },
];

/** Налаштування сім’ї: профіль (назва, тег, опис, набір, лого) і всі правила — ставки, звіти, рейтинг, дисципліна, розділи. */
export function FamilySettings({ slug, reloadShell }: FamilyTabProps) {
    const page = useSite<SettingsPage>(`/f/${slug}/settings`);
    const { run, busy } = useAction();
    const [profile, setProfile] = useState<SettingsPage['profile'] | null>(null);
    const [settings, setSettings] = useState<S | null>(null);
    const [logo, setLogo] = useState<File | null>(null);
    if (!page.data) return <Loading error={page.error} />;
    const p = profile ?? page.data.profile;
    const s = settings ?? page.data.settings;
    const set = (group: keyof S, key: string, value: unknown): void => setSettings({ ...s, [group]: { ...(s[group] as object), [key]: value } } as S);
    const done = async (): Promise<void> => {
        await page.reload();
        await reloadShell();
    };
    return (
        <div className="space-y-4">
            <Card title="Профіль">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Назва">
                        <Input value={p.name} maxLength={60} onChange={(e) => setProfile({ ...p, name: e.target.value })} />
                    </Field>
                    <Field label="Тег">
                        <Input value={p.tag} maxLength={8} onChange={(e) => setProfile({ ...p, tag: e.target.value })} />
                    </Field>
                </div>
                <div className="mt-3">
                    <Field label="Опис">
                        <TextArea value={p.description ?? ''} maxLength={2000} onChange={(e) => setProfile({ ...p, description: e.target.value })} />
                    </Field>
                </div>
                <div className="mt-3 flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="accent-[#22d3ee]" checked={p.is_recruiting} onChange={(e) => setProfile({ ...p, is_recruiting: e.target.checked })} /> Відкритий набір
                    </label>
                    <label className="text-sm text-white/60">
                        Лого: <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="text-xs" />
                    </label>
                    <div className="flex-1" />
                    <Button
                        tone="primary"
                        disabled={busy}
                        onClick={() =>
                            void (async () => {
                                const files = logo ? [{ field: 'logo', name: logo.name, type: logo.type, data: await logo.arrayBuffer() }] : [];
                                await run('POST', `/f/${slug}/settings/profile`, { __form: true, fields: { name: p.name, tag: p.tag, description: p.description ?? '', is_recruiting: p.is_recruiting }, files }, 'Профіль збережено.', done);
                            })()
                        }
                    >
                        Зберегти профіль
                    </Button>
                </div>
            </Card>
            <Masonry>
                {GROUPS.map((g) => (
                    <Card key={g.key} title={g.title}>
                        <div className="space-y-2">
                            {Object.entries(s[g.key] as Record<string, unknown>).map(([k, v]) =>
                                typeof v === 'boolean' ? (
                                    <label key={k} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" className="accent-[#22d3ee]" checked={v} onChange={(e) => set(g.key, k, e.target.checked)} /> {LABELS[k] ?? k}
                                    </label>
                                ) : k === 'escalation' ? (
                                    <Field key={k} label="На ліміті варнів">
                                        <select value={String(v)} onChange={(e) => set(g.key, k, e.target.value)} className="w-full rounded-lg bg-white/[0.05] px-3 py-2 text-sm ring-1 ring-white/10 [&>option]:bg-[#11141f]">
                                            <option value="demote">Понизити в ранзі</option>
                                            <option value="kick">Виключити</option>
                                        </select>
                                    </Field>
                                ) : (
                                    <label key={k} className="flex items-center gap-2 text-sm">
                                        <span className="flex-1 text-white/70">{LABELS[k] ?? k}</span>
                                        <Input type="number" step="any" value={String(v)} onChange={(e) => set(g.key, k, Number(e.target.value))} className="!w-28" />
                                    </label>
                                ),
                            )}
                        </div>
                    </Card>
                ))}
            </Masonry>
            <div className="flex justify-end">
                <Button tone="primary" disabled={busy || !settings} onClick={() => void run('PUT', `/f/${slug}/settings`, s, 'Налаштування збережено.', async () => (setSettings(null), await done()))}>
                    Зберегти налаштування
                </Button>
            </div>
            {page.data.digest?.text && (
                <Card title="Тижневий підсумок (так він виглядатиме)">
                    <pre className="font-sans text-sm whitespace-pre-wrap text-white/75">{page.data.digest.text}</pre>
                </Card>
            )}
        </div>
    );
}

import { Head, router, useForm } from '@inertiajs/react';
import { Database, Globe2, MapPin, RefreshCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader, StatCard } from '@/components/gc/admin';
import { formatDate } from '@/lib/format';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
    countries: { code: string; name: string }[];
    blocked: string[];
    trust_cloudflare: boolean;
    database: {
        available: boolean;
        source: 'dbip' | 'maxmind' | null;
        updated_at: string | null;
        size: number;
    };
    maxmind: { account_id: string | null; has_key: boolean };
    me: { ip: string; country: string | null };
};

const flag = (code: string) =>
    String.fromCodePoint(
        0x1f1e6 + code.charCodeAt(0) - 65,
        0x1f1e6 + code.charCodeAt(1) - 65,
    );

/** Адмінка → Країни: блокування відвідувань сайту й застосунку з вибраних країн. */
export default function AdminGeo({
    countries,
    blocked,
    trust_cloudflare,
    database,
    maxmind,
    me,
}: Props) {
    const form = useForm({ blocked, trust_cloudflare });
    const keys = useForm({
        account_id: maxmind.account_id ?? '',
        license_key: '',
    });
    const [q, setQ] = useState('');
    const byCode = useMemo(
        () => new Map(countries.map((c) => [c.code, c.name])),
        [countries],
    );
    const found = countries.filter(
        (c) =>
            !form.data.blocked.includes(c.code) &&
            (q === '' ||
                c.name.toLowerCase().includes(q.toLowerCase()) ||
                c.code.toLowerCase() === q.toLowerCase()),
    );
    const toggle = (code: string) =>
        form.setData(
            'blocked',
            form.data.blocked.includes(code)
                ? form.data.blocked.filter((c) => c !== code)
                : [...form.data.blocked, code],
        );
    const dirty =
        form.data.blocked.join() !== blocked.join() ||
        form.data.trust_cloudflare !== trust_cloudflare;

    return (
        <>
            <Head title={tr('Країни — адмінка')} />
            <PageHeader
                title={tr('Доступ за країнами')}
                description={tr(
                    'Відвідувачі з вибраних країн бачать сторінку «Недоступно у вашій країні» — і на сайті, і в застосунку. Адміністрацію не блокуємо. Обійти можна через VPN.',
                )}
            />

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Заблоковано країн')}
                    value={blocked.length}
                    icon={Globe2}
                />
                <StatCard
                    label={tr('Ваша країна')}
                    value={
                        me.country ? `${flag(me.country)} ${me.country}` : '—'
                    }
                    hint={me.ip}
                    icon={MapPin}
                    delay={50}
                />
                <StatCard
                    label={tr('База «IP → країна»')}
                    value={
                        database.available
                            ? database.source === 'maxmind'
                                ? 'MaxMind'
                                : 'DB-IP'
                            : tr('немає')
                    }
                    hint={
                        database.updated_at
                            ? tr('оновлено {date}', {
                                  date: formatDate(database.updated_at),
                              })
                            : tr('оновлюється щосереди')
                    }
                    icon={Database}
                    delay={100}
                />
            </div>

            <section className="glass mb-6 rounded-3xl p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="flex-1 font-display text-lg font-semibold text-white">
                        {tr('Заблоковані країни')}
                    </h2>
                    <button
                        type="button"
                        onClick={() =>
                            router.post(
                                '/admin/geo/refresh',
                                {},
                                { preserveScroll: true },
                            )
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 text-sm text-white/75 hover:bg-white/10"
                    >
                        <RefreshCw className="size-4" /> {tr('Оновити базу')}
                    </button>
                </div>
                <div className="mb-3 flex min-h-10 flex-wrap gap-1.5">
                    {form.data.blocked.length === 0 ? (
                        <p className="text-sm text-white/45">
                            {tr('Сайт відкритий для всіх країн.')}
                        </p>
                    ) : (
                        form.data.blocked.map((code) => (
                            <button
                                key={code}
                                type="button"
                                onClick={() => toggle(code)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1 text-sm text-rose-100 hover:bg-rose-500/25"
                            >
                                {flag(code)} {byCode.get(code) ?? code}
                                <X className="size-3.5" />
                            </button>
                        ))
                    )}
                </div>
                <label className="input-glass mb-2 flex h-10 items-center gap-2 rounded-xl px-3">
                    <Search className="size-4 text-white/40" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={tr('Знайти країну')}
                        className="min-w-0 flex-1 bg-transparent text-sm text-white focus:outline-none"
                    />
                </label>
                <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    {found.map((c) => (
                        <button
                            key={c.code}
                            type="button"
                            onClick={() => toggle(c.code)}
                            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-white/75 hover:bg-white/[0.06]"
                        >
                            <span>{flag(c.code)}</span>
                            <span className="flex-1 truncate">{c.name}</span>
                            <span className="font-mono text-xs text-white/35">
                                {c.code}
                            </span>
                        </button>
                    ))}
                </div>
                <label className="mt-4 flex items-start gap-2 text-sm text-white/70">
                    <input
                        type="checkbox"
                        checked={form.data.trust_cloudflare}
                        onChange={(e) =>
                            form.setData('trust_cloudflare', e.target.checked)
                        }
                        className="mt-0.5"
                    />
                    {tr(
                        'Сайт працює через Cloudflare — брати країну з заголовка CF-IPCountry (вмикайте лише якщо це так, інакше заголовок можна підробити).',
                    )}
                </label>
                {form.errors.blocked && (
                    <p className="mt-2 text-xs text-rose-300">
                        {form.errors.blocked}
                    </p>
                )}
                <button
                    type="button"
                    disabled={!dirty || form.processing}
                    onClick={() =>
                        form.put('/admin/geo', { preserveScroll: true })
                    }
                    className={cn(
                        'btn-glow mt-4 h-10 w-full rounded-xl text-sm font-semibold disabled:opacity-40',
                    )}
                >
                    {tr('Зберегти')}
                </button>
            </section>

            <section className="glass rounded-3xl p-4 sm:p-5">
                <h2 className="mb-1 font-display text-lg font-semibold text-white">
                    MaxMind GeoLite2
                </h2>
                <p className="mb-3 text-sm text-white/50">
                    {tr(
                        'Необов’язково. Без ключа використовується безкоштовна база DB-IP Lite. З ключем MaxMind (безкоштовний акаунт на maxmind.com) база точніша.',
                    )}
                </p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        keys.put('/admin/geo/maxmind', {
                            preserveScroll: true,
                            onSuccess: () => keys.reset('license_key'),
                        });
                    }}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
                >
                    <input
                        value={keys.data.account_id}
                        onChange={(e) =>
                            keys.setData('account_id', e.target.value)
                        }
                        placeholder="Account ID"
                        className="input-glass h-10 rounded-xl px-3 text-sm text-white"
                    />
                    <input
                        type="password"
                        value={keys.data.license_key}
                        onChange={(e) =>
                            keys.setData('license_key', e.target.value)
                        }
                        placeholder={
                            maxmind.has_key
                                ? tr(
                                      'Ключ збережено — введіть новий, щоб змінити',
                                  )
                                : 'License Key'
                        }
                        autoComplete="off"
                        className="input-glass h-10 rounded-xl px-3 text-sm text-white"
                    />
                    <button
                        type="submit"
                        className="h-10 rounded-xl bg-white/[0.08] px-4 text-sm font-semibold text-white hover:bg-white/[0.12]"
                    >
                        {tr('Зберегти')}
                    </button>
                </form>
                {(keys.errors.account_id || keys.errors.license_key) && (
                    <p className="mt-2 text-xs text-rose-300">
                        {keys.errors.account_id ?? keys.errors.license_key}
                    </p>
                )}
            </section>
        </>
    );
}

import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    KeyRound,
    PlugZap,
    ShieldCheck,
    Trash2,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { IntegrationCard } from '@/components/cinema/integration-card';
import type { CinemaIntegration } from '@/components/cinema/integration-card';
import { PageHeader, Pill, StatCard } from '@/components/gc/admin';
import { SpotifyLogo } from '@/components/music/track-cover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tr } from '@/lib/i18n';

type Props = {
    spotify: {
        client_id: string | null;
        secret_hint: string | null;
        from_env: boolean;
        configured: boolean;
        redirect_uri: string;
        accounts: number;
        premium: number;
        scopes: string[];
    };
    cinema: CinemaIntegration[];
};

function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    toast.success(tr('Скопійовано.'));
}

export default function AdminIntegrations({ spotify, cinema }: Props) {
    const [reveal, setReveal] = useState(false);
    const form = useForm({
        client_id: spotify.client_id ?? '',
        client_secret: '',
    });

    const save = () =>
        form.put('/admin/integrations/spotify', {
            preserveScroll: true,
            onSuccess: () => form.setData('client_secret', ''),
        });

    return (
        <>
            <Head title={tr('Інтеграції — Адмін-панель')} />
            <PageHeader
                title={tr('Інтеграції')}
                description={tr(
                    'Ключі зовнішніх сервісів: зберігаються зашифрованими й не потрапляють у браузер користувачів.',
                )}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                    label={tr('Статус Spotify')}
                    value={
                        spotify.configured
                            ? tr('Активно')
                            : tr('Не налаштовано')
                    }
                    icon={PlugZap}
                    tone={
                        spotify.configured
                            ? 'from-[#1ed760] to-[#38e1ff]'
                            : 'from-[#ff7a59] to-[#f04fd8]'
                    }
                />
                <StatCard
                    label={tr('Під’єднали Spotify')}
                    value={String(spotify.accounts)}
                    icon={UsersRound}
                    delay={60}
                />
                <StatCard
                    label={tr('З Premium')}
                    value={String(spotify.premium)}
                    icon={ShieldCheck}
                    tone="from-[#f04fd8] to-[#a855f7]"
                    delay={120}
                />
            </div>

            <section className="glass relative overflow-hidden rounded-3xl p-6">
                <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[#1ed760]/10 blur-3xl" />
                <header className="relative mb-6 flex flex-wrap items-center gap-4">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-[#1ed760]/10 ring-1 ring-[#1ed760]/30">
                        <SpotifyLogo className="size-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                            Spotify
                            {spotify.configured ? (
                                <Pill tone="green">
                                    <CheckCircle2 className="size-3" />{' '}
                                    {tr('Підключено')}
                                </Pill>
                            ) : (
                                <Pill tone="gold">{tr('Потрібні ключі')}</Pill>
                            )}
                            {spotify.from_env && (
                                <Pill tone="blue">{tr('з .env')}</Pill>
                            )}
                        </h2>
                        <p className="text-sm text-white/50">
                            {tr(
                                'Пошук, плейлисти, «Зараз грає» та відтворення через Web Playback SDK.',
                            )}
                        </p>
                    </div>
                    <a
                        href="https://developer.spotify.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                        Spotify Dashboard <ExternalLink className="size-4" />
                    </a>
                </header>

                <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
                    <div className="grid content-start gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="client_id">Client ID</Label>
                            <Input
                                id="client_id"
                                value={form.data.client_id}
                                onChange={(e) =>
                                    form.setData(
                                        'client_id',
                                        e.target.value.trim(),
                                    )
                                }
                                placeholder={tr('32 символи, напр. 1a2b3c…')}
                                autoComplete="off"
                                spellCheck={false}
                                className="font-mono"
                            />
                            {form.errors.client_id && (
                                <p className="text-xs text-rose-300">
                                    {form.errors.client_id}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="client_secret">Client Secret</Label>
                            <div className="relative">
                                <Input
                                    id="client_secret"
                                    type={reveal ? 'text' : 'password'}
                                    value={form.data.client_secret}
                                    onChange={(e) =>
                                        form.setData(
                                            'client_secret',
                                            e.target.value.trim(),
                                        )
                                    }
                                    placeholder={
                                        spotify.secret_hint
                                            ? tr('Збережено {secret_hint}', {
                                                  secret_hint:
                                                      spotify.secret_hint,
                                              })
                                            : tr('Вставте Client Secret')
                                    }
                                    autoComplete="new-password"
                                    spellCheck={false}
                                    className="pr-11 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setReveal(!reveal)}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 hover:text-white"
                                    aria-label={tr('Показати секрет')}
                                >
                                    {reveal ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>
                            {form.errors.client_secret && (
                                <p className="text-xs text-rose-300">
                                    {form.errors.client_secret}
                                </p>
                            )}
                            {spotify.secret_hint &&
                                !form.errors.client_secret && (
                                    <p className="text-xs text-white/40">
                                        {tr(
                                            'Залиште поле порожнім, щоб не змінювати збережений секрет.',
                                        )}
                                    </p>
                                )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                            <button
                                type="button"
                                onClick={save}
                                disabled={form.processing}
                                className="btn-glow inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                            >
                                <KeyRound className="size-4" />{' '}
                                {tr('Зберегти ключі')}
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(
                                        '/admin/integrations/spotify/test',
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                                disabled={!spotify.configured}
                                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-40"
                            >
                                <PlugZap className="size-4" />{' '}
                                {tr('Перевірити з’єднання')}
                            </button>
                            {spotify.configured && !spotify.from_env && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        window.confirm(
                                            tr(
                                                'Видалити ключі Spotify? Користувачі не зможуть слухати Spotify.',
                                            ),
                                        ) &&
                                        router.put(
                                            '/admin/integrations/spotify',
                                            { clear: true },
                                            { preserveScroll: true },
                                        )
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
                                >
                                    <Trash2 className="size-4" />{' '}
                                    {tr('Видалити')}
                                </button>
                            )}
                        </div>
                    </div>

                    <aside className="space-y-3 rounded-2xl bg-white/[0.035] p-4 text-sm text-white/65">
                        <p className="font-semibold text-white">
                            {tr('Як отримати ключі')}
                        </p>
                        <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed">
                            <li>
                                {tr(
                                    'Відкрийте Spotify Dashboard → «Create app».',
                                )}
                            </li>
                            <li>
                                {tr('У полі')} <b>Redirect URI</b>{' '}
                                {tr('вкажіть адресу нижче.')}
                            </li>
                            <li>
                                {tr('Позначте')} <b>Web API</b> {tr('і')}{' '}
                                <b>Web Playback SDK</b>.
                            </li>
                            <li>
                                {tr('Скопіюйте')} <b>Client ID</b> {tr('і')}{' '}
                                <b>Client Secret</b> {tr('у форму.')}
                            </li>
                        </ol>
                        <div>
                            <p className="mb-1 text-xs text-white/45">
                                Redirect URI
                            </p>
                            <button
                                type="button"
                                onClick={() => copy(spotify.redirect_uri)}
                                className="flex w-full items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-left font-mono text-xs break-all text-[#9fffc5] transition hover:bg-black/40"
                            >
                                <span className="flex-1">
                                    {spotify.redirect_uri}
                                </span>
                                <Copy className="size-4 shrink-0 text-white/50" />
                            </button>
                        </div>
                        <p className="text-xs leading-relaxed text-white/40">
                            {tr(
                                'Поки застосунок у режимі Development, додайте користувачів у розділі «User Management» Spotify Dashboard.',
                            )}
                        </p>
                    </aside>
                </div>
            </section>

            {(
                [
                    [
                        'auth',
                        tr('Вхід через соцмережі'),
                        tr(
                            'Кнопки «Увійти через Discord / Google» на сторінках входу й реєстрації та прив’язка акаунтів у налаштуваннях.',
                        ),
                    ],
                    [
                        'push',
                        tr('Застосунок'),
                        tr(
                            'Push-сповіщення в Android-застосунку GameCon: лайки, коментарі, заявки, події сімей і нові повідомлення.',
                        ),
                    ],
                    [
                        'voice',
                        tr('Голосові кімнати'),
                        tr(
                            'Голосові канали сімей і спільнот на сайті та в застосунку. Потрібен власний сервер LiveKit.',
                        ),
                    ],
                    [
                        'games',
                        tr('Каталог ігор'),
                        tr(
                            'Звідки беруться мультиплеєрні ігри для каталогу й вибору гри в кланах. Без ключа працює стартовий список.',
                        ),
                    ],
                    [
                        'players',
                        tr('Кіно: плеєри'),
                        tr(
                            'Звідки беруться фільми та озвучки. Обидва балансери підтримують автонаповнення каталогу.',
                        ),
                    ],
                    [
                        'translate',
                        tr('Переклад'),
                        tr(
                            'Автопереклад інтерфейсу на інші мови й кнопка «Перекласти» під записами.',
                        ),
                    ],
                    [
                        'metadata',
                        tr('Кіно: метадані'),
                        tr(
                            'Назви, описи, постери, трейлери та рейтинги для кожного тайтлу.',
                        ),
                    ],
                ] as const
            ).map(([group, title, text]) => (
                <div key={group} className="mt-8">
                    <h2 className="font-display text-lg font-semibold text-white">
                        {title}
                    </h2>
                    <p className="mb-4 text-sm text-white/45">{text}</p>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {cinema
                            .filter((c) => c.group === group)
                            .map((c) => (
                                <IntegrationCard key={c.key} integration={c} />
                            ))}
                    </div>
                </div>
            ))}
        </>
    );
}

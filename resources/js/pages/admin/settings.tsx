import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    FileText,
    Globe,
    Scale,
    Mail,
    Search,
    ShieldCheck,
    Smartphone,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, PropsWithChildren, ReactNode } from 'react';
import { PageHeader, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { PLAY_BADGES } from '@/components/gc/play-store';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type Settings = {
    site_name: string;
    tagline: string;
    seo_description: string;
    play_store_enabled: boolean;
    play_store_url: string;
    play_store_badge: 'get' | 'preregister';
    registration_open: boolean;
    email_verification: boolean;
    max_post_length: number;
    max_attachments: number;
    max_upload_mb: number;
    max_message_file_mb: number;
    music_max_track_mb: number;
    maintenance_message: string;
    legal_operator: string;
    legal_email: string;
    legal_address: string;
    legal_country: string;
    legal_updated: string;
    legal_tax_id: string;
    legal_registry: string;
    legal_phone: string;
    legal_tax_status: string;
};

type LegalKey =
    | 'legal_operator'
    | 'legal_email'
    | 'legal_address'
    | 'legal_country'
    | 'legal_updated'
    | 'legal_tax_id'
    | 'legal_registry'
    | 'legal_phone'
    | 'legal_tax_status';

/** Поля реквізитів: порожнє поле — значення з .env (LEGAL_*), воно показане підказкою. */
const LEGAL_FIELDS = (): {
    key: LegalKey;
    label: string;
    hint: string;
    type?: string;
}[] => [
    {
        key: 'legal_operator',
        label: tr('Продавець'),
        hint: tr('Як у виписці з ЄДР, напр. «ФОП Іваненко Іван Іванович».'),
    },
    {
        key: 'legal_tax_id',
        label: tr('РНОКПП (ІПН)'),
        hint: tr(
            '10 цифр; для ФОП закон вимагає показувати його покупцям. Є у виписці з ЄДР.',
        ),
    },
    {
        key: 'legal_registry',
        label: tr('Запис в ЄДР'),
        hint: tr(
            'Номер і дата запису про реєстрацію ФОП (виписка з ЄДР у Дії або на usr.minjust.gov.ua).',
        ),
    },
    {
        key: 'legal_phone',
        label: tr('Телефон'),
        hint: tr('Для звернень покупців, напр. +380 67 123 45 67.'),
    },
    {
        key: 'legal_tax_status',
        label: tr('Податковий статус'),
        hint: tr(
            'Напр. «платник єдиного податку 3 групи, не є платником ПДВ».',
        ),
    },
    {
        key: 'legal_email',
        label: tr('E-mail для звернень'),
        hint: tr(
            'Сюди пишуть покупці й платіжні сервіси; скринька має приймати листи.',
        ),
        type: 'email',
    },
    {
        key: 'legal_address',
        label: tr('Адреса'),
        hint: tr(
            'Місцезнаходження ФОП (адреса реєстрації з виписки ЄДР) — обовʼязково для інтернет-продажу.',
        ),
    },
    {
        key: 'legal_country',
        label: tr('Країна (право якої застосовується)'),
        hint: tr('Англійською, напр. Ukraine — підставляється в усі мови.'),
    },
    {
        key: 'legal_updated',
        label: tr('Дата редакції документів'),
        hint: tr('Показується як «Оновлено»; змінюйте, коли правите тексти.'),
        type: 'date',
    },
];

function Section({
    icon: Icon,
    title,
    description,
    children,
}: PropsWithChildren<{
    icon: LucideIcon;
    title: string;
    description: string;
}>) {
    return (
        <section className="glass grid grid-cols-1 gap-6 rounded-3xl p-6 md:grid-cols-[260px_1fr]">
            <div>
                <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
                    <Icon className="size-[18px] text-gc-lilac-300" />
                </span>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/45">
                    {description}
                </p>
            </div>
            <div className="grid content-start gap-5">{children}</div>
        </section>
    );
}

function SwitchRow({
    title,
    text,
    checked,
    onChange,
}: {
    title: string;
    text: ReactNode;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex-1">
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="mt-0.5 text-xs text-white/45">{text}</div>
            </div>
            <Toggle checked={checked} onChange={onChange} label={title} />
        </div>
    );
}

type MailStatus = {
    mailer: string;
    from: string;
    social: string;
    ready: boolean;
};

function MailSection({ mail }: { mail: MailStatus }) {
    const [email, setEmail] = useState(usePage().props.auth.user?.email ?? '');
    const [sending, setSending] = useState(false);

    const send = () => {
        setSending(true);
        router.post(
            '/admin/settings/mail-test',
            { email },
            { preserveScroll: true, onFinish: () => setSending(false) },
        );
    };

    return (
        <Section
            icon={Mail}
            title={tr('Пошта')}
            description={tr(
                'Службові листи (пароль, підтвердження пошти) йдуть в «Оповіщення», події друзів і коментарів — в «Соцмережі».',
            )}
        >
            <div
                className={cn(
                    'rounded-2xl border px-4 py-3 text-sm',
                    mail.ready
                        ? 'border-white/10 text-white/70'
                        : 'border-amber-400/30 bg-amber-400/10 text-amber-100',
                )}
            >
                {mail.ready ? (
                    <>
                        {tr('Відправка:')}{' '}
                        <b className="text-white">{mail.mailer}</b>
                        <span className="mt-1 block">
                            {tr('Оповіщення:')}{' '}
                            <b className="text-white">{mail.from}</b>
                        </span>
                        <span className="mt-1 block">
                            {tr('Соцмережі:')}{' '}
                            <b className="text-white">{mail.social}</b>
                        </span>
                    </>
                ) : (
                    <>
                        {tr('Пошта в режимі')} <b>{mail.mailer}</b>
                        {tr(
                            ': листи лише записуються в журнал і нікому не надходять. Вкажіть у .env MAIL_MAILER=sendmail і запустіть deploy/mail/setup-mail.sh на сервері.',
                        )}
                    </>
                )}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="mail_test">{tr('Тестовий лист')}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        id="mail_test"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        maxLength={190}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={sending || email.trim() === ''}
                        onClick={send}
                        className="shrink-0"
                    >
                        {sending && <Spinner />}
                        {tr('Надіслати обидва листи')}
                    </Button>
                </div>
            </div>
        </Section>
    );
}

export default function AdminSettings({
    settings,
    mail,
    legal_defaults,
}: {
    settings: Settings;
    mail: MailStatus;
    legal_defaults: Record<LegalKey, string>;
}) {
    const form = useForm<Settings>({
        ...settings,
        tagline: settings.tagline ?? '',
        seo_description: settings.seo_description ?? '',
        play_store_enabled: Boolean(settings.play_store_enabled),
        play_store_url: settings.play_store_url ?? '',
        play_store_badge:
            settings.play_store_badge === 'preregister' ? 'preregister' : 'get',
        maintenance_message: settings.maintenance_message ?? '',
        legal_operator: settings.legal_operator ?? '',
        legal_email: settings.legal_email ?? '',
        legal_address: settings.legal_address ?? '',
        legal_country: settings.legal_country ?? '',
        legal_updated: settings.legal_updated ?? '',
        legal_tax_id: settings.legal_tax_id ?? '',
        legal_registry: settings.legal_registry ?? '',
        legal_phone: settings.legal_phone ?? '',
        legal_tax_status: settings.legal_tax_status ?? '',
    });
    const { data, setData, errors, processing } = form;

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put('/admin/settings', {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };

    return (
        <>
            <Head title={tr('Налаштування — Адмін-панель')} />
            <PageHeader
                title={tr('Налаштування сайту')}
                description={tr('Загальні параметри платформи')}
            />

            <form onSubmit={submit} className="space-y-4">
                <Section
                    icon={Globe}
                    title={tr('Загальне')}
                    description={tr(
                        'Назва та слоган відображаються в заголовку, на головній і в листах.',
                    )}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="site_name">{tr('Назва сайту')}</Label>
                        <Input
                            id="site_name"
                            value={data.site_name}
                            onChange={(e) =>
                                setData('site_name', e.target.value)
                            }
                            required
                            maxLength={60}
                        />
                        <InputError message={errors.site_name} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="tagline">{tr('Слоган')}</Label>
                        <Input
                            id="tagline"
                            value={data.tagline}
                            onChange={(e) => setData('tagline', e.target.value)}
                            maxLength={140}
                        />
                        <InputError message={errors.tagline} />
                    </div>
                </Section>

                <Section
                    icon={Search}
                    title="SEO"
                    description={tr(
                        'Опис для пошуку і превʼю посилання в месенджерах. Картинка — логотип сайту.',
                    )}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="seo_description">{tr('Опис')}</Label>
                        <textarea
                            id="seo_description"
                            value={data.seo_description}
                            onChange={(e) =>
                                setData('seo_description', e.target.value)
                            }
                            rows={3}
                            maxLength={300}
                            placeholder={tr('Коротко, чим є GameCon')}
                            className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30"
                        />
                        <InputError message={errors.seo_description} />
                    </div>
                    <img
                        loading="lazy"
                        decoding="async"
                        src="/og.jpg"
                        alt={tr('Превʼю посилання GameCon')}
                        className="aspect-[1200/630] w-full max-w-md rounded-2xl border border-white/10"
                    />
                </Section>

                <Section
                    icon={Scale}
                    title={tr('Юридичні дані')}
                    description={tr(
                        'Реквізити продавця в умовах використання, політиці конфіденційності й політиці повернення коштів. Їх бачать покупці й платіжні сервіси під час перевірки сайту.',
                    )}
                >
                    {LEGAL_FIELDS().map((field) => (
                        <div key={field.key} className="grid gap-2">
                            <Label htmlFor={field.key}>{field.label}</Label>
                            <Input
                                id={field.key}
                                type={field.type ?? 'text'}
                                value={data[field.key]}
                                onChange={(e) =>
                                    setData(field.key, e.target.value)
                                }
                                placeholder={legal_defaults[field.key]}
                                maxLength={250}
                            />
                            <p className="text-xs text-white/45">
                                {field.hint}
                                {field.type === 'date' &&
                                    !data[field.key] &&
                                    legal_defaults[field.key] &&
                                    ` ${tr('Зараз')}: ${legal_defaults[field.key]}.`}
                            </p>
                            <InputError message={errors[field.key]} />
                        </div>
                    ))}
                    <p className="text-xs text-white/45">
                        {tr(
                            'Порожнє поле — значення з .env (показане сірим). Сторінки:',
                        )}{' '}
                        {[
                            '/terms',
                            '/privacy',
                            '/refund-policy',
                            '/pricing',
                        ].map((href, i) => (
                            <span key={href}>
                                {i > 0 && ' · '}
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-gc-lilac-300 hover:underline"
                                >
                                    {href}
                                </a>
                            </span>
                        ))}
                    </p>
                </Section>

                <Section
                    icon={Smartphone}
                    title="Google Play"
                    description={tr(
                        'Кнопка завантаження зʼявляється на головній, у бічному меню і в мобільному меню, коли ввімкнено і вказано посилання.',
                    )}
                >
                    <SwitchRow
                        title={tr('Показувати кнопку')}
                        text={tr(
                            'Вимкнено — кнопка ніде не зʼявляється, навіть якщо посилання збережене.',
                        )}
                        checked={data.play_store_enabled}
                        onChange={(v) => setData('play_store_enabled', v)}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="play_store_url">
                            {tr('Посилання на Google Play')}
                        </Label>
                        <Input
                            id="play_store_url"
                            type="url"
                            inputMode="url"
                            value={data.play_store_url}
                            onChange={(e) =>
                                setData('play_store_url', e.target.value)
                            }
                            maxLength={300}
                            placeholder="https://play.google.com/store/apps/details?id=…"
                        />
                        <InputError message={errors.play_store_url} />
                    </div>
                    <div className="grid gap-2">
                        <Label>{tr('Тип застосунку')}</Label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {PLAY_BADGES.map((badge) => (
                                <button
                                    key={badge.value}
                                    type="button"
                                    aria-pressed={
                                        data.play_store_badge === badge.value
                                    }
                                    onClick={() =>
                                        setData('play_store_badge', badge.value)
                                    }
                                    className={cn(
                                        'grid gap-2 rounded-2xl border p-3 text-left transition',
                                        data.play_store_badge === badge.value
                                            ? 'border-primary/70 bg-primary/10'
                                            : 'border-white/10 hover:border-white/25',
                                    )}
                                >
                                    <img
                                        loading="lazy"
                                        decoding="async"
                                        src={badge.src}
                                        alt={badge.title}
                                        className="h-11 w-auto self-start"
                                    />
                                    <span className="text-sm font-medium text-white/85">
                                        {badge.title}
                                    </span>
                                    <span className="text-xs text-white/50">
                                        {badge.text}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <InputError message={errors.play_store_badge} />
                    </div>
                </Section>

                <Section
                    icon={ShieldCheck}
                    title={tr('Реєстрація')}
                    description={tr('Хто і як може приєднатися до спільноти.')}
                >
                    <SwitchRow
                        title={tr('Відкрита реєстрація')}
                        text={tr(
                            'Якщо вимкнено — сторінка реєстрації стане недоступною.',
                        )}
                        checked={data.registration_open}
                        onChange={(v) => setData('registration_open', v)}
                    />
                    <SwitchRow
                        title={tr('Підтвердження пошти')}
                        text={tr(
                            'Вимагати підтвердження email перед доступом до сайту.',
                        )}
                        checked={data.email_verification}
                        onChange={(v) => setData('email_verification', v)}
                    />
                </Section>

                <MailSection mail={mail} />

                <Section
                    icon={FileText}
                    title={tr('Записи та файли')}
                    description={tr('Обмеження для публікацій і завантажень.')}
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="max_post_length">
                                {tr('Довжина запису')}
                            </Label>
                            <Input
                                id="max_post_length"
                                type="number"
                                min={100}
                                max={50000}
                                value={data.max_post_length}
                                onChange={(e) =>
                                    setData(
                                        'max_post_length',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.max_post_length} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="max_attachments">
                                {tr('Фото в записі')}
                            </Label>
                            <Input
                                id="max_attachments"
                                type="number"
                                min={1}
                                max={30}
                                value={data.max_attachments}
                                onChange={(e) =>
                                    setData(
                                        'max_attachments',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.max_attachments} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="max_upload_mb">
                                {tr('Розмір файлу, МБ')}
                            </Label>
                            <Input
                                id="max_upload_mb"
                                type="number"
                                min={1}
                                max={200}
                                value={data.max_upload_mb}
                                onChange={(e) =>
                                    setData(
                                        'max_upload_mb',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.max_upload_mb} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="max_message_file_mb">
                                {tr('Файли в повідомленнях, МБ')}
                            </Label>
                            <Input
                                id="max_message_file_mb"
                                type="number"
                                min={1}
                                max={500}
                                value={data.max_message_file_mb}
                                onChange={(e) =>
                                    setData(
                                        'max_message_file_mb',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.max_message_file_mb} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="music_max_track_mb">
                                {tr('Аудіотреки, МБ')}
                            </Label>
                            <Input
                                id="music_max_track_mb"
                                type="number"
                                min={1}
                                max={500}
                                value={data.music_max_track_mb}
                                onChange={(e) =>
                                    setData(
                                        'music_max_track_mb',
                                        Number(e.target.value),
                                    )
                                }
                            />
                            <InputError message={errors.music_max_track_mb} />
                        </div>
                    </div>
                </Section>

                <Section
                    icon={Wrench}
                    title={tr('Оголошення')}
                    description={tr(
                        'Банер для всіх користувачів над стрічкою — наприклад, про технічні роботи.',
                    )}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="maintenance_message">
                            {tr('Текст оголошення')}
                        </Label>
                        <textarea
                            id="maintenance_message"
                            value={data.maintenance_message}
                            onChange={(e) =>
                                setData('maintenance_message', e.target.value)
                            }
                            rows={3}
                            maxLength={500}
                            placeholder={tr('Порожньо — банер не показується')}
                            className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30"
                        />
                        <InputError message={errors.maintenance_message} />
                    </div>
                </Section>

                <div className="glass-strong sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl p-3">
                    {form.recentlySuccessful && (
                        <span className="text-sm text-emerald-300">
                            {tr('Збережено')}
                        </span>
                    )}
                    {form.isDirty && (
                        <span className="mr-auto pl-2 text-xs text-amber-200/70">
                            {tr('Є незбережені зміни')}
                        </span>
                    )}
                    <Button disabled={processing || !form.isDirty}>
                        {processing && <Spinner />}
                        {tr('Зберегти')}
                    </Button>
                </div>
            </form>
        </>
    );
}

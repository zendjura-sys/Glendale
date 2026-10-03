import { Head, useForm } from '@inertiajs/react';
import {
    FileText,
    Globe,
    Search,
    ShieldCheck,
    Smartphone,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FormEvent, PropsWithChildren, ReactNode } from 'react';
import { PageHeader, Toggle } from '@/components/gc/admin';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { PLAY_BADGES } from '@/components/gc/play-store';
import { cn } from '@/lib/utils';

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
};

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
        <section className="glass grid gap-6 rounded-3xl p-6 md:grid-cols-[260px_1fr]">
            <div>
                <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/10">
                    <Icon className="size-[18px] text-[#9aa8ff]" />
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

export default function AdminSettings({ settings }: { settings: Settings }) {
    const form = useForm<Settings>({
        ...settings,
        tagline: settings.tagline ?? '',
        seo_description: settings.seo_description ?? '',
        play_store_enabled: Boolean(settings.play_store_enabled),
        play_store_url: settings.play_store_url ?? '',
        play_store_badge:
            settings.play_store_badge === 'preregister' ? 'preregister' : 'get',
        maintenance_message: settings.maintenance_message ?? '',
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
            <Head title="Налаштування — Адмін-панель" />
            <PageHeader
                title="Налаштування сайту"
                description="Загальні параметри платформи"
            />

            <form onSubmit={submit} className="space-y-4">
                <Section
                    icon={Globe}
                    title="Загальне"
                    description="Назва та слоган відображаються в заголовку, на головній і в листах."
                >
                    <div className="grid gap-2">
                        <Label htmlFor="site_name">Назва сайту</Label>
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
                        <Label htmlFor="tagline">Слоган</Label>
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
                    description="Опис для пошуку і превʼю посилання в месенджерах. Картинка — логотип сайту."
                >
                    <div className="grid gap-2">
                        <Label htmlFor="seo_description">Опис</Label>
                        <textarea
                            id="seo_description"
                            value={data.seo_description}
                            onChange={(e) =>
                                setData('seo_description', e.target.value)
                            }
                            rows={3}
                            maxLength={300}
                            placeholder="Коротко, чим є GameCon"
                            className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30"
                        />
                        <InputError message={errors.seo_description} />
                    </div>
                    <img
                        src="/og.jpg"
                        alt="Превʼю посилання GameCon"
                        className="aspect-[1200/630] w-full max-w-md rounded-2xl border border-white/10"
                    />
                </Section>

                <Section
                    icon={Smartphone}
                    title="Google Play"
                    description="Кнопка завантаження зʼявляється на головній, у бічному меню і в мобільному меню, коли ввімкнено і вказано посилання."
                >
                    <SwitchRow
                        title="Показувати кнопку"
                        text="Вимкнено — кнопка ніде не зʼявляється, навіть якщо посилання збережене."
                        checked={data.play_store_enabled}
                        onChange={(v) => setData('play_store_enabled', v)}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="play_store_url">
                            Посилання на Google Play
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
                        <Label>Тип застосунку</Label>
                        <div className="grid gap-3 sm:grid-cols-2">
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
                    title="Реєстрація"
                    description="Хто і як може приєднатися до спільноти."
                >
                    <SwitchRow
                        title="Відкрита реєстрація"
                        text="Якщо вимкнено — сторінка реєстрації стане недоступною."
                        checked={data.registration_open}
                        onChange={(v) => setData('registration_open', v)}
                    />
                    <SwitchRow
                        title="Підтвердження пошти"
                        text="Вимагати підтвердження email перед доступом до сайту."
                        checked={data.email_verification}
                        onChange={(v) => setData('email_verification', v)}
                    />
                </Section>

                <Section
                    icon={FileText}
                    title="Записи та файли"
                    description="Обмеження для публікацій і завантажень."
                >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="grid gap-2">
                            <Label htmlFor="max_post_length">
                                Довжина запису
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
                                Фото в записі
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
                                Розмір файлу, МБ
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
                                Файли в повідомленнях, МБ
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
                                Аудіотреки, МБ
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
                    title="Оголошення"
                    description="Банер для всіх користувачів над стрічкою — наприклад, про технічні роботи."
                >
                    <div className="grid gap-2">
                        <Label htmlFor="maintenance_message">
                            Текст оголошення
                        </Label>
                        <textarea
                            id="maintenance_message"
                            value={data.maintenance_message}
                            onChange={(e) =>
                                setData('maintenance_message', e.target.value)
                            }
                            rows={3}
                            maxLength={500}
                            placeholder="Порожньо — банер не показується"
                            className="input-glass w-full resize-y rounded-xl px-3.5 py-3 text-sm text-white placeholder:text-white/30"
                        />
                        <InputError message={errors.maintenance_message} />
                    </div>
                </Section>

                <div className="glass-strong sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl p-3">
                    {form.recentlySuccessful && (
                        <span className="text-sm text-emerald-300">
                            Збережено
                        </span>
                    )}
                    {form.isDirty && (
                        <span className="mr-auto pl-2 text-xs text-amber-200/70">
                            Є незбережені зміни
                        </span>
                    )}
                    <Button disabled={processing || !form.isDirty}>
                        {processing && <Spinner />}
                        Зберегти
                    </Button>
                </div>
            </form>
        </>
    );
}

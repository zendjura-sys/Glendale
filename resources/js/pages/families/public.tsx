import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Clock3, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { DonationJarCard } from '@/components/gc/donation-jar';
import type { DonationJar } from '@/components/gc/donation-jar';
import { FamilyLogo } from '@/components/families/family-logo';
import {
    btnGhost,
    btnPrimary,
    RankBadge,
    textareaClass,
} from '@/components/families/ui';
import { UserAvatar } from '@/components/gc/user-avatar';
import { ServerIcon } from '@/components/servers/server-icon';
import { Field, inputClass } from '@/components/servers/server-form';
import { formatDate } from '@/lib/format';
import { cn, formText } from '@/lib/utils';
import type { FamilyCard, MemberCard } from '@/types';
import { tr } from '@/lib/i18n';

type Props = {
    family: FamilyCard & { description: string | null; created_at: string };
    leaders: MemberCard[];
    application: {
        status: 'pending' | 'active' | 'left' | 'kicked' | 'declined';
        display: string;
        left_at: string | null;
    } | null;
    blocked: { username: string; name: string }[];
    can_block: boolean;
    /** Банка Monobank сім’ї (відкладений проп). */
    donation?: DonationJar | null;
};

export default function FamilyPublic({
    family,
    leaders,
    application,
    blocked,
    can_block,
    donation,
}: Props) {
    const form = useForm({ rp_nickname: '', static_id: '', note: '' });
    const pending = application?.status === 'pending';
    const canApply =
        family.status === 'verified' &&
        family.is_recruiting &&
        !pending &&
        application?.status !== 'kicked';

    return (
        <>
            <Head title={`[${family.tag}] ${family.name}`} />
            <div className="mx-auto max-w-4xl space-y-4">
                <Link
                    href="/families"
                    className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
                >
                    <ArrowLeft className="size-4" /> {tr('До сімей')}
                </Link>
                <section className="glass noise relative overflow-hidden rounded-2xl">
                    <div className="h-40 sm:h-52">
                        {family.cover_url ? (
                            <img
                                loading="lazy"
                                decoding="async"
                                src={family.cover_url}
                                alt=""
                                className="size-full object-cover"
                            />
                        ) : (
                            <div className="size-full bg-[radial-gradient(120%_120%_at_0%_0%,#38bdf855,transparent_55%),radial-gradient(120%_120%_at_100%_0%,#2f7bff66,transparent_60%),linear-gradient(135deg,#0b0f1d,#141a33)]" />
                        )}
                    </div>
                    <div className="relative -mt-14 flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
                        <FamilyLogo
                            family={family}
                            size="xl"
                            className="ring-4 ring-[#0a0d18]"
                        />
                        <div className="min-w-0 flex-1">
                            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-bold text-white">
                                <span className="text-amber-300">
                                    [{family.tag}]
                                </span>
                                {family.name}
                                {family.status === 'verified' && (
                                    <ShieldCheck className="size-6 text-emerald-300" />
                                )}
                            </h1>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
                                {family.server && (
                                    <Link
                                        href={`/servers/${family.server.slug}`}
                                        className="flex items-center gap-1.5 hover:text-white"
                                    >
                                        <ServerIcon
                                            name={family.server.name}
                                            icon={family.server.icon}
                                            className="size-5 rounded-md text-[8px]"
                                        />
                                        {family.server.name}
                                    </Link>
                                )}
                                <span className="flex items-center gap-1">
                                    <Users className="size-4" />
                                    {family.members_count} {tr('учасників')}
                                </span>
                                <span>
                                    {tr('з')} {formatDate(family.created_at)}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-4">
                        {family.description && (
                            <section className="glass rounded-2xl p-5">
                                <h2 className="mb-2 font-display font-semibold text-white">
                                    {tr('Про сім’ю')}
                                </h2>
                                <p className="text-sm leading-relaxed whitespace-pre-line text-white/65">
                                    {family.description}
                                </p>
                            </section>
                        )}
                        <DonationJarCard
                            jar={donation}
                            title={tr('Підтримати сім’ю')}
                        />
                        <section className="glass rounded-2xl p-5">
                            <h2 className="mb-3 font-display font-semibold text-white">
                                {tr('Керівництво')}
                            </h2>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {leaders.map((m) => (
                                    <div
                                        key={m.id}
                                        className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2.5"
                                    >
                                        <UserAvatar
                                            user={{
                                                name: m.nickname,
                                                avatar_url: m.avatar_url,
                                            }}
                                            size="sm"
                                        />
                                        <div className="min-w-0">
                                            <div className="truncate font-mono text-sm text-white">
                                                {m.display}
                                            </div>
                                            <RankBadge
                                                rank={m.rank}
                                                title={m.rank_title}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <section className="glass h-fit rounded-2xl p-5">
                        {pending ? (
                            <div className="text-center">
                                <Clock3 className="mx-auto size-8 text-amber-300" />
                                <div className="mt-2 font-semibold text-white">
                                    {tr('Заявку надіслано')}
                                </div>
                                <p className="mt-1 text-sm text-white/50">
                                    {tr('Як')}{' '}
                                    <span className="font-mono text-white">
                                        {application.display}
                                    </span>
                                    {tr('. Офіцери отримали сповіщення.')}
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.delete(
                                            `/f/${family.slug}/apply`,
                                            {
                                                preserveScroll: true,
                                            },
                                        )
                                    }
                                    className={cn(btnGhost, 'mt-4 w-full')}
                                >
                                    {tr('Відкликати заявку')}
                                </button>
                            </div>
                        ) : canApply ? (
                            <div className="space-y-3">
                                <h2 className="flex items-center gap-2 font-display font-semibold text-white">
                                    <UserPlus className="size-4 text-amber-300" />
                                    {tr('Вступити до сім’ї')}
                                </h2>
                                {application?.status === 'declined' && (
                                    <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                                        {tr(
                                            'Попередню заявку відхилено — можна подати знову.',
                                        )}
                                    </p>
                                )}
                                <Field
                                    label={tr('RP-нікнейм')}
                                    error={form.errors.rp_nickname}
                                >
                                    <input
                                        value={form.data.rp_nickname}
                                        onChange={(e) =>
                                            form.setData(
                                                'rp_nickname',
                                                e.target.value,
                                            )
                                        }
                                        placeholder={tr('Ім’я_Прізвище')}
                                        className={cn(inputClass, 'font-mono')}
                                    />
                                </Field>
                                <Field
                                    label="Static ID"
                                    error={form.errors.static_id}
                                >
                                    <input
                                        value={form.data.static_id}
                                        onChange={(e) =>
                                            form.setData(
                                                'static_id',
                                                e.target.value.replace(
                                                    /\D/g,
                                                    '',
                                                ),
                                            )
                                        }
                                        inputMode="numeric"
                                        className={cn(inputClass, 'font-mono')}
                                    />
                                </Field>
                                <textarea
                                    value={form.data.note}
                                    onChange={(e) =>
                                        form.setData('note', e.target.value)
                                    }
                                    rows={3}
                                    placeholder={tr(
                                        'Коротко про себе: досвід, онлайн, рекомендації',
                                    )}
                                    className={textareaClass}
                                />
                                <button
                                    type="button"
                                    disabled={form.processing}
                                    onClick={() =>
                                        form.post(`/f/${family.slug}/apply`, {
                                            preserveScroll: true,
                                        })
                                    }
                                    className={cn(btnPrimary, 'h-11 w-full')}
                                >
                                    {tr('Надіслати заявку')}
                                </button>
                            </div>
                        ) : (
                            <p className="text-center text-sm text-white/50">
                                {family.status !== 'verified'
                                    ? tr('Сім’я ще проходить верифікацію.')
                                    : application?.status === 'kicked'
                                      ? tr('Вас було виключено з цієї сім’ї.')
                                      : tr('Набір до сім’ї зараз закрито.')}
                            </p>
                        )}
                    </section>
                    {can_block && (
                        <section className="glass space-y-3 rounded-2xl p-4">
                            <h2 className="font-display text-base font-semibold text-white">
                                {tr('Чорний список')}
                            </h2>
                            <form
                                className="flex gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const data = new FormData(
                                        event.currentTarget,
                                    );
                                    router.post(`/f/${family.slug}/block`, {
                                        username: formText(data, 'username'),
                                    });
                                    event.currentTarget.reset();
                                }}
                            >
                                <input
                                    name="username"
                                    placeholder={tr('Нік')}
                                    className="input-glass h-10 flex-1 rounded-xl px-3 text-sm text-white"
                                />
                                <button
                                    type="submit"
                                    className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-black"
                                >
                                    {tr('Заблокувати')}
                                </button>
                            </form>
                            {blocked.map((person) => (
                                <div
                                    key={person.username}
                                    className="flex items-center justify-between text-sm text-white/75"
                                >
                                    <span>{person.name}</span>
                                    <button
                                        type="button"
                                        className="text-xs text-rose-300"
                                        onClick={() =>
                                            router.delete(
                                                `/f/${family.slug}/block/${person.username}`,
                                            )
                                        }
                                    >
                                        {tr('Прибрати')}
                                    </button>
                                </div>
                            ))}
                        </section>
                    )}
                </div>
            </div>
        </>
    );
}

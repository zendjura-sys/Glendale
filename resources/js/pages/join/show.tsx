import { Head, useForm } from '@inertiajs/react';
import { tr } from '@/lib/i18n';

type Props = {
    token: string;
    invite: {
        kind: 'clan' | 'family' | 'community';
        name: string;
        href: string;
        needs_identity: boolean;
    };
};

export default function JoinShow({ token, invite }: Props) {
    const form = useForm({ rp_nickname: '', static_id: '' });
    const kind =
        invite.kind === 'family'
            ? tr('Сім’я')
            : invite.kind === 'community'
              ? tr('Спільнота')
              : tr('Клан');

    return (
        <>
            <Head title={tr('Запрошення')} />
            <section className="glass mx-auto max-w-md rounded-3xl p-6">
                <p className="text-xs font-semibold text-white/40">{kind}</p>
                <h1 className="mt-1 font-display text-2xl font-bold text-white">
                    {invite.name}
                </h1>
                <p className="mt-2 text-sm text-white/55">
                    {tr('Вас запросили приєднатися.')}
                </p>
                <form
                    className="mt-5 space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(`/join/${token}`);
                    }}
                >
                    {invite.needs_identity && (
                        <>
                            <input
                                value={form.data.rp_nickname}
                                onChange={(event) =>
                                    form.setData(
                                        'rp_nickname',
                                        event.target.value,
                                    )
                                }
                                placeholder={tr('Ім’я_Прізвище')}
                                className="input-glass h-11 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/35"
                                autoComplete="off"
                            />
                            {form.errors.rp_nickname && (
                                <p className="text-xs text-rose-300">
                                    {form.errors.rp_nickname}
                                </p>
                            )}
                            <input
                                value={form.data.static_id}
                                onChange={(event) =>
                                    form.setData(
                                        'static_id',
                                        event.target.value,
                                    )
                                }
                                placeholder={tr('Static ID')}
                                className="input-glass h-11 w-full rounded-xl px-3 text-sm text-white placeholder:text-white/35"
                                inputMode="numeric"
                            />
                            {form.errors.static_id && (
                                <p className="text-xs text-rose-300">
                                    {form.errors.static_id}
                                </p>
                            )}
                        </>
                    )}
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="btn-glow h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                        {tr('Прийняти запрошення')}
                    </button>
                </form>
            </section>
        </>
    );
}

import { LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
    LANGUAGE_LABELS,
    MatchRow,
    SKILL_LABELS,
    TIME_LABELS,
} from '@/components/party/teammates';
import type { TeammateMatch } from '@/components/party/teammates';
import { PARTY_PLATFORMS } from '@/components/party/party-card';
import { api } from '@/lib/api';
import { tr } from '@/lib/i18n';

type Result = {
    criteria: {
        games: string[];
        times: string[];
        skill: string | null;
        platform: string | null;
        mic: boolean | null;
        languages: string[];
    };
    matches: (TeammateMatch & { why: string | null })[];
    ai: boolean;
};

/** Підбір словами: «двоє в CS2 ввечері з мікрофоном» — ШІ розбирає запит і пояснює вибір. */
export function TeammateFinder({
    parties,
}: {
    parties: { id: number; title: string }[];
}) {
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState<string | null>(null);

    const find = async () => {
        if (query.trim().length < 3 || busy) return;
        setBusy(true);
        setError(null);
        try {
            setResult(
                await api<Result>('POST', '/party/match/ai', {
                    query: query.trim(),
                }),
            );
        } catch (e) {
            setError(
                e instanceof Error && e.message
                    ? e.message
                    : tr('Не вдалося підібрати. Спробуйте ще раз.'),
            );
        } finally {
            setBusy(false);
        }
    };

    const c = result?.criteria;
    const chips = c
        ? [
              ...c.games,
              ...c.times.map((t) => TIME_LABELS[t] ?? t),
              c.skill ? SKILL_LABELS[c.skill] : null,
              c.platform ? PARTY_PLATFORMS()[c.platform] : null,
              c.mic ? tr('з мікрофоном') : null,
              ...c.languages.map((l) => LANGUAGE_LABELS[l] ?? l),
          ].filter((x): x is string => Boolean(x))
        : [];

    return (
        <section className="gc-solid rounded-xl p-4 sm:p-5" data-ai-teammates>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <Sparkles className="size-5 text-primary" />
                {tr('Опишіть, кого шукаєте')}
            </h2>
            <p className="mt-1 text-sm text-white/55">
                {tr(
                    'Словами, як другу: гра, час, рівень, мікрофон. ШІ знайде, хто підходить, і пояснить чому.',
                )}
            </p>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    find();
                }}
                className="mt-3 flex gap-2"
            >
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={400}
                    placeholder={tr(
                        'Напр.: двоє в CS2 ввечері, з мікрофоном, без токсиків',
                    )}
                    aria-label={tr('Кого шукаєте')}
                    className="input-glass h-11 min-w-0 flex-1 rounded-xl px-3.5 text-sm text-white placeholder:text-white/40"
                />
                <button
                    type="submit"
                    disabled={busy || query.trim().length < 3}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition disabled:opacity-40"
                >
                    {busy ? (
                        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                    ) : (
                        <Sparkles className="size-4" />
                    )}
                    {tr('Підібрати')}
                </button>
            </form>
            {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

            {result && (
                <div className="mt-4">
                    {chips.length > 0 && (
                        <p className="mb-2 flex flex-wrap gap-1.5">
                            {chips.map((chip) => (
                                <span
                                    key={chip}
                                    className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs text-white/70"
                                >
                                    {chip}
                                </span>
                            ))}
                        </p>
                    )}
                    {result.matches.length === 0 ? (
                        <p className="text-sm text-white/50">
                            {tr(
                                'Поки нікого під такий запит — спробуйте менше умов або іншу гру.',
                            )}
                        </p>
                    ) : (
                        <div className="divide-y divide-white/[0.06]">
                            {result.matches.map((match) => (
                                <div key={match.user.id}>
                                    <MatchRow match={match} parties={parties} />
                                    {match.why && (
                                        <p className="-mt-2 mb-3 flex gap-1.5 pl-[60px] text-[13px] text-white/65">
                                            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                            {match.why}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

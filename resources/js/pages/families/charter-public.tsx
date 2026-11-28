import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ClipboardCheck, Scale } from 'lucide-react';
import { tr } from '@/lib/i18n';
import type { FamilyCard } from '@/types';

/** Статут сім’ї для кандидатів: прочитати до заявки. */
export default function FamilyCharterPublic({
    family,
    text,
    quiz,
    pass,
}: {
    family: FamilyCard;
    text: string | null;
    quiz: { q: string; options: string[] }[];
    pass: number;
}) {
    return (
        <>
            <Head title={tr('Статут — {name}', { name: family.name })} />
            <div className="mx-auto max-w-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/f/${family.slug}`}
                        aria-label={tr('Назад')}
                        className="gc-solid-2 flex size-10 items-center justify-center rounded-xl text-white/70 hover:text-white"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <h1 className="font-display text-xl font-bold text-white">
                        {tr('Статут [{tag}] {name}', {
                            tag: family.tag,
                            name: family.name,
                        })}
                    </h1>
                </div>
                <div className="gc-solid rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-line text-white/85">
                    {text ?? (
                        <span className="flex items-center gap-2 text-white/50">
                            <Scale className="size-4" />
                            {tr('Лідер ще не написав статут')}
                        </span>
                    )}
                </div>
                {quiz.length > 0 && (
                    <p className="flex items-center gap-2 text-sm text-white/60">
                        <ClipboardCheck className="size-4 text-primary" />
                        {tr(
                            'У заявці буде тест за статутом: {n} питань, потрібно {pass}% правильних.',
                            { n: quiz.length, pass },
                        )}
                    </p>
                )}
            </div>
        </>
    );
}

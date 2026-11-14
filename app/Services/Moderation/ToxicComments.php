<?php

namespace App\Services\Moderation;

use App\Models\Comment;
use App\Models\User;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiClient;
use Illuminate\Support\Facades\Log;

/**
 * Автоприховування токсичних коментарів. Оцінка 0–100 з простих ознак: образи й погрози,
 * спрямовані на співрозмовника («ти …»), мат, крик капсом. Якщо підключено ІІ, коментарі
 * з «сірої зони» додатково перевіряє модель (після відповіді, без затримки для автора).
 * Прихований коментар бачать згорнутим; автор запису або модератор можуть його повернути.
 */
class ToxicComments
{
    /** Поріг приховування за режимом із налаштувань автомодерації. */
    public const THRESHOLDS = ['soft' => 70, 'strict' => 50];

    /** Образи (з початку слова). */
    private const INSULTS = [
        'дебіл', 'ідіот', 'идиот', 'придур', 'дурн', 'дура\b', 'тупий', 'тупой', 'тупа\b', 'кретин', 'даун', 'урод', 'виродок', 'мразь', 'мраз',
        'чмо', 'лох\b', 'лошара', 'нікчем', 'ничтож', 'скотин', 'тварюк', 'тварь', 'гнида', 'покидьок', 'падл', 'моральн\w* урод',
        'idiot', 'moron', 'retard', 'loser', 'stupid', 'trash\b', 'dumbass',
    ];

    /** Погрози й побажання шкоди — одразу висока оцінка. */
    private const THREATS = [
        'вб\'?ю тебе', 'убью тебя', 'зарі[жз]у', 'зарежу', 'здохни', 'сдохни', 'вбий себе', 'убей себя', 'вішайся', 'вешайся',
        'kys\b', 'kill yourself', 'знайду тебе', 'найду тебя', 'тобі кінець', 'тебе конец',
    ];

    /** Звертання до людини: образа «в когось» важить більше, ніж загальне невдоволення. */
    private const TARGET = '/(?<![\p{L}])(ти|тебе|тобі|твій|твоя|ты|тебя|тебе|твой|you|your|u)(?![\p{L}])/iu';

    public function __construct(private readonly ContentFilter $filter) {}

    public function mode(): string
    {
        return $this->filter->config()['toxic'] ?? 'soft';
    }

    /**
     * Оцінка й причина.
     *
     * @return array{score: int, reason: string}
     */
    public function score(string $text): array
    {
        $t = mb_strtolower($text);
        $reasons = [];
        $score = 0;
        if (preg_match('/(?<![\p{L}])(?:'.implode('|', self::THREATS).')/iu', $t) === 1) {
            return ['score' => 95, 'reason' => 'Погрози або побажання шкоди'];
        }
        $insults = preg_match_all('/(?<![\p{L}])(?:'.implode('|', self::INSULTS).')/iu', $t);
        $targeted = preg_match(self::TARGET, $t) === 1;
        if ($insults > 0) {
            $score += 35 + min(2, $insults - 1) * 10 + ($targeted ? 35 : 0);
            $reasons[] = $targeted ? 'Образа співрозмовника' : 'Образливі слова';
        }
        if ($this->filter->hasProfanity($text)) {
            $score += $targeted ? 30 : 15;
            $reasons[] = 'Мат';
        }
        $letters = preg_replace('/[^\p{L}]/u', '', $text) ?? '';
        $upper = preg_replace('/[^\p{Lu}]/u', '', $text) ?? '';
        if (mb_strlen($letters) >= 12 && mb_strlen($upper) / max(1, mb_strlen($letters)) > 0.7) {
            $score += 10;
            $reasons[] = 'Крик капсом';
        }
        if (preg_match('/[!?]{4,}/', $text) === 1) {
            $score += 5;
        }

        return ['score' => min(100, $score), 'reason' => implode(', ', $reasons)];
    }

    /** Оцінити новий коментар і приховати, якщо поріг перевищено. */
    public function check(Comment $comment): void
    {
        $mode = $this->mode();
        $body = trim((string) $comment->body);
        if ($mode === 'off' || $body === '') {
            return;
        }
        $threshold = self::THRESHOLDS[$mode] ?? 70;
        ['score' => $score, 'reason' => $reason] = $this->score($body);
        $comment->forceFill(['toxicity' => $score]);
        if ($score >= $threshold) {
            $this->hide($comment, $reason);

            return;
        }
        $comment->save();
        // Сіра зона — перепитуємо ІІ, якщо він підключений (після відповіді, щоб не гальмувати).
        if ($score >= 25 && app(AiClient::class)->configured()) {
            $id = $comment->id;
            dispatch(function () use ($id, $threshold) {
                $c = Comment::query()->find($id);
                if (! $c || $c->hidden_at || $c->restored_by) {
                    return;
                }
                $ai = app(AiAssistant::class)->toxicity((string) $c->body);
                if ($ai !== null) {
                    $c->forceFill(['toxicity' => max((int) $c->toxicity, $ai['score'])])->save();
                    if ($ai['score'] >= $threshold) {
                        app(self::class)->hide($c, 'ІІ: '.$ai['reason']);
                    }
                }
            })->afterResponse();
        }
    }

    public function hide(Comment $comment, string $reason): void
    {
        $comment->forceFill(['hidden_at' => now(), 'hidden_reason' => mb_substr($reason !== '' ? $reason : 'Токсичність', 0, 160)])->save();
        Log::info('moderation: comment auto-hidden', ['comment' => $comment->id, 'user' => $comment->user_id, 'score' => $comment->toxicity, 'reason' => $reason]);
    }

    /** Повернути коментар (автор запису або персонал). Повторно автоматика його не ховає. */
    public function restore(Comment $comment, User $by): void
    {
        $comment->forceFill(['hidden_at' => null, 'restored_by' => $by->id])->save();
        Log::info('moderation: comment restored', ['comment' => $comment->id, 'by' => $by->id]);
    }

    /** Приховати вручну (автор запису або персонал). */
    public function hideManually(Comment $comment, User $by): void
    {
        $comment->forceFill(['hidden_at' => now(), 'hidden_reason' => 'Приховано вручну', 'restored_by' => null])->save();
        Log::info('moderation: comment hidden manually', ['comment' => $comment->id, 'by' => $by->id]);
    }
}

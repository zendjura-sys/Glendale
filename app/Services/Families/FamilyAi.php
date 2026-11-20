<?php

namespace App\Services\Families;

use App\Models\Clan;
use App\Models\Family;
use App\Models\FamilyReport;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiException;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * ШІ-помічник сім’ї: готує чернетки, які людина перевіряє й зберігає звичайною кнопкою
 * (а та вже пише журнал аудиту сім’ї). Сам нічого не зберігає й не змінює.
 *
 * - статут за описом і структурою сім’ї (+ питання тесту для вступу);
 * - назви рангів 1–10 у стилі, який описав лідер;
 * - звіт із довільного тексту («зробили 3 контракти середні вчора») — тип, рівень, кількість, дата.
 */
class FamilyAi
{
    /** Запитів ШІ на сім’ю за годину. */
    public const PER_HOUR = 30;

    public function __construct(private readonly AiClient $ai) {}

    /**
     * @return array{text: string, quiz: list<array{q: string, options: list<string>, correct: int}>}
     *
     * @throws AiException|ValidationException
     */
    public function charter(Family $family, string $brief): array
    {
        $this->limit($family);
        $ranks = implode(', ', array_map(fn ($r, $t) => "{$r} — {$t}", array_keys($family->rankTitles()), $family->rankTitles()));
        $prompt = "Сім’я: [{$family->tag}] {$family->name}".($family->server ? ", сервер {$family->server->name}" : '').".\n"
            .'Опис сім’ї: '.Str::limit((string) $family->description, 800)."\n"
            ."Ранги: {$ranks}.\n"
            .'Типи звітів: '.implode(', ', FamilyReport::TYPES).".\n"
            .'Побажання лідера: '.Str::limit($brief, 1200);

        $raw = $this->ai->complete(
            'Ти пишеш статут сім’ї (угруповання) для RP-сервера GTA в соцмережі GameCon. Українською, чітко й по-людськи, без канцеляриту. '
            .'Структура: короткий вступ, розділи з нумерованими правилами (вступ і випробувальний термін, ранги й підвищення, звіти й виплати, '
            .'дисципліна й попередження, поведінка в RP, вихід із сім’ї). Не вигадуй сум і чисел, яких немає в даних, — пиши «за рішенням лідера». '
            .'Потім 5 питань тесту за статутом. Відповідай лише JSON: {"text":"markdown статуту","quiz":[{"q":"питання","options":["a","b","c"],"correct":0}]}',
            [['role' => 'user', 'content' => $prompt]],
            3000,
            task: 'family',
        );
        $data = $this->json($raw);
        $text = Str::limit(trim((string) ($data['text'] ?? '')), FamilyCharter::MAX_TEXT, '');
        if ($text === '') {
            throw new AiException('ШІ не зміг написати статут — спробуйте уточнити побажання.');
        }
        $quiz = [];
        foreach (array_slice((array) ($data['quiz'] ?? []), 0, FamilyCharter::MAX_QUESTIONS) as $item) {
            $options = array_values(array_slice(array_filter(array_map(fn ($o) => Str::limit(trim((string) $o), 120, ''), (array) ($item['options'] ?? []))), 0, 4));
            $q = Str::limit(trim((string) ($item['q'] ?? '')), 200, '');
            $correct = (int) ($item['correct'] ?? 0);
            if ($q !== '' && count($options) >= 2 && $correct >= 0 && $correct < count($options)) {
                $quiz[] = ['q' => $q, 'options' => $options, 'correct' => $correct];
            }
        }

        return ['text' => $text, 'quiz' => $quiz];
    }

    /**
     * Назви рангів 1–10 (1 — новачок, 10 — лідер) у стилі лідера.
     *
     * @return array<int, string>
     *
     * @throws AiException|ValidationException
     */
    public function ranks(Family $family, string $style): array
    {
        $this->limit($family);
        $current = implode(', ', $family->rankTitles());
        $raw = $this->ai->complete(
            'Ти придумуєш назви рангів сім’ї для RP-сервера GTA. 10 рангів: 1 — найнижчий (новачок), 10 — лідер. '
            .'Короткі (1–3 слова, до 24 символів), без лапок і нумерації, у стилі, який просить лідер, без образ. '
            .'Мова — як у побажанні (типово українська). Відповідай лише JSON: {"ranks":["…", … 10 назв]}',
            [['role' => 'user', 'content' => "Сім’я [{$family->tag}] {$family->name}. Зараз: {$current}.\nСтиль: ".Str::limit($style, 500)]],
            600,
            task: 'family',
        );
        $names = array_values(array_filter(array_map(fn ($n) => Str::limit(trim((string) $n), 24, ''), (array) ($this->json($raw)['ranks'] ?? []))));
        if (count($names) < 10) {
            throw new AiException('ШІ не зміг придумати всі 10 рангів — спробуйте інакше описати стиль.');
        }
        $out = [];
        foreach (array_slice($names, 0, 10) as $i => $name) {
            $out[$i + 1] = $name;
        }

        return $out;
    }

    /**
     * Звіт із тексту: тип, рівень (для контрактів), кількість, дата й короткий коментар.
     *
     * @return array{type: string, tier: string|null, count: int, event_date: string, note: string}
     *
     * @throws AiException|ValidationException
     */
    public function report(Family $family, string $text): array
    {
        $this->limit($family);
        $types = implode(', ', array_map(fn ($k, $v) => "{$k} ({$v})", array_keys(FamilyReport::TYPES), FamilyReport::TYPES));
        $tiers = implode(', ', array_map(fn ($k, $v) => "{$k} ({$v})", array_keys(FamilyReport::TIERS), FamilyReport::TIERS));
        $today = now()->toDateString();
        $raw = $this->ai->complete(
            "Ти заповнюєш звіт сім’ї з повідомлення гравця. Сьогодні {$today}. Типи: {$types}. Рівні контракту: {$tiers}. "
            .'Відповідай лише JSON: {"type":"ключ типу","tier":"ключ рівня або null","count":число,"event_date":"YYYY-MM-DD","note":"коротко що зроблено"}. '
            .'Чого немає в тексті — не вигадуй: tier null, count 1, дата сьогодні.',
            [['role' => 'user', 'content' => Str::limit($text, 800)]],
            300,
            task: 'family',
        );
        $data = $this->json($raw);
        $type = array_key_exists((string) ($data['type'] ?? ''), FamilyReport::TYPES) ? (string) $data['type'] : FamilyReport::TYPE_OTHER;
        $tier = array_key_exists((string) ($data['tier'] ?? ''), FamilyReport::TIERS) ? (string) $data['tier'] : null;
        $date = (string) ($data['event_date'] ?? $today);
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date > $today) {
            $date = $today;
        }

        return [
            'type' => $type,
            'tier' => $tier,
            'count' => max(1, min(100, (int) ($data['count'] ?? 1))),
            'event_date' => $date,
            'note' => Str::limit(trim((string) ($data['note'] ?? '')), 300, ''),
        ];
    }

    /**
     * Статут клану чи гільдії (текст правил, без тесту).
     *
     * @throws AiException|ValidationException
     */
    public function clanRules(Clan $clan, string $brief): string
    {
        $this->hit('clan-ai:'.$clan->id);
        $kind = Clan::TYPES[$clan->type] ?? 'Клан';
        $ranks = implode(', ', $clan->rankTitles());
        $raw = $this->ai->complete(
            "Ти пишеш статут ({$kind}) для ігрової спільноти в соцмережі GameCon. Українською, чітко, без канцеляриту. "
            .'Розділи з нумерованими правилами: вступ, ранги й підвищення, участь у подіях і змінах, внески, поведінка, дисципліна, вихід. '
            .'Не вигадуй чисел, яких немає в даних. Відповідай лише JSON: {"text":"markdown статуту"}',
            [['role' => 'user', 'content' => "{$kind} [{$clan->tag}] {$clan->name}".($clan->game ? ', гра '.$clan->game->name : '').'.
Опис: '
                .Str::limit((string) $clan->description, 800)."
Ранги: {$ranks}.
Побажання: ".Str::limit($brief, 1200)]],
            2500,
            task: 'family',
        );
        $text = Str::limit(trim((string) ($this->json($raw)['text'] ?? '')), 10000, '');
        if ($text === '') {
            throw new AiException('ШІ не зміг написати статут — спробуйте уточнити побажання.');
        }

        return $text;
    }

    /**
     * Назви рангів клану чи гільдії (1 — новачок … LEADER_RANK — лідер) у стилі лідера.
     *
     * @return array<int, string>
     *
     * @throws AiException|ValidationException
     */
    public function clanRanks(Clan $clan, string $style): array
    {
        $this->hit('clan-ai:'.$clan->id);
        $n = Clan::LEADER_RANK;
        $raw = $this->ai->complete(
            "Ти придумуєш назви рангів ігрової спільноти. {$n} рангів: 1 — найнижчий, {$n} — лідер. Короткі (1–3 слова, до 24 символів), "
            ."у стилі, який просить лідер, без образ. Відповідай лише JSON: {\"ranks\":[\"…\", … {$n} назв]}",
            [['role' => 'user', 'content' => "[{$clan->tag}] {$clan->name}. Зараз: ".implode(', ', $clan->rankTitles()).".\nСтиль: ".Str::limit($style, 500)]],
            400,
            task: 'family',
        );
        $names = array_values(array_filter(array_map(fn ($x) => Str::limit(trim((string) $x), 24, ''), (array) ($this->json($raw)['ranks'] ?? []))));
        if (count($names) < $n) {
            throw new AiException('ШІ не зміг придумати всі ранги — спробуйте інакше описати стиль.');
        }
        $out = [];
        foreach (array_slice($names, 0, $n) as $i => $name) {
            $out[$i + 1] = $name;
        }

        return $out;
    }

    /** @throws ValidationException */
    private function limit(Family $family): void
    {
        $this->hit('family-ai:'.$family->id);
    }

    /** @throws ValidationException */
    private function hit(string $key): void
    {
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            throw ValidationException::withMessages(['ai' => 'Помічник відпочиває — спробуйте за годину.']);
        }
        RateLimiter::hit($key, 3600);
    }

    /**
     * @return array<string, mixed>
     *
     * @throws AiException
     */
    private function json(string $raw): array
    {
        $start = strpos($raw, '{');
        $end = strrpos($raw, '}');
        $decoded = $start !== false && $end !== false ? json_decode(substr($raw, $start, $end - $start + 1), true) : null;
        if (! is_array($decoded)) {
            throw new AiException('ШІ відповів незрозуміло — спробуйте ще раз.');
        }

        return $decoded;
    }
}

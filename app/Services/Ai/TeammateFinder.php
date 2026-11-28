<?php

namespace App\Services\Ai;

use App\Models\Game;
use App\Models\PartyPost;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Party\Teammates;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * ШІ-підбір тиммейтів: людина пише словами, кого шукає («двоє в CS2 ввечері, з мікрофоном, без токсиків»).
 * ШІ розбирає запит у критерії анкети, ми рахуємо сумісність звичайним підбором (Teammates::score),
 * а ШІ обирає до 6 найкращих і пояснює одним реченням, чому кожен підходить.
 * Без ключа ШІ — критерії вгадуються за назвами ігор і словами, а пояснень немає.
 */
class TeammateFinder
{
    private const PER_HOUR = 20;

    /** Скорочення й сленг → назва гри в каталозі. */
    private const ALIASES = [
        'cs2' => 'Counter-Strike 2', 'кс2' => 'Counter-Strike 2', 'кс' => 'Counter-Strike 2', 'cs' => 'Counter-Strike 2', 'контра' => 'Counter-Strike 2',
        'гта' => 'Grand Theft Auto V', 'gta' => 'Grand Theft Auto V', 'gta5' => 'Grand Theft Auto V', 'гта5' => 'Grand Theft Auto V',
        'дота' => 'Dota 2', 'dota' => 'Dota 2', 'дота2' => 'Dota 2',
        'валорант' => 'Valorant', 'вал' => 'Valorant', 'лол' => 'League of Legends', 'lol' => 'League of Legends',
        'пабг' => 'PUBG: Battlegrounds', 'pubg' => 'PUBG: Battlegrounds', 'фортнайт' => 'Fortnite', 'апекс' => 'Apex Legends',
        'майн' => 'Minecraft', 'майнкрафт' => 'Minecraft', 'варзон' => 'Call of Duty: Warzone', 'раст' => 'Rust', 'дестіні' => 'Destiny 2',
    ];

    public function __construct(
        private readonly AiClient $ai,
        private readonly Teammates $teammates,
        private readonly FriendshipService $friendships,
    ) {}

    /**
     * @return array{criteria: array<string, mixed>, matches: list<array<string, mixed>>, ai: bool}
     *
     * @throws AiException
     */
    public function find(User $viewer, string $query): array
    {
        $query = Str::limit(trim($query), 400, '');
        $ai = app(Plugins::class)->on('ai_teammates');
        if ($ai) {
            $this->limit($viewer);
        }
        try {
            $criteria = $ai ? $this->parse($query) : $this->guess($query);
        } catch (AiException) {
            // ШІ недоступний — розбираємо запит за словами, без пояснень.
            $ai = false;
            $criteria = $this->guess($query);
        }

        // Анкета-«запит»: з критеріїв, а чого не сказано — зі своєї анкети.
        $mine = $this->teammates->profile($viewer);
        $wanted = new TeammateProfile([
            'games' => $criteria['game_ids'] !== [] ? $criteria['game_ids'] : ($mine->games ?? []),
            'languages' => $criteria['languages'] !== [] ? $criteria['languages'] : ($mine->languages ?? []),
            'times' => $criteria['times'] !== [] ? $criteria['times'] : ($mine->times ?? []),
            'skill' => $criteria['skill'] ?? $mine?->skill,
            'platform' => $criteria['platform'] ?? $mine?->platform,
            'mic' => $criteria['mic'] ?? (bool) $mine?->mic,
        ]);

        $scored = $this->teammates->candidates($viewer)
            ->filter(fn (TeammateProfile $p) => $criteria['game_ids'] === [] || array_intersect($criteria['game_ids'], $p->games ?? []) !== [])
            ->filter(fn (TeammateProfile $p) => $criteria['mic'] !== true || $p->mic)
            ->map(fn (TeammateProfile $p) => [$p, $this->teammates->score($wanted, $p)])
            ->filter(fn (array $pair) => $pair[1] !== null)
            ->sortByDesc(fn (array $pair) => $pair[1]['score'])
            ->take(30)->values();

        $names = $this->teammates->gameNames($scored->flatMap(fn (array $pair) => $pair[0]->games ?? [])->all());
        $friends = array_flip($this->friendships->friendIds($viewer));
        $why = [];
        $order = $scored->keys()->all();
        if ($ai && $scored->isNotEmpty()) {
            [$order, $why] = $this->pick($query, array_values($scored->all()), $names);
        }

        $matches = [];
        foreach (array_slice($order, 0, 6) as $index) {
            [$profile, $match] = $scored[$index];
            $matches[] = [
                ...$this->teammates->card($profile, $match, $names, isset($friends[$profile->user_id])),
                'why' => $why[$index] ?? null,
            ];
        }

        return [
            'criteria' => [
                'games' => array_values(array_filter(array_map(fn (int $id) => $names[$id] ?? Game::query()->whereKey($id)->value('name'), $criteria['game_ids']))),
                'times' => $criteria['times'],
                'skill' => $criteria['skill'],
                'platform' => $criteria['platform'],
                'mic' => $criteria['mic'],
                'languages' => $criteria['languages'],
            ],
            'matches' => $matches,
            'ai' => $ai,
        ];
    }

    /**
     * ШІ розбирає запит у критерії анкети (JSON).
     *
     * @return array{game_ids: list<int>, times: list<string>, skill: string|null, platform: string|null, mic: bool|null, languages: list<string>}
     *
     * @throws AiException
     */
    private function parse(string $query): array
    {
        $raw = $this->ai->complete(
            'Розбери запит гравця, який шукає тиммейтів, у JSON без пояснень: '
            .'{"games": ["назви ігор як у запиті"], "times": [з '.implode(', ', array_keys(TeammateProfile::TIMES)).'], '
            .'"skill": одне з '.implode(', ', array_keys(TeammateProfile::SKILLS)).' або null, '
            .'"platform": одне з '.implode(', ', array_keys(PartyPost::PLATFORMS)).' або null, '
            .'"mic": true/false/null, "languages": [з '.implode(', ', array_keys(TeammateProfile::LANGUAGES)).']}. '
            .'Чого в запиті немає — порожньо або null.',
            [['role' => 'user', 'content' => $query]],
            300,
            [],
            'teammates',
        );
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        if (! is_array($json)) {
            return $this->guess($query);
        }
        $pick = fn ($value, array $allowed) => is_string($value) && in_array($value, $allowed, true) ? $value : null;
        $list = fn ($value, array $allowed) => array_values(array_intersect(array_filter((array) $value, 'is_string'), $allowed));

        return [
            'game_ids' => $this->gameIds(array_values(array_filter((array) ($json['games'] ?? []), 'is_string')), $query),
            'times' => $list($json['times'] ?? [], array_keys(TeammateProfile::TIMES)),
            'skill' => $pick($json['skill'] ?? null, array_keys(TeammateProfile::SKILLS)),
            'platform' => $pick($json['platform'] ?? null, array_keys(PartyPost::PLATFORMS)),
            'mic' => is_bool($json['mic'] ?? null) ? $json['mic'] : null,
            'languages' => $list($json['languages'] ?? [], array_keys(TeammateProfile::LANGUAGES)),
        ];
    }

    /**
     * Без ШІ: ігри за назвами, час і мікрофон за ключовими словами.
     *
     * @return array{game_ids: list<int>, times: list<string>, skill: string|null, platform: string|null, mic: bool|null, languages: list<string>}
     */
    private function guess(string $query): array
    {
        $q = mb_strtolower($query);
        $has = fn (array $words) => array_filter($words, fn (string $w) => str_contains($q, $w)) !== [];
        $times = array_keys(array_filter([
            'morning' => $has(['ранк', 'вранці', 'утр']),
            'day' => $has(['вдень', 'днем', 'днём']),
            'evening' => $has(['вечер', 'увечері', 'ввечері']),
            'night' => $has(['ніч', 'ноч']),
            'weekend' => $has(['вихідн', 'выходн', 'субот', 'неділ']),
        ]));

        return [
            'game_ids' => $this->gameIds([], $query),
            'times' => $times,
            'skill' => $has(['нович', 'новач']) ? 'new' : ($has(['профі', 'про ', 'скіл', 'ранкед']) ? 'pro' : null),
            'platform' => $has(['ps5', 'ps4', 'playstation', 'плойк']) ? 'playstation' : ($has(['xbox', 'іксбокс']) ? 'xbox' : ($has(['пк', 'pc', 'комп']) ? 'pc' : null)),
            'mic' => $has(['мікрофон', 'микрофон', 'войс', 'дискорд', 'discord', 'голос']) ? true : null,
            'languages' => [],
        ];
    }

    /**
     * Ігри з каталогу: за назвами від ШІ, інакше — популярні, чия назва є в запиті.
     *
     * @param  list<string>  $names
     * @return list<int>
     */
    private function gameIds(array $names, string $query): array
    {
        $ids = [];
        foreach (array_slice($names, 0, 3) as $name) {
            $name = trim($name);
            if ($name === '') {
                continue;
            }
            $id = Game::query()->where('is_published', true)->where(fn ($q) => $q->where('name', $name)->orWhere('slug', Str::slug($name)))->value('id')
                ?? Game::query()->where('is_published', true)->where('name', 'like', '%'.str_replace(['%', '_'], '', $name).'%')->orderByDesc('popularity')->value('id');
            if ($id !== null) {
                $ids[] = (int) $id;
            }
        }
        if ($ids === []) {
            // Сленгові скорочення назв, які гравці пишуть у запитах.
            $q = ' '.mb_strtolower($query).' ';
            foreach (self::ALIASES as $alias => $name) {
                if (preg_match('/[^\p{L}\p{N}]'.preg_quote($alias, '/').'[^\p{L}\p{N}]/u', $q) === 1) {
                    $q .= ' '.mb_strtolower($name).' ';
                }
            }
            foreach (Game::query()->where('is_published', true)->orderByDesc('popularity')->limit(300)->get(['id', 'name']) as $game) {
                if (mb_strlen($game->name) >= 3 && str_contains($q, mb_strtolower($game->name))) {
                    $ids[] = $game->id;
                }
            }
        }

        return array_values(array_unique(array_slice($ids, 0, 3)));
    }

    /**
     * ШІ обирає з кандидатів до 6 і пояснює кожного одним реченням.
     *
     * @param  list<array{0: TeammateProfile, 1: array<string, mixed>}>  $scored
     * @param  array<int, string>  $names
     * @return array{0: list<int>, 1: array<int, string>}
     */
    private function pick(string $query, array $scored, array $names): array
    {
        $lines = [];
        foreach ($scored as $i => [$profile, $match]) {
            $lines[] = $i.': '.implode('; ', array_filter([
                'ігри: '.implode(', ', array_filter(array_map(fn (int $id) => $names[$id] ?? null, $profile->games ?? []))),
                $profile->times ? 'час: '.implode(', ', array_map(fn (string $t) => TeammateProfile::TIMES[$t] ?? $t, $profile->times)) : null,
                $profile->skill ? 'рівень: '.(TeammateProfile::SKILLS[$profile->skill] ?? $profile->skill) : null,
                $profile->platform ? 'платформа: '.(PartyPost::PLATFORMS[$profile->platform] ?? $profile->platform) : null,
                $profile->mic ? 'з мікрофоном' : null,
                $profile->isLooking() ? 'шукає зараз' : null,
                $profile->note ? 'про себе: «'.Str::limit($profile->note, 120).'»' : null,
                'сумісність '.$match['score'].'%',
            ]));
        }
        try {
            $raw = $this->ai->complete(
                'Ти підбираєш тиммейтів у соцмережі GameCon. З переліку кандидатів (номер: анкета) обери до 6, хто найкраще підходить під запит, від найкращого. '
                .'Поверни лише JSON {"picks": [{"id": номер, "why": "одне коротке речення українською, чому підходить"}]}. Не вигадуй фактів поза анкетою.',
                [['role' => 'user', 'content' => "Запит: {$query}\n\nКандидати:\n".implode("\n", $lines)]],
                700,
                [],
                'teammates',
            );
        } catch (AiException) {
            return [array_keys($scored), []];
        }
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        $order = [];
        $why = [];
        foreach ((array) ($json['picks'] ?? []) as $item) {
            $id = is_array($item) && is_numeric($item['id'] ?? null) ? (int) $item['id'] : null;
            if ($id !== null && isset($scored[$id]) && ! in_array($id, $order, true)) {
                $order[] = $id;
                $why[$id] = Str::limit(trim((string) ($item['why'] ?? '')), 200);
            }
        }

        return [$order !== [] ? $order : array_keys($scored), $why];
    }

    /** @throws AiException */
    private function limit(User $user): void
    {
        $key = 'ai-teammates:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            throw new AiException('Забагато запитів підбору. Спробуйте за '.ceil(RateLimiter::availableIn($key) / 60).' хв.');
        }
        RateLimiter::hit($key, 3600);
    }
}

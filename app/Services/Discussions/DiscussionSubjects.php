<?php

namespace App\Services\Discussions;

use App\Models\Article;
use App\Models\Clan;
use App\Models\Community;
use App\Models\Discussion;
use App\Models\Family;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\Track;
use App\Support\Modules\ModuleManager;
use Illuminate\Database\Eloquent\Model;

/**
 * Предмети обговорень: що можна обговорювати, в якому розділі (модулі) і як показати картку предмета.
 * Розділ вимкнено людині чи режимом — тем про нього немає (ні в списку, ні в пошуку, ні створити).
 */
class DiscussionSubjects
{
    /** @var array<string, array{model: class-string<Model>, module: string, label: string}> */
    public const TYPES = [
        'movie' => ['model' => Movie::class, 'module' => 'cinema', 'label' => 'Кіно'],
        'game' => ['model' => Game::class, 'module' => 'games', 'label' => 'Гра'],
        'server' => ['model' => GtaServer::class, 'module' => 'servers', 'label' => 'Сервер'],
        'family' => ['model' => Family::class, 'module' => 'families', 'label' => 'Сім’я'],
        'clan' => ['model' => Clan::class, 'module' => 'clans', 'label' => 'Клан'],
        'community' => ['model' => Community::class, 'module' => 'communities', 'label' => 'Спільнота'],
        'article' => ['model' => Article::class, 'module' => 'articles', 'label' => 'Стаття'],
        'track' => ['model' => Track::class, 'module' => 'music', 'label' => 'Трек'],
    ];

    /** Категорія загального розділу → модуль, без якого її немає (null — є завжди). */
    public const CATEGORY_MODULES = [
        'general' => null, 'cinema' => 'cinema', 'series' => 'cinema', 'anime' => 'cinema',
        'games' => 'games', 'music' => 'music', 'tech' => null,
    ];

    public function __construct(private readonly ModuleManager $modules) {}

    public function allowed(string $type): bool
    {
        return isset(self::TYPES[$type]) && $this->modules->enabled(self::TYPES[$type]['module']);
    }

    /** @return array<string, string> категорії, доступні глядачу */
    public function categories(): array
    {
        return array_filter(Discussion::CATEGORIES, fn (string $label, string $key) => self::CATEGORY_MODULES[$key] === null || $this->modules->enabled(self::CATEGORY_MODULES[$key]), ARRAY_FILTER_USE_BOTH);
    }

    /** Предмет за типом та id — лише опублікований/видимий; інакше null. */
    public function find(string $type, int $id): ?Model
    {
        if (! $this->allowed($type)) {
            return null;
        }
        /** @var class-string<Model> $class */
        $class = self::TYPES[$type]['model'];
        $subject = $class::query()->find($id);
        if ($subject === null) {
            return null;
        }
        $published = match (true) {
            $subject instanceof Movie, $subject instanceof Game, $subject instanceof Article => (bool) $subject->is_published,
            $subject instanceof Family => $subject->isVerified(),
            $subject instanceof GtaServer => $subject->status === GtaServer::STATUS_PUBLISHED,
            default => true,
        };

        return $published ? $subject : null;
    }

    /** Категорія загального розділу для теми про предмет (кіно → серіали/аніме за типом). */
    public function categoryFor(string $type, Model $subject): string
    {
        return match ($type) {
            'movie' => $subject instanceof Movie ? match ($subject->type) {
                'anime' => 'anime', 'serial', 'cartoon', 'documentary' => 'series', default => 'cinema',
            } : 'cinema',
            'game', 'server', 'clan' => 'games',
            default => 'general',
        };
    }

    /**
     * Картка предмета для списку тем і шапки теми.
     *
     * @return array{type: string, id: int, label: string, title: string, href: string, cover: string|null, subtitle: string|null}
     */
    public function card(string $type, Model $subject): array
    {
        $subtitle = match (true) {
            $subject instanceof Movie => trim(implode(' · ', array_filter([Movie::TYPES[$subject->type] ?? null, $subject->year ? (string) $subject->year : null]))),
            $subject instanceof Game => $subject->released?->format('Y'),
            $subject instanceof GtaServer => $subject->players_online !== null ? $subject->players_online.' онлайн' : null,
            $subject instanceof Family, $subject instanceof Clan, $subject instanceof Community => $subject->members_count.' учасників',
            $subject instanceof Track => $subject->album,
            default => null,
        };
        [$title, $href, $cover] = match (true) {
            $subject instanceof Movie => [$subject->title, '/cinema/'.$subject->slug, $subject->poster_url],
            $subject instanceof Game => [$subject->name, '/games/'.$subject->slug, $subject->cover],
            $subject instanceof GtaServer => [$subject->name, '/servers/'.$subject->slug, $subject->icon],
            $subject instanceof Family => [$subject->name, '/families/'.$subject->slug, $subject->logo_url],
            $subject instanceof Clan => [$subject->display_name, '/clans/'.$subject->slug, $subject->logo_url],
            $subject instanceof Community => [$subject->name, '/c/'.$subject->slug, $subject->avatar_url],
            $subject instanceof Article => [$subject->title, '/articles/'.$subject->slug, null],
            $subject instanceof Track => [$subject->artist.' — '.$subject->title, '/music/search?q='.rawurlencode($subject->title), $subject->cover_url],
            default => ['', '/', null],
        };

        return ['type' => $type, 'id' => (int) $subject->getKey(), 'label' => self::TYPES[$type]['label'], 'title' => (string) $title, 'href' => $href, 'cover' => $cover, 'subtitle' => $subtitle ?: null];
    }

    /**
     * Пошук для вставки картки в тему: за назвою в межах типу (лише опубліковане й доступне).
     *
     * @return list<array<string, mixed>>
     */
    public function search(string $type, string $q): array
    {
        if (! $this->allowed($type) || mb_strlen(trim($q)) < 2) {
            return [];
        }
        $like = '%'.trim($q).'%';
        $query = match ($type) {
            'movie' => Movie::query()->where('is_published', true)->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('title_original', 'like', $like)),
            'game' => Game::query()->where('is_published', true)->where('name', 'like', $like),
            'server' => GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)->where('name', 'like', $like),
            'family' => Family::query()->where('status', Family::STATUS_VERIFIED)->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('tag', 'like', $like)),
            'clan' => Clan::query()->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('tag', 'like', $like)),
            'community' => Community::query()->where('name', 'like', $like),
            'article' => Article::query()->where('is_published', true)->where('title', 'like', $like),
            'track' => Track::query()->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('artist', 'like', $like)),
            default => null,
        };
        if ($query === null) {
            return [];
        }

        return array_values($query->limit(8)->get()->map(fn (Model $m) => $this->card($type, $m))->all());
    }

    /**
     * Перевірені вбудовані картки з запиту: лише існуючі й доступні, не більше 6.
     *
     * @param  array<int, mixed>  $embeds
     * @return list<array{type: string, id: int}>
     */
    public function cleanEmbeds(array $embeds): array
    {
        $out = [];
        foreach (array_slice($embeds, 0, 6) as $e) {
            if (is_array($e) && is_string($e['type'] ?? null) && is_numeric($e['id'] ?? null) && $this->find($e['type'], (int) $e['id']) !== null) {
                $out[] = ['type' => $e['type'], 'id' => (int) $e['id']];
            }
        }

        return $out;
    }

    /**
     * Картки для показу (зниклі чи недоступні глядачу — пропускаються).
     *
     * @param  array<int, mixed>|null  $embeds
     * @return list<array<string, mixed>>
     */
    public function embedCards(?array $embeds): array
    {
        $out = [];
        foreach ($embeds ?? [] as $e) {
            if (! is_array($e) || ! is_string($e['type'] ?? null)) {
                continue;
            }
            $subject = $this->find($e['type'], (int) ($e['id'] ?? 0));
            if ($subject !== null) {
                $out[] = $this->card($e['type'], $subject);
            }
        }

        return $out;
    }
}

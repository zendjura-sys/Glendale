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
     * @return array{type: string, id: int, label: string, title: string, href: string, cover: string|null}
     */
    public function card(string $type, Model $subject): array
    {
        [$title, $href, $cover] = match (true) {
            $subject instanceof Movie => [$subject->title, '/cinema/'.$subject->slug, $subject->poster_url],
            $subject instanceof Game => [$subject->name, '/games/'.$subject->slug, $subject->cover],
            $subject instanceof GtaServer => [$subject->name, '/servers/'.$subject->slug, $subject->icon],
            $subject instanceof Family => [$subject->name, '/families/'.$subject->slug, $subject->logo_url],
            $subject instanceof Clan => [$subject->display_name, '/clans/'.$subject->slug, $subject->logo_url],
            $subject instanceof Community => [$subject->name, '/c/'.$subject->slug, $subject->avatar_url],
            $subject instanceof Article => [$subject->title, '/articles/'.$subject->slug, null],
            default => ['', '/', null],
        };

        return ['type' => $type, 'id' => (int) $subject->getKey(), 'label' => self::TYPES[$type]['label'], 'title' => (string) $title, 'href' => $href, 'cover' => $cover];
    }
}

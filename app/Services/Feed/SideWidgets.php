<?php

namespace App\Services\Feed;

use App\Models\GameGiveaway;
use App\Models\LiveShow;
use App\Models\User;
use App\Services\Cinema\AiPicks;
use App\Services\Games\Giveaways;
use App\Services\Music\MusicCatalog;
use App\Services\Shows\LiveShows;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Cache;

/**
 * Віджети ПК і планшета біля стрічки: музика (продовжити / нове), «Що подивитися» (ШІ),
 * роздачі ігор і GameCast в ефірі. Кожен — лише якщо його розділ увімкнено.
 */
class SideWidgets
{
    /**
     * @return array<string, mixed>
     */
    public function for(User $user): array
    {
        $modules = app(ModuleManager::class);
        $plugins = app(Plugins::class);

        return [
            'music' => $modules->enabled('music') ? $this->music($user) : null,
            'cinema' => $modules->enabled('cinema') ? app(AiPicks::class)->for($user) : null,
            'giveaways' => $modules->enabled('games') ? Cache::remember('widgets:giveaways', 600, fn () => app(Giveaways::class)->active(3)
                ->map(fn (GameGiveaway $g) => $g->toCard())->values()->all()) : null,
            'gamecast' => $plugins->on('live_shows') ? $this->gamecast() : null,
        ];
    }

    /**
     * @return array{mode: string, tracks: list<array<string, mixed>>}
     */
    private function music(User $user): array
    {
        $catalog = app(MusicCatalog::class);
        $recent = $catalog->recentlyPlayed($user, 4);
        if ($recent !== []) {
            return ['mode' => 'recent', 'tracks' => $recent];
        }

        return ['mode' => 'new', 'tracks' => array_slice($catalog->newest($user)['latest_songs'] ?? [], 0, 4)];
    }

    /**
     * @return array{live: int, listeners: int, shows: list<array<string, mixed>>}
     */
    private function gamecast(): array
    {
        $shows = app(LiveShows::class);

        return [
            ...$shows->pulse(),
            'shows' => Cache::remember('widgets:gamecast', 30, fn () => LiveShow::query()->where('status', LiveShow::LIVE)
                ->latest('id')->limit(3)->get()->map(fn (LiveShow $s) => $shows->card($s))->values()->all()),
        ];
    }
}

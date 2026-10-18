<?php

namespace App\Services;

use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\ServerEvent;

/**
 * Картка гри, сервера або події всередині поста.
 */
class PostCards
{
    /**
     * @return array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}|null
     */
    public function resolve(string $kind, int $id): ?array
    {
        return match ($kind) {
            'movie' => ($movie = Movie::query()->published()->find($id)) ? [
                'kind' => 'movie',
                'id' => $movie->id,
                'title' => $movie->title,
                'hint' => 'Кіно',
                'href' => '/cinema/'.$movie->slug,
                'image' => $movie->poster,
            ] : null,
            'game' => ($game = Game::query()->published()->find($id)) ? [
                'kind' => 'game',
                'id' => $game->id,
                'title' => $game->name,
                'hint' => 'Гра',
                'href' => '/games/'.$game->slug,
                'image' => $game->cover,
            ] : null,
            'server' => ($server = GtaServer::query()->published()->find($id)) ? [
                'kind' => 'server',
                'id' => $server->id,
                'title' => $server->name,
                'hint' => 'Сервер',
                'href' => '/servers/'.$server->slug,
                'image' => $server->icon,
            ] : null,
            'game_event' => ($event = GameEvent::query()->find($id)) ? [
                'kind' => 'game_event',
                'id' => $event->id,
                'title' => $event->title,
                'hint' => 'Подія',
                'href' => $event->url ?: '/events',
                'image' => $event->image,
            ] : null,
            'server_event' => ($event = ServerEvent::query()->with('server')->find($id)) ? [
                'kind' => 'server_event',
                'id' => $event->id,
                'title' => $event->title,
                'hint' => 'Подія',
                'href' => $event->server ? '/servers/'.$event->server->slug : ($event->url ?: '/events'),
                'image' => null,
            ] : null,
            default => null,
        };
    }

    /**
     * @return list<array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}>
     */
    public function search(string $q): array
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
        $hits = [];

        Game::query()->published()->where('name', 'like', $like)->orderByDesc('popularity')->limit(4)->get()
            ->each(function (Game $game) use (&$hits) {
                $card = $this->resolve('game', $game->id);
                if ($card) {
                    $hits[] = $card;
                }
            });
        GtaServer::query()->published()->where('name', 'like', $like)->limit(4)->get()
            ->each(function (GtaServer $server) use (&$hits) {
                $card = $this->resolve('server', $server->id);
                if ($card) {
                    $hits[] = $card;
                }
            });
        GameEvent::query()->where('title', 'like', $like)->where('starts_at', '>=', now()->subDay())->limit(3)->get()
            ->each(function (GameEvent $event) use (&$hits) {
                $card = $this->resolve('game_event', $event->id);
                if ($card) {
                    $hits[] = $card;
                }
            });
        ServerEvent::query()->where('title', 'like', $like)->where('starts_at', '>=', now()->subDay())->limit(3)->get()
            ->each(function (ServerEvent $event) use (&$hits) {
                $card = $this->resolve('server_event', $event->id);
                if ($card) {
                    $hits[] = $card;
                }
            });

        return $hits;
    }

    /**
     * @return list<array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}>
     */
    public function chatSearch(string $q): array
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
        $hits = [];
        $groups = [
            'game' => Game::query()->published()->where('name', 'like', $like)->orderByDesc('popularity')->limit(4)->get(),
            'movie' => Movie::query()->published()->where('title', 'like', $like)->limit(4)->get(),
            'server' => GtaServer::query()->published()->where('name', 'like', $like)->limit(4)->get(),
        ];
        foreach ($groups as $kind => $models) {
            foreach ($models as $model) {
                $card = $this->resolve($kind, $model->id);
                if ($card) {
                    $hits[] = $card;
                }
            }
        }

        return $hits;
    }
}

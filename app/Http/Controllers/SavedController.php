<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\Post;
use App\Models\Save;
use App\Services\PostPresenter;
use App\Services\SavedItems;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SavedController extends Controller
{
    public function __construct(
        private readonly SavedItems $saved,
        private readonly PostPresenter $presenter,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $rows = $this->saved->for($user);
        $posts = Post::query()->whereIn('id', $rows->where('kind', Save::POST)->pluck('subject_id'))->get()->keyBy('id');
        $cards = $this->presenter->many($posts, $user);
        $byPost = collect($cards)->keyBy('id');
        $movies = Movie::query()->whereIn('id', $rows->where('kind', Save::MOVIE)->pluck('subject_id'))->get()->keyBy('id');
        $games = Game::query()->whereIn('id', $rows->where('kind', Save::GAME)->pluck('subject_id'))->get()->keyBy('id');
        $servers = GtaServer::query()->whereIn('id', $rows->where('kind', Save::SERVER)->pluck('subject_id'))->get()->keyBy('id');

        $items = [];
        foreach ($rows as $row) {
            $item = match ($row->kind) {
                Save::POST => isset($byPost[$row->subject_id]) ? ['kind' => 'post', 'post' => $byPost[$row->subject_id]] : null,
                Save::MOVIE => isset($movies[$row->subject_id]) ? [
                    'kind' => 'movie',
                    'title' => $movies[$row->subject_id]->title,
                    'hint' => 'Кіно',
                    'href' => '/cinema/'.$movies[$row->subject_id]->slug,
                    'image' => $movies[$row->subject_id]->poster,
                ] : null,
                Save::GAME => isset($games[$row->subject_id]) ? [
                    'kind' => 'game',
                    'title' => $games[$row->subject_id]->name,
                    'hint' => 'Гра',
                    'href' => '/games/'.$games[$row->subject_id]->slug,
                    'image' => $games[$row->subject_id]->cover,
                ] : null,
                Save::SERVER => isset($servers[$row->subject_id]) ? [
                    'kind' => 'server',
                    'title' => $servers[$row->subject_id]->name,
                    'hint' => 'Сервер',
                    'href' => '/servers/'.$servers[$row->subject_id]->slug,
                    'image' => $servers[$row->subject_id]->icon,
                ] : null,
                default => null,
            };
            if ($item !== null) {
                $items[] = $item;
            }
        }

        return Inertia::render('saved/index', ['items' => $items]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(Save::KINDS)],
            'id' => ['required', 'integer', 'min:1'],
        ]);

        return response()->json([
            'saved' => $this->saved->toggle($request->user(), $data['kind'], (int) $data['id']),
        ]);
    }
}

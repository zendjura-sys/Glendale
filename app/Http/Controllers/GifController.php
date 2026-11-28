<?php

namespace App\Http\Controllers;

use App\Services\Media\GifSearch;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Пошук GIF для записів і чатів. */
class GifController extends Controller
{
    public function index(Request $request, GifSearch $gifs): JsonResponse
    {
        app(Plugins::class)->ensure('gif_search');
        $data = $request->validate(['q' => ['nullable', 'string', 'max:50']]);

        return response()->json(['configured' => $gifs->configured(), 'gifs' => $gifs->search($data['q'] ?? null)]);
    }
}

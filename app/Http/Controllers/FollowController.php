<?php

namespace App\Http\Controllers;

use App\Models\Follow;
use App\Services\FollowAlerts;
use App\Services\PostCards;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FollowController extends Controller
{
    public function cards(Request $request, PostCards $cards): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        return response()->json(['cards' => mb_strlen($q) < 2 ? [] : $cards->search($q)]);
    }

    public function toggle(Request $request, FollowAlerts $follows): JsonResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(Follow::KINDS)],
            'id' => ['required', 'integer', 'min:1'],
        ]);

        return response()->json([
            'following' => $follows->toggle($request->user(), $data['kind'], (int) $data['id']),
        ]);
    }
}

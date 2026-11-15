<?php

namespace App\Http\Controllers;

use App\Services\Ai\AiException;
use App\Services\Ai\DailyBrief;
use App\Services\Ai\SiteAssistant;
use App\Services\Ai\TeammateFinder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** ШІ-зведення дня («Сьогодні»), помічник по сайту й підбір тиммейтів словами. */
class AiToolsController extends Controller
{
    public function today(Request $request, DailyBrief $brief): Response|JsonResponse
    {
        $data = $brief->for($request->user(), $request->boolean('refresh'));

        return $request->wantsJson() ? response()->json($data) : Inertia::render('today', $data);
    }

    public function assistant(Request $request, SiteAssistant $assistant): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'min:2', 'max:500'],
            'history' => ['nullable', 'array', 'max:12'],
            'history.*.role' => ['required', 'in:user,assistant'],
            'history.*.content' => ['required', 'string', 'max:2000'],
        ]);
        try {
            return response()->json($assistant->answer($request->user(), $data['question'], array_values($data['history'] ?? [])));
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function teammates(Request $request, TeammateFinder $finder): JsonResponse
    {
        $data = $request->validate(['query' => ['required', 'string', 'min:3', 'max:400']]);
        try {
            return response()->json($finder->find($request->user(), $data['query']));
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Services\Growth\FriendImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Імпорт друзів зі Steam (№279): хто з друзів Steam уже на GameCon — і заявки одним натиском. */
class FriendImportController extends Controller
{
    public function __construct(private readonly FriendImport $import) {}

    public function steam(Request $request): JsonResponse
    {
        return response()->json($this->import->steam($request->user()));
    }

    public function add(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:200'], 'ids.*' => ['integer']]);
        $sent = $this->import->addAll($request->user(), array_values(array_map('intval', $data['ids'])));

        return response()->json(['sent' => $sent] + $this->import->steam($request->user()));
    }
}

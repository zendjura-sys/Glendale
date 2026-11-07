<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Thanks;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ThanksController extends Controller
{
    public function store(Request $request, Thanks $thanks): JsonResponse
    {
        app(Plugins::class)->ensure('thanks');
        $data = $request->validate([
            'kind' => ['required', Rule::in(Thanks::KINDS)],
            'id' => ['required', 'integer', 'min:1'],
        ]);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return response()->json($thanks->toggle($user, $data['kind'], (int) $data['id']));
    }
}

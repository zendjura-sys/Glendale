<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ParentalControl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Батьківський контроль (№227): запрошення, згода, правила, розірвання. */
class ParentalController extends Controller
{
    public function __construct(private readonly ParentalControl $parental) {}

    public function edit(Request $request): Response|JsonResponse
    {
        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json($this->parental->state($request->user()));
        }

        return Inertia::render('settings/parental', $this->parental->state($request->user()));
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->parental->state($request->user()));
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate(['username' => ['required', 'string', 'max:40']]);
        $teen = User::query()->where('username', ltrim(trim($data['username']), '@'))->first()
            ?? throw ValidationException::withMessages(['username' => 'Людину з таким ніком не знайдено.']);
        $this->parental->invite($request->user(), $teen);

        return response()->json($this->parental->state($request->user()));
    }

    public function accept(Request $request, int $link): JsonResponse
    {
        $this->parental->accept($request->user(), $link);

        return response()->json($this->parental->state($request->user()));
    }

    public function update(Request $request, int $link): JsonResponse
    {
        $data = $request->validate([
            'night_from' => ['nullable', 'date_format:H:i', 'required_with:night_to'],
            'night_to' => ['nullable', 'date_format:H:i', 'required_with:night_from'],
            'friends_of_friends' => ['sometimes', 'boolean'],
        ]);
        $this->parental->update($request->user(), $link, $data);

        return response()->json($this->parental->state($request->user()));
    }

    public function destroy(Request $request, int $link): JsonResponse
    {
        $this->parental->remove($request->user(), $link);

        return response()->json($this->parental->state($request->user()));
    }
}

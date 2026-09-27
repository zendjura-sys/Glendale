<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['user' => Presenter::me($user), 'counters' => Social::counters($user->id)]);
    }

    /** Перемикач «Моя родина»: у якій родині відкривати інструменти. */
    public function activeFamily(Request $request): JsonResponse
    {
        $id = (int) $request->input('familyId');
        if (! \App\Families\FamilyContext::choose($request->user(), $id)) {
            \App\Social\Social::fail(403, 'Ви не учасник цієї родини.');
        }

        return response()->json(['user' => \App\Social\Presenter::me($request->user()->fresh())]);
    }

    public function counters(Request $request): JsonResponse
    {
        return response()->json(Social::counters($request->user()->id));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'firstName' => ['sometimes', 'string', 'max:50'],
            'lastName' => ['sometimes', 'nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'nullable', 'string', 'max:140'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'city' => ['sometimes', 'nullable', 'string', 'max:80'],
            'birthday' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'before:today'],
        ]);
        $user = $request->user();

        if (array_key_exists('firstName', $data)) {
            if (trim($data['firstName']) === '') {
                Social::fail(400, "Ім'я не може бути порожнім");
            }
            $user->first_name = trim($data['firstName']);
        }
        if (array_key_exists('lastName', $data)) {
            $user->last_name = trim((string) $data['lastName']);
        }
        foreach (['status', 'bio', 'city'] as $field) {
            if (array_key_exists($field, $data)) {
                $user->{$field} = trim((string) $data[$field]);
            }
        }
        if (array_key_exists('birthday', $data)) {
            $user->birth_date = $data['birthday'] ?: null;
        }
        $user->save();

        return response()->json(Presenter::me($user->fresh()));
    }

    public function password(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current' => ['required', 'string'],
            'next' => ['required', 'string', Password::defaults()],
        ]);
        $user = $request->user();
        if (! Hash::check($data['current'], $user->password)) {
            Social::fail(400, 'Неправильний поточний пароль');
        }

        $user->password = $data['next'];
        $user->save();
        // Як і в Glendale: вийти з усіх інших пристроїв, поточний лишається.
        $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();

        return response()->json(['ok' => true]);
    }

    public function avatar(Request $request): JsonResponse
    {
        $request->validate(['image' => ['required', ...Social::IMAGE_RULES]]);
        $user = $request->user();
        $path = Social::storeImage($request->file('image'), 'avatars');

        $user->avatar_path = $path;
        // Фото профілю знову проходить модерацію для публічної галереї
        // головної сторінки — так само, як при заміні з профілю сайту.
        $user->avatar_approved = false;
        $user->save();
        DB::table('social_photos')->insert(['user_id' => $user->id, 'path' => $path, 'album' => 'profile', 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(Presenter::me($user->fresh()));
    }

    public function cover(Request $request): JsonResponse
    {
        $request->validate(['image' => ['required', ...Social::IMAGE_RULES]]);
        $user = $request->user();
        $user->cover_path = Social::storeImage($request->file('image'), 'covers');
        $user->save();

        return response()->json(Presenter::me($user->fresh()));
    }
}

<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\Profile\Affiliations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Порядок значків біля ніка: які сім'я, клан чи гільдія показуються першими (і на телефоні — без «+N»). */
class BadgeOrderController extends Controller
{
    public function show(Request $request, Affiliations $affiliations): JsonResponse
    {
        return response()->json(['groups' => $affiliations->groupsOf($request->user())]);
    }

    public function update(Request $request, Affiliations $affiliations): JsonResponse
    {
        $data = $request->validate([
            'order' => ['present', 'array', 'max:30'],
            'order.*' => ['string', 'distinct', 'max:40', 'regex:/^(family|playing|clan:\d+)$/'],
        ]);
        $user = $request->user();
        $user->forceFill(['preferences' => [...($user->preferences ?? []), 'badge_order' => array_values($data['order'])]])->save();
        $affiliations->forget();

        return response()->json(['ok' => true, 'groups' => $affiliations->groupsOf($user), 'message' => 'Порядок значків збережено.']);
    }
}

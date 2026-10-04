<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\I18n\ContentTranslator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** «Перекласти» під записом, коментарем чи повідомленням. */
class TranslateController extends Controller
{
    public function __invoke(Request $request, ContentTranslator $translator): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(ContentTranslator::TYPES)],
            'id' => ['required', 'integer', 'min:1'],
        ]);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $result = $translator->translate((string) $data['type'], (int) $data['id'], $user, app()->getLocale());

        return response()->json(['translation' => $result['text'], 'source' => $result['source'], 'same' => $result['same']]);
    }
}

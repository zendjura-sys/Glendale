<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Spellcheck\Spellchecker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Перевірка орфографії текстів адміністрації й модераторів: причини блокувань, відповіді
 * на апеляції, оголошення. Поле на сторінці надсилає текст із затримкою після набору.
 */
class SpellcheckController extends Controller
{
    public function __construct(private readonly Spellchecker $spellchecker) {}

    public function check(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isStaff(), 403);
        $data = $request->validate([
            'text' => ['present', 'nullable', 'string', 'max:'.Spellchecker::MAX_LENGTH],
            'lang' => ['nullable', 'string', 'in:uk,en'],
        ]);
        $text = (string) ($data['text'] ?? '');
        $result = trim($text) === ''
            ? ['issues' => [], 'engine' => 'hunspell', 'available' => $this->spellchecker->available()]
            : $this->spellchecker->check($text, $data['lang'] ?? null);

        return response()->json([...$result, 'can_add' => $request->user()->isAdmin()]);
    }

    /** «Додати до словника» — лише адміністратор; пишемо в журнал. */
    public function addWord(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);
        $data = $request->validate(['word' => ['required', 'string', 'max:60', 'regex:/^[\p{L}\p{N}\'’ʼ\-]+$/u']], ['word.regex' => 'Слово — літери, цифри, апостроф і дефіс.']);
        $this->spellchecker->addWord(trim((string) $data['word']));
        Log::info('admin: spellcheck word added', ['word' => $data['word'], 'by' => $request->user()->id]);

        return response()->json(['ok' => true]);
    }
}

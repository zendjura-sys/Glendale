<?php

namespace App\Http\Controllers;

use App\Models\Feedback;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/** Кнопка «Відгук адмінам»: ідея, помилка чи думка про сайт. */
class FeedbackController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(Feedback::KINDS))],
            'body' => ['required', 'string', 'min:5', 'max:3000'],
            'url' => ['nullable', 'string', 'max:255'],
        ]);
        $url = isset($data['url']) && str_starts_with((string) $data['url'], '/') ? Str::limit((string) $data['url'], 250, '') : null;
        Feedback::query()->create([
            'user_id' => $request->user()->id,
            'kind' => $data['kind'],
            'body' => trim($data['body']),
            'url' => $url,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Дякуємо! Відгук отримали адміністратори.']);

        return back();
    }
}

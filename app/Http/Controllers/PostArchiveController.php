<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\Feed\PostArchive;
use App\Services\PostPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Архів записів: свій запис можна сховати зі стіни й стрічки, не видаляючи, і повернути будь-коли.
 * Автоархів сам ховає старі записи (за налаштуванням автора); закріплені не чіпає.
 */
class PostArchiveController extends Controller
{
    public function __construct(
        private readonly PostPresenter $presenter,
        private readonly PostArchive $archive,
    ) {}

    public function index(Request $request): Response|JsonResponse
    {
        $user = $request->user();
        $posts = Post::query()->where('author_id', $user->id)->whereNotNull('archived_at')
            ->latest('archived_at')->limit(100)->get();
        $data = [
            'posts' => $this->presenter->many($posts, $user),
            'total' => Post::query()->where('author_id', $user->id)->whereNotNull('archived_at')->count(),
            'auto' => $this->archive->autoDays($user),
            'options' => PostArchive::OPTIONS,
        ];

        return $request->wantsJson() ? response()->json($data) : Inertia::render('posts/archive', $data);
    }

    /** В архів / повернути з архіву. */
    public function toggle(Request $request, Post $post): RedirectResponse|JsonResponse
    {
        $user = $request->user();
        abort_unless($post->author_id === $user->id && ! $post->as_community && ! $post->is_draft, 403);
        $archived = $post->archived_at === null;
        $post->forceFill(['archived_at' => $archived ? now() : null, 'is_pinned' => $archived ? false : $post->is_pinned])->save();
        $message = $archived ? 'Запис перенесено в архів — його бачите лише ви.' : 'Запис повернуто на стіну.';

        if ($request->wantsJson()) {
            return response()->json(['archived' => $archived, 'message' => $message]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    /** Автоархів: 0 — вимкнено, інакше скільки днів запис лишається на стіні. */
    public function settings(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate(['auto' => ['required', 'integer', Rule::in(PostArchive::OPTIONS)]]);
        $user = $request->user();
        $user->forceFill(['preferences' => [...($user->preferences ?? []), 'auto_archive' => (int) $data['auto']]])->save();
        $message = (int) $data['auto'] === 0 ? 'Автоархів вимкнено.' : 'Автоархів увімкнено.';

        if ($request->wantsJson()) {
            return response()->json(['auto' => (int) $data['auto'], 'message' => $message]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}

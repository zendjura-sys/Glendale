<?php

namespace App\Http\Controllers;

use App\Models\Story;
use App\Models\User;
use App\Services\Stories;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Історії (JSON для сайту й застосунку): стрічка, публікація, перегляди, реакції, відповіді.
 */
class StoryController extends Controller
{
    /** Відео історії — до 50 МБ. */
    private const MAX_VIDEO_KB = 51200;

    public function __construct(private readonly Stories $stories) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['groups' => $this->stories->feed($this->user($request)), 'reactions' => Story::REACTIONS]);
    }

    public function ofUser(Request $request, User $user): JsonResponse
    {
        return response()->json(['group' => $this->stories->ofUser($user, $this->user($request))]);
    }

    public function store(Request $request, SiteSettings $settings): JsonResponse
    {
        $user = $this->user($request);
        $maxImageKb = (int) $settings->get('max_upload_mb') * 1024;
        $data = $request->validate([
            'media' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime', 'max:'.max($maxImageKb, self::MAX_VIDEO_KB)],
            'caption' => ['nullable', 'string', 'max:200'],
            'privacy' => ['nullable', Rule::in(Story::PRIVACIES)],
            'duration' => ['nullable', 'integer', 'min:1', 'max:'.Story::MAX_VIDEO_SECONDS],
        ], ['media.mimetypes' => 'Додайте фото (JPG, PNG, WebP, GIF) або відео (MP4, WebM, MOV).']);

        $file = $request->file('media');
        abort_unless($file !== null, 422);
        if (! str_starts_with((string) $file->getMimeType(), 'video/') && $file->getSize() > $maxImageKb * 1024) {
            return response()->json(['message' => 'Фото завелике.', 'errors' => ['media' => ['Фото завелике.']]], 422);
        }

        $story = $this->stories->create($user, $file, $data['caption'] ?? null, $data['privacy'] ?? Story::PRIVACY_FRIENDS, isset($data['duration']) ? (int) $data['duration'] : null);

        return response()->json(['story' => $this->stories->present($story, $user, true)], 201);
    }

    public function view(Request $request, Story $story): JsonResponse
    {
        $user = $this->visible($request, $story);
        $this->stories->view($story, $user);

        return response()->json(['ok' => true]);
    }

    public function react(Request $request, Story $story): JsonResponse
    {
        $user = $this->visible($request, $story);
        $data = $request->validate(['reaction' => ['required', Rule::in(Story::REACTIONS)]]);
        $this->stories->react($story, $user, $data['reaction']);

        return response()->json(['ok' => true]);
    }

    public function reply(Request $request, Story $story): JsonResponse
    {
        $user = $this->visible($request, $story);
        $data = $request->validate(['body' => ['required', 'string', 'max:1000']]);
        $this->stories->reply($story, $user, trim($data['body']));

        return response()->json(['ok' => true]);
    }

    public function viewers(Request $request, Story $story): JsonResponse
    {
        abort_unless($story->user_id === $this->user($request)->id, 403);

        return response()->json(['viewers' => $this->stories->viewers($story), 'views_count' => $story->views_count]);
    }

    public function destroy(Request $request, Story $story): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($story->user_id === $user->id || $user->isStaff(), 403);
        $this->stories->delete($story);

        return response()->json(['ok' => true]);
    }

    private function visible(Request $request, Story $story): User
    {
        $user = $this->user($request);
        abort_unless($this->stories->canView($story, $user), 404);

        return $user;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}

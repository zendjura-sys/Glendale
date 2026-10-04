<?php

namespace App\Services;

use App\Models\Story;
use App\Models\StoryView;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Історії на 24 години: стрічка друзів, публікація фото чи відео, перегляди, реакції й відповіді в особисті.
 */
class Stories
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly ImageStorage $images,
        private readonly Messenger $messenger,
    ) {}

    public function canView(Story $story, User $viewer): bool
    {
        if ($story->user_id === $viewer->id) {
            return true;
        }
        if ($story->expires_at->isPast() || $story->user?->isBanned()) {
            return false;
        }

        return $story->privacy === Story::PRIVACY_EVERYONE
            || in_array($story->user_id, $this->friendships->friendIds($viewer), true);
    }

    /**
     * Стрічка історій: спершу свої, потім непереглянуті, потім переглянуті — у кожній групі новіші вище.
     *
     * @return list<array<string, mixed>>
     */
    public function feed(User $viewer): array
    {
        $friendIds = $this->friendships->friendIds($viewer);
        $stories = Story::query()->active()
            ->with('user')
            ->whereHas('user', fn ($q) => $q->whereNull('banned_at'))
            ->where(fn ($q) => $q->where('user_id', $viewer->id)
                ->orWhere(fn ($q) => $q->whereIn('user_id', $friendIds ?: [0])))
            ->orderBy('created_at')
            ->get();

        return $this->group(array_values($stories->all()), $viewer);
    }

    /**
     * Історії однієї людини (з профілю).
     *
     * @return array<string, mixed>|null
     */
    public function ofUser(User $author, User $viewer): ?array
    {
        $stories = Story::query()->active()->with('user')->where('user_id', $author->id)->orderBy('created_at')->get()
            ->filter(fn (Story $s) => $this->canView($s, $viewer))
            ->values();

        return $this->group(array_values($stories->all()), $viewer)[0] ?? null;
    }

    public function create(User $user, UploadedFile $file, ?string $caption, string $privacy, ?int $duration): Story
    {
        $video = str_starts_with((string) $file->getMimeType(), 'video/');
        if ($video) {
            $extension = match ($file->getMimeType()) {
                'video/webm' => 'webm',
                'video/quicktime' => 'mov',
                default => 'mp4',
            };
            $path = $file->storeAs('stories/'.now()->format('Y/m'), Str::random(32).'.'.$extension, 'public');
            if ($path === false) {
                throw new RuntimeException('Не вдалося зберегти відео.');
            }
            $stored = ['path' => $path, 'width' => 0, 'height' => 0];
        } else {
            $stored = $this->images->store($file, 'stories', 1920);
        }

        return Story::query()->create([
            'user_id' => $user->id,
            'media_type' => $video ? Story::TYPE_VIDEO : Story::TYPE_IMAGE,
            'path' => $stored['path'],
            'width' => min(65535, $stored['width']),
            'height' => min(65535, $stored['height']),
            'duration' => $video ? max(1, min(Story::MAX_VIDEO_SECONDS, $duration ?? 15)) : Story::IMAGE_SECONDS,
            'caption' => $caption !== null && trim($caption) !== '' ? trim($caption) : null,
            'privacy' => $privacy,
            'expires_at' => now()->addHours(Story::LIFETIME_HOURS),
        ]);
    }

    public function view(Story $story, User $viewer): void
    {
        if ($story->user_id === $viewer->id) {
            return;
        }
        $view = StoryView::query()->firstOrCreate(
            ['story_id' => $story->id, 'user_id' => $viewer->id],
            ['viewed_at' => now()],
        );
        if ($view->wasRecentlyCreated) {
            $story->increment('views_count');
        }
    }

    /**
     * Реакція: лишається в переглядах і йде автору в особисті повідомлення.
     */
    public function react(Story $story, User $viewer, string $reaction): void
    {
        $this->view($story, $viewer);
        StoryView::query()->where('story_id', $story->id)->where('user_id', $viewer->id)->update(['reaction' => $reaction]);
        $this->send($story, $viewer, "{$reaction} на вашу історію");
    }

    public function reply(Story $story, User $viewer, string $body): void
    {
        $this->view($story, $viewer);
        $this->send($story, $viewer, "Відповідь на вашу історію: {$body}");
    }

    /**
     * Хто переглянув (лише автору).
     *
     * @return list<array<string, mixed>>
     */
    public function viewers(Story $story): array
    {
        return array_values($story->views()->with('user')->latest('viewed_at')->limit(200)->get()
            ->map(fn (StoryView $v) => $v->user ? [
                ...$v->user->toCard(),
                'reaction' => $v->reaction,
                'viewed_at' => $v->viewed_at->toIso8601String(),
            ] : null)
            ->filter()
            ->values()
            ->all());
    }

    public function delete(Story $story): void
    {
        Storage::disk('public')->delete($story->path);
        $story->delete();
    }

    /** Прибирає прострочені історії й файли (щогодини з планувальника). */
    public function prune(): int
    {
        $count = 0;
        Story::query()->where('expires_at', '<=', now())->orderBy('id')->chunkById(200, function ($stories) use (&$count) {
            foreach ($stories as $story) {
                $this->delete($story);
                $count++;
            }
        });

        return $count;
    }

    /**
     * @return array<string, mixed>
     */
    public function present(Story $story, User $viewer, bool $seen): array
    {
        $own = $story->user_id === $viewer->id;

        return [
            'id' => $story->id,
            'media_type' => $story->media_type,
            'url' => $story->url,
            'width' => $story->width,
            'height' => $story->height,
            'duration' => $story->duration,
            'caption' => $story->caption,
            'privacy' => $story->privacy,
            'created_at' => $story->created_at->toIso8601String(),
            'expires_at' => $story->expires_at->toIso8601String(),
            'seen' => $seen,
            'views_count' => $own ? $story->views_count : null,
        ];
    }

    /**
     * @param  list<Story>  $stories
     * @return list<array<string, mixed>>
     */
    private function group(array $stories, User $viewer): array
    {
        if ($stories === []) {
            return [];
        }
        $seen = StoryView::query()->where('user_id', $viewer->id)
            ->whereIn('story_id', array_map(fn (Story $s) => $s->id, $stories))
            ->pluck('story_id')->flip();

        $groups = [];
        foreach ($stories as $story) {
            if (! $story->user || ! $this->canView($story, $viewer)) {
                continue;
            }
            $id = $story->user_id;
            $groups[$id] ??= ['user' => $story->user->toCard(), 'own' => $id === $viewer->id, 'stories' => [], 'latest' => 0];
            $groups[$id]['stories'][] = $this->present($story, $viewer, $id === $viewer->id || $seen->has($story->id));
            $groups[$id]['latest'] = max($groups[$id]['latest'], $story->created_at->getTimestamp());
        }

        $list = array_map(function (array $g) {
            $g['all_seen'] = ! in_array(false, array_column($g['stories'], 'seen'), true);

            return $g;
        }, array_values($groups));
        usort($list, fn ($a, $b) => [$b['own'], ! $b['all_seen'], $b['latest']] <=> [$a['own'], ! $a['all_seen'], $a['latest']]);

        return array_map(function (array $g) {
            unset($g['latest']);

            return $g;
        }, $list);
    }

    private function send(Story $story, User $viewer, string $text): void
    {
        $author = $story->user;
        if (! $author || $author->is($viewer) || ! $this->messenger->canMessage($viewer, $author)) {
            throw ValidationException::withMessages(['body' => 'Ця людина не приймає повідомлення від вас.']);
        }
        $this->messenger->send($this->messenger->direct($viewer, $author), $viewer, $text);
    }
}

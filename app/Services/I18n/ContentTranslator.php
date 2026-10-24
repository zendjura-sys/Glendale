<?php

namespace App\Services\I18n;

use App\Models\Comment;
use App\Models\Message;
use App\Models\Photo;
use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\PhotoService;
use App\Support\I18n\Locales;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Кнопка «Перекласти» під записом, коментарем чи повідомленням: перекладач (DeepL, а коли його
 * місячний ліміт вичерпано — LibreTranslate, див. Translator) визначає мову тексту й перекладає
 * мовою інтерфейсу людини. Переклад зберігається — повторно перекладач не викликаємо.
 */
class ContentTranslator
{
    public const TYPES = ['post', 'comment', 'message', 'track'];

    public function __construct(
        private readonly Translator $translator,
        private readonly SiteSettings $settings,
        private readonly FriendshipService $friendships,
        private readonly PhotoService $photos,
    ) {}

    /** Кнопку показуємо, лише якщо працює DeepL або LibreTranslate і її не вимкнено в Адмінці → Мови. */
    public function enabled(): bool
    {
        return $this->settings->get('content_translation') !== false && $this->translator->available();
    }

    /**
     * @return array{text: string, source: string|null, same: bool}
     */
    public function translate(string $type, int $id, User $user, string $locale): array
    {
        abort_unless($this->enabled(), 404);
        $text = $this->textFor($type, $id, $user);
        abort_if($text === null || trim($text) === '', 404);
        if (! $this->translator->supports($locale)) {
            throw ValidationException::withMessages(['text' => 'Переклад цією мовою недоступний.']);
        }
        $hash = sha1($text);
        $cached = DB::table('content_translations')->where(['type' => $type, 'item_id' => $id, 'locale' => $locale, 'hash' => $hash])->first(['text', 'source_lang']);
        if ($cached !== null) {
            $source = is_string($cached->source_lang) ? $cached->source_lang : null;

            return ['text' => (string) $cached->text, 'source' => $source, 'same' => $source === Locales::primary($locale)];
        }
        $result = $this->translator->content($text, $locale);
        if ($result === null) {
            throw ValidationException::withMessages(['text' => 'Не вдалося перекласти — спробуйте пізніше.']);
        }
        Log::info('translate: content', ['engine' => $result['engine'], 'type' => $type, 'locale' => $locale, 'chars' => mb_strlen($text)]);
        DB::table('content_translations')->insertOrIgnore([
            'type' => $type, 'item_id' => $id, 'locale' => $locale, 'hash' => $hash,
            'text' => $result['text'], 'source_lang' => $result['source'] ?: null, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return ['text' => $result['text'], 'source' => $result['source'] ?: null, 'same' => $result['source'] === Locales::primary($locale)];
    }

    /** Текст, якщо людина має право його бачити. */
    private function textFor(string $type, int $id, User $user): ?string
    {
        return match ($type) {
            'post' => Post::query()->visibleTo($user, $this->friendships->friendIds($user))->whereKey($id)->value('body'),
            'comment' => $this->comment($id, $user),
            'message' => $this->message($id, $user),
            'track' => $this->lyrics($id),
            default => null,
        };
    }

    private function comment(int $id, User $user): ?string
    {
        $comment = Comment::query()->find($id);
        if (! $comment instanceof Comment) {
            return null;
        }
        if ($comment->post_id !== null) {
            $visible = Post::query()->visibleTo($user, $this->friendships->friendIds($user))->whereKey($comment->post_id)->exists();

            return $visible ? $comment->body : null;
        }
        if ($comment->photo_id !== null) {
            $photo = Photo::query()->with('album')->find($comment->photo_id);

            return $photo instanceof Photo && $this->photos->canView($photo->album, $user) ? $comment->body : null;
        }

        return $comment->body;
    }

    /**
     * Текст пісні без часових міток LRC — рядок у рядок, щоб переклад лягав під оригінал.
     */
    private function lyrics(int $id): ?string
    {
        $lyrics = Track::query()->whereKey($id)->value('lyrics');
        if (! is_string($lyrics) || trim($lyrics) === '') {
            return null;
        }
        $lines = array_map(fn (string $line) => trim((string) preg_replace('/^(\[[0-9:.]+\]\s*)+/', '', $line)), preg_split('/\R/', $lyrics) ?: []);
        $lines = array_filter($lines, fn (string $line) => ! preg_match('/^\[[a-z]+:.*\]$/i', $line));

        return implode("\n", $lines);
    }

    private function message(int $id, User $user): ?string
    {
        $message = Message::query()->with('conversation')->find($id);

        return $message instanceof Message && $message->conversation?->participantFor($user) !== null ? $message->body : null;
    }
}

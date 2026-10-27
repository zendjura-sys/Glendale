<?php

namespace App\Services\Chat;

use App\Models\Conversation;
use App\Models\User;
use App\Services\ImageStorage;
use App\Services\Messenger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Фон чату: тихі готові візерунки або своє фото. Адміністратори групи ставлять спільний фон
 * для всіх, кожен може замінити його особистим (бачить лише сам).
 */
class ChatBackgrounds
{
    /** Ключі готових фонів — малюються класами .gc-chat-bg-<ключ> у CSS. */
    public const PRESETS = ['aurora', 'midnight', 'dusk', 'ocean', 'forest', 'dots', 'grid', 'waves'];

    private const IMAGE = 'img:';

    public function __construct(
        private readonly ImageStorage $images,
        private readonly Messenger $messenger,
    ) {}

    /**
     * Значення з бази → що малювати.
     *
     * @return array{preset: string|null, image: string|null}|null
     */
    public function resolve(?string $value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (str_starts_with($value, self::IMAGE)) {
            return ['preset' => null, 'image' => Storage::disk('public')->url(substr($value, strlen(self::IMAGE)))];
        }

        return in_array($value, self::PRESETS, true) ? ['preset' => $value, 'image' => null] : null;
    }

    /** Готовий фон або «без фону» (null) — для себе чи для всіх. */
    public function set(Conversation $conversation, User $user, ?string $preset, bool $forAll): void
    {
        abort_unless($preset === null || in_array($preset, self::PRESETS, true), 422, 'Такого фону немає.');
        $this->apply($conversation, $user, $preset, $forAll);
    }

    public function upload(Conversation $conversation, User $user, UploadedFile $file, bool $forAll): void
    {
        $stored = $this->images->store($file, 'chat-backgrounds', 2400);
        $this->apply($conversation, $user, self::IMAGE.$stored['path'], $forAll);
    }

    private function apply(Conversation $conversation, User $user, ?string $value, bool $forAll): void
    {
        $me = $conversation->participantFor($user);
        abort_if($me === null, 404);
        if ($forAll) {
            abort_unless($conversation->isGroup() && $me->canManage(), 403, 'Спільний фон ставлять адміністратори бесіди.');
            $this->forget($conversation->background);
            $conversation->update(['background' => $value]);
            $this->messenger->noticeBy($conversation, $user, $this->messenger->genderVerb($user, 'змінив', 'змінила').' фон чату');

            return;
        }
        $this->forget($me->background);
        $me->update(['background' => $value]);
    }

    /** Старе своє фото фону більше не потрібне — прибрати файл. */
    private function forget(?string $value): void
    {
        if ($value !== null && str_starts_with($value, self::IMAGE)) {
            $this->images->delete(substr($value, strlen(self::IMAGE)));
        }
    }
}

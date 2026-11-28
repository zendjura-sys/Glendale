<?php

namespace App\Services\Music;

use App\Models\Track;
use App\Support\Net\PublicUrl;
use RuntimeException;

/** Помилка завантаження за посиланням: повідомлення українською, його бачить користувач. */
class ImportFailed extends RuntimeException
{
    public const NOT_AUDIO = 'Це не аудіофайл — потрібне пряме посилання на файл (.mp3, .flac…).';

    public const UNREACHABLE = 'Не вдалося з’єднатися з сервером за посиланням.';

    public const TIMEOUT = 'Сервер не відповів вчасно — спробуйте пізніше.';

    public const TOO_LONG = 'Файл завантажувався надто довго — спробуйте ще раз або менший файл.';

    public const NOT_FOUND = 'Файл за посиланням не знайдено (404).';

    public const REDIRECTS = 'Забагато переадресацій — потрібне пряме посилання на файл.';

    public const LIMITED = 'Сервер тимчасово обмежив завантаження — спробуйте пізніше.';

    public const EMPTY = 'Файл за посиланням порожній.';

    public const GENERIC = 'Не вдалося завантажити файл — спробуйте ще раз.';

    public const FORBIDDEN = 'Сервер не дав доступу до файлу — потрібне відкрите посилання.';

    public const SERVER = 'Сервер за посиланням повернув помилку — спробуйте пізніше.';

    public const STALE = 'Завантаження зависло — спробуйте ще раз.';

    public static function unsupported(): self
    {
        return new self('Такий формат не підтримується — підійдуть: '.implode(', ', Track::uploadFormats()).'.');
    }

    public static function tooBig(int $maxMb): self
    {
        return new self('Файл завеликий (максимум '.$maxMb.' МБ).');
    }

    /** Чому адреса недозволена (причина з PublicUrl). */
    public static function address(string $reason): string
    {
        return match ($reason) {
            PublicUrl::CREDENTIALS => 'Посилання з логіном і паролем не підходить — відкрийте доступ до файлу за посиланням.',
            PublicUrl::PRIVATE => 'Посилання веде на внутрішню адресу — потрібна публічна адреса в інтернеті.',
            PublicUrl::UNRESOLVED => 'Сервер за посиланням не знайдено — перевірте адресу.',
            default => 'Потрібне посилання http або https.',
        };
    }
}

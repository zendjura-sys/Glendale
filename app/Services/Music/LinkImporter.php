<?php

namespace App\Services\Music;

use App\Models\Track;
use App\Models\TrackImport;
use App\Services\MusicService;
use App\Support\Net\PublicUrl;
use App\Support\Settings\SiteSettings;
use GuzzleHttp\Psr7\UriResolver;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Symfony\Component\Mime\MimeTypes;
use Throwable;

/**
 * «Завантажити за посиланням»: сервер сам завантажує аудіофайл (пряме посилання або файл, відкритий
 * «усім, хто має посилання» на Google Диску, Dropbox чи OneDrive) і додає його як звичайне завантаження
 * (MusicService::upload → ProcessTrackAudio → EnrichTrackMetadata). Кожна адреса, зокрема після
 * переадресації, проходить перевірку PublicUrl; розмір обмежено налаштуванням music_max_track_mb.
 */
class LinkImporter
{
    public const MAX_REDIRECTS = 5;

    public const USER_AGENT = 'GameConMusic/1.0 (+https://gamecon.online; завантаження файлу за посиланням користувача)';

    public const CONNECT_TIMEOUT = 10;

    /** Менше за таймаут задачі (85 с), щоб встигнути записати помилку. */
    public const TIMEOUT = 70;

    /** HTML-сторінку (підтвердження Google Диска тощо) читаємо не більше за цей розмір. */
    private const HTML_LIMIT = 1024 * 1024;

    /** Довіра до назви й виконавця з імені файлу: нижча за теги, тож збагачення їх покращить. */
    public const SCORE_FILENAME = 10;

    /** Кодек → розширення, якщо з імені файлу формат не зрозумілий. */
    private const CODEC_EXTENSIONS = ['mp3' => 'mp3', 'aac' => 'm4a', 'alac' => 'm4a', 'flac' => 'flac', 'vorbis' => 'ogg', 'opus' => 'opus',
        'pcm_s16le' => 'wav', 'pcm_s24le' => 'wav', 'pcm_s32le' => 'wav', 'pcm_u8' => 'wav', 'pcm_f32le' => 'wav', 'wmav1' => 'wma', 'wmav2' => 'wma',
        'wmapro' => 'wma', 'wmalossless' => 'wma', 'ape' => 'ape', 'wavpack' => 'wv', 'tta' => 'tta', 'ac3' => 'ac3', 'amr_nb' => 'amr', 'amr_wb' => 'amr',
        'pcm_s16be' => 'aiff', 'pcm_s24be' => 'aiff'];

    public function __construct(
        private readonly ShareLinks $links,
        private readonly PublicUrl $net,
        private readonly AudioProbe $probe,
        private readonly MusicService $music,
        private readonly SiteSettings $settings,
    ) {}

    /** Завантажує файл і додає трек у медіатеку власника. Помилка — ImportFailed з повідомленням для людини. */
    public function import(TrackImport $import): Track
    {
        $file = tempnam(sys_get_temp_dir(), 'gc-link-');
        if ($file === false) {
            throw new ImportFailed(ImportFailed::GENERIC);
        }

        try {
            $import->forceFill(['status' => TrackImport::DOWNLOADING, 'progress' => null, 'error' => null])->save();
            ['name' => $name, 'type' => $type] = $this->download($import, $file);

            $import->forceFill(['status' => TrackImport::PROCESSING, 'progress' => null])->save();
            $track = $this->store($import, $file, $name, $type);

            $import->forceFill(['status' => TrackImport::DONE, 'progress' => 100, 'track_id' => $track->id, 'error' => null])->save();

            return $track;
        } finally {
            @unlink($file);
        }
    }

    /**
     * @return array{name: string|null, type: string|null}
     */
    private function download(TrackImport $import, string $file): array
    {
        $maxMb = max(1, (int) $this->settings->get('music_max_track_mb'));
        $max = $maxMb * 1024 * 1024;
        $url = $this->links->resolve($import->url);

        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            // Переадресація на сторінку входу — файл закритий; на сервіс потокового відтворення — не файл.
            if ($this->links->isLogin($url)) {
                throw new ImportFailed(ShareLinks::PRIVATE);
            }
            if (($rejection = $this->links->rejection($url)) !== null) {
                throw new ImportFailed($rejection);
            }
            $inspected = $this->net->inspect($url);
            if ($inspected['reason'] !== null) {
                throw new ImportFailed(ImportFailed::address($inspected['reason']));
            }

            $response = $this->fetch($import, $url, $inspected, $file, $max, $maxMb);
            $status = $response->status();
            if ($status >= 300 && $status < 400) {
                $location = trim($response->header('Location'));
                if ($location === '') {
                    throw new ImportFailed(ImportFailed::GENERIC);
                }
                $url = (string) UriResolver::resolve(Utils::uriFor($url), Utils::uriFor($location));

                continue;
            }
            $this->checkStatus($status, $url);

            if ($this->isHtml($response, $file)) {
                $html = (string) file_get_contents($file, false, null, 0, self::HTML_LIMIT);
                // Google Диск: «Не вдалося перевірити файл на віруси» — повторюємо запит із полями форми.
                if (($confirm = $this->links->driveConfirmUrl($html, $url)) !== null) {
                    $url = $confirm;

                    continue;
                }
                if ($this->links->isCloud($url)) {
                    throw new ImportFailed(str_contains(ShareLinks::host($url), 'google') && $this->links->isDriveQuota($html)
                        ? ImportFailed::LIMITED : ShareLinks::PRIVATE);
                }

                throw new ImportFailed(ImportFailed::NOT_AUDIO);
            }

            $size = (int) filesize($file);
            if ($size > $max || (int) $response->header('Content-Length') > $max) {
                throw ImportFailed::tooBig($maxMb);
            }
            if ($size === 0) {
                throw new ImportFailed(ImportFailed::EMPTY);
            }

            return ['name' => $this->filename($response, $url), 'type' => $response->header('Content-Type') ?: null];
        }

        throw new ImportFailed(ImportFailed::REDIRECTS);
    }

    /**
     * Один запит без автоматичних переадресацій (їх перевіряємо самі), тіло — одразу у файл.
     * З’єднання прив’язане до перевірених IP; розмір обмежено і за Content-Length, і під час завантаження.
     *
     * @param  array{reason: string|null, host: string, port: int, ips: list<string>}  $inspected
     */
    private function fetch(TrackImport $import, string $url, array $inspected, string $file, int $max, int $maxMb): Response
    {
        $state = ['too_big' => false, 'bytes' => 0, 'saved_at' => 0.0, 'percent' => null];

        $options = [
            'sink' => $file,
            'allow_redirects' => false,
            'decode_content' => true,
            'on_headers' => function (ResponseInterface $response) use (&$state, $max) {
                $redirect = $response->getStatusCode() >= 300 && $response->getStatusCode() < 400;
                if (! $redirect && (int) $response->getHeaderLine('Content-Length') > $max) {
                    $state['too_big'] = true;

                    throw new ImportFailed('too big');
                }
            },
            'progress' => function (int|float $total, int|float $now) use (&$state, $max, $import) {
                $state['bytes'] = (int) $now;
                if ($now > $max) {
                    $state['too_big'] = true;

                    throw new ImportFailed('too big');
                }
                // Прогрес у базі — не частіше за раз на секунду.
                $percent = $total > 0 ? (int) min(99, floor($now * 100 / $total)) : null;
                if ($percent !== $state['percent'] && microtime(true) - $state['saved_at'] >= 1.0) {
                    $state['percent'] = $percent;
                    $state['saved_at'] = microtime(true);
                    $import->forceFill(['progress' => $percent, 'bytes' => (int) $now])->saveQuietly();
                }
            },
        ];
        $resolve = PublicUrl::curlResolve($inspected);
        if ($resolve !== [] && defined('CURLOPT_RESOLVE')) {
            $options['curl'] = [CURLOPT_RESOLVE => $resolve];
        }

        try {
            return Http::withUserAgent(self::USER_AGENT)
                ->accept('audio/*, application/octet-stream;q=0.9, */*;q=0.5')
                ->connectTimeout(self::CONNECT_TIMEOUT)
                ->timeout(self::TIMEOUT)
                ->withOptions($options)
                ->get($url);
        } catch (Throwable $e) {
            if ($state['too_big']) {
                throw ImportFailed::tooBig($maxMb);
            }
            $message = $e->getMessage();
            if (str_contains($message, 'cURL error 28') || stripos($message, 'timed out') !== false) {
                throw new ImportFailed($state['bytes'] > 0 ? ImportFailed::TOO_LONG : ImportFailed::TIMEOUT);
            }

            throw new ImportFailed(ImportFailed::UNREACHABLE);
        }
    }

    private function checkStatus(int $status, string $url): void
    {
        if ($status < 400) {
            return;
        }

        throw new ImportFailed(match (true) {
            in_array($status, [404, 410], true) => ImportFailed::NOT_FOUND,
            in_array($status, [401, 403], true) => $this->links->isCloud($url) ? ShareLinks::PRIVATE : ImportFailed::FORBIDDEN,
            $status === 429 => ImportFailed::LIMITED,
            $status >= 500 => ImportFailed::SERVER,
            default => ImportFailed::GENERIC,
        });
    }

    /** HTML замість файлу: за типом відповіді або за початком вмісту. */
    private function isHtml(Response $response, string $file): bool
    {
        $type = strtolower($response->header('Content-Type'));
        if (str_contains($type, 'text/html') || str_contains($type, 'application/xhtml')) {
            return true;
        }
        $head = strtolower(ltrim((string) file_get_contents($file, false, null, 0, 512)));

        return str_starts_with($head, '<!doctype html') || str_starts_with($head, '<html');
    }

    /** Ім’я файлу з Content-Disposition або з адреси (лише якщо в ньому є розширення). */
    private function filename(Response $response, string $url): ?string
    {
        $disposition = $response->header('Content-Disposition');
        $name = null;
        if (preg_match("/filename\\*\\s*=\\s*(?:UTF-8|utf-8)''([^;]+)/", $disposition, $m)) {
            $name = rawurldecode(trim($m[1], " \"'"));
        } elseif (preg_match('/filename\s*=\s*"([^"]+)"/i', $disposition, $m) || preg_match('/filename\s*=\s*([^;]+)/i', $disposition, $m)) {
            $name = trim($m[1], " \"'");
        }
        if ($name === null || $name === '') {
            $base = basename(rawurldecode((string) parse_url($url, PHP_URL_PATH)));
            $name = str_contains($base, '.') ? $base : null;
        }
        $name = $name !== null ? trim(str_replace(['/', '\\', "\0"], ' ', $name)) : null;

        return $name !== '' ? $name : null;
    }

    private function store(TrackImport $import, string $file, ?string $name, ?string $type): Track
    {
        $info = $this->probe->probe($file);
        $mime = (string) (mime_content_type($file) ?: '');
        if ($info === null && ($this->probe->ffprobeAvailable() || $this->probe->id3Available() || ! str_starts_with($mime, 'audio/'))) {
            throw new ImportFailed(ImportFailed::NOT_AUDIO);
        }

        $extension = $this->extension($name, $info['codec'] ?? null, $mime);
        if ($extension === null) {
            throw ImportFailed::unsupported();
        }

        $base = $name !== null ? (string) preg_replace('/\.[A-Za-z0-9]{1,5}$/', '', $name) : '';
        [$meta, $auto] = $this->meta($import->hints ?? [], $info['tags'] ?? [], $base);
        $meta['duration'] = min(7200, (int) ($info['duration'] ?? 0));

        $audio = new UploadedFile($file, Str::limit($base !== '' ? $base : 'track', 100, '').'.'.$extension, $type, null, true);

        return $this->music->upload($import->user, $audio, $meta, null, $auto);
    }

    /** Розширення: з імені файлу, інакше за кодеком чи типом вмісту; лише з Track::uploadFormats(). */
    private function extension(?string $name, ?string $codec, string $mime): ?string
    {
        $formats = Track::uploadFormats();
        $fromName = $name !== null ? strtolower(pathinfo($name, PATHINFO_EXTENSION)) : '';
        $fromCodec = $codec !== null ? (self::CODEC_EXTENSIONS[$codec] ?? null) : null;
        $fromMime = $mime !== '' ? (MimeTypes::getDefault()->getExtensions($mime)[0] ?? null) : null;

        foreach ([$fromName, $fromCodec, $fromMime] as $candidate) {
            if ($candidate !== null && $candidate !== '' && in_array($candidate, $formats, true)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Назва й виконавець: вказане людиною > теги файлу > ім’я файлу «Виконавець - Назва». Не від людини —
     * позначаємо як автоматичне, щоб збагачення метаданих могло їх покращити.
     *
     * @param  array<string, mixed>  $hints
     * @param  array<string, mixed>  $tags
     * @return array{0: array{title: string, artist: string, album?: string|null, genre?: string|null}, 1: array<string, array{source: string, score: int|float}>}
     */
    private function meta(array $hints, array $tags, string $base): array
    {
        $guess = $this->guess($base);
        $fallback = ['title' => $guess['title'] ?? 'Без назви', 'artist' => 'Невідомий виконавець'];
        $meta = [];
        $auto = [];

        foreach (['title', 'artist'] as $field) {
            $hint = trim((string) ($hints[$field] ?? ''));
            $tag = trim((string) ($tags[$field] ?? ''));
            if ($hint !== '') {
                $meta[$field] = $hint;
            } elseif ($tag !== '') {
                $meta[$field] = $tag;
                $auto[$field] = ['source' => 'tags', 'score' => MetadataEnricher::SCORE_TAGS];
            } elseif (filled($guess[$field] ?? null)) {
                $meta[$field] = (string) $guess[$field];
                $auto[$field] = ['source' => 'filename', 'score' => self::SCORE_FILENAME];
            } else {
                $meta[$field] = $fallback[$field];
                $auto[$field] = ['source' => 'filename', 'score' => 0];
            }
        }
        // Альбом і жанр — лише від людини; з тегів їх підставить ProcessTrackAudio.
        foreach (['album', 'genre'] as $field) {
            $hint = trim((string) ($hints[$field] ?? ''));
            if ($hint !== '') {
                $meta[$field] = $hint;
            }
        }

        /** @var array{title: string, artist: string, album?: string|null, genre?: string|null} $meta */
        return [$meta, $auto];
    }

    /**
     * «01 - Виконавець - Назва», «Виконавець – Назва», «Назва».
     *
     * @return array{title?: string, artist?: string}
     */
    private function guess(string $base): array
    {
        $clean = trim((string) preg_replace('/\s+/u', ' ', str_replace('_', ' ', $base)));
        $clean = trim((string) preg_replace('/^\d{1,3}\s*[.\-–—)]\s*/u', '', $clean));
        if ($clean === '') {
            return [];
        }
        $parts = preg_split('/\s+[-–—]\s+/u', $clean, 2);
        if (is_array($parts) && count($parts) === 2 && trim($parts[0]) !== '' && trim($parts[1]) !== '') {
            return ['artist' => trim($parts[0]), 'title' => trim($parts[1])];
        }

        return ['title' => $clean];
    }
}

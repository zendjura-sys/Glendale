<?php

namespace App\Support;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Файли застосунку для прямого завантаження (Адмінка → Дизайн): APK, Windows, macOS, Linux.
 * Завантажуються частинами по CHUNK_BYTES, щоб обійти ліміт розміру запиту, складаються на сервері
 * й лежать на диску public (`downloads/<платформа>/<назва>`) — nginx віддає їх напряму.
 * Завантажений файл має перевагу над посиланням із того ж поля.
 */
class AppFiles
{
    /** Налаштування сайту: {платформа: {path, name, size, sha256, uploaded_at}}. */
    public const SETTING = 'app_files';

    /** Дозволені закінчення назв файлів для кожної платформи. */
    public const PLATFORMS = [
        'apk' => ['.apk'],
        'windows' => ['.exe', '.msi', '.msix', '.zip'],
        'macos' => ['.dmg', '.pkg', '.zip'],
        'linux' => ['.deb', '.rpm', '.appimage', '.tar.gz', '.zip'],
    ];

    public const MAX_BYTES = 1024 * 1024 * 1024;

    public const CHUNK_BYTES = 4 * 1024 * 1024;

    /** Тека частин на приватному диску; недокачані частини старші за добу видаляються. */
    private const PARTS = 'app-uploads';

    /**
     * Збережені файли без шляхів на диску — для сторінки /app і адмінки.
     *
     * @return array<string, array{name: string, size: int, sha256: string, uploaded_at: string, url: string}>
     */
    public static function all(?SiteSettings $settings = null): array
    {
        $stored = self::stored($settings ?? app(SiteSettings::class));
        $files = [];
        foreach (array_keys(self::PLATFORMS) as $platform) {
            $file = $stored[$platform] ?? null;
            if ($file === null || ! is_string($file['path'] ?? null) || ! Storage::disk('public')->exists($file['path'])) {
                continue;
            }
            $files[$platform] = [
                'name' => is_string($file['name'] ?? null) ? $file['name'] : basename($file['path']),
                'size' => is_int($file['size'] ?? null) ? $file['size'] : 0,
                'sha256' => is_string($file['sha256'] ?? null) ? $file['sha256'] : '',
                'uploaded_at' => is_string($file['uploaded_at'] ?? null) ? $file['uploaded_at'] : '',
                'url' => Storage::disk('public')->url($file['path']),
            ];
        }

        return $files;
    }

    /** Чи дозволена назва файлу для платформи (за закінченням). */
    public static function allowed(string $platform, string $name): bool
    {
        $lower = Str::lower($name);

        return collect(self::PLATFORMS[$platform] ?? [])->contains(fn (string $ext) => str_ends_with($lower, $ext));
    }

    /**
     * Приймає одну частину. Коли прийшла остання — складає файл, перевіряє й публікує.
     *
     * @return array{name: string, size: int, sha256: string}|null null — чекаємо наступні частини
     */
    public static function receive(string $platform, string $uploadId, int $index, int $total, string $name, UploadedFile $chunk): ?array
    {
        $disk = Storage::disk('local');
        if ($index === 0) {
            self::sweep();
        }
        $dir = self::PARTS.'/'.$uploadId;
        $disk->putFileAs($dir, $chunk, sprintf('%05d.part', $index));

        $parts = collect($disk->files($dir))->filter(fn (string $f) => str_ends_with($f, '.part'))->sort()->values();
        if ($parts->count() < $total) {
            return null;
        }

        try {
            return self::assemble($platform, $name, $parts->all());
        } finally {
            $disk->deleteDirectory($dir);
        }
    }

    /** Видаляє файл платформи (сам файл адміна, не дані користувачів). */
    public static function delete(string $platform): void
    {
        $settings = app(SiteSettings::class);
        $stored = self::stored($settings);
        $path = $stored[$platform]['path'] ?? null;
        if (is_string($path)) {
            Storage::disk('public')->delete($path);
        }
        unset($stored[$platform]);
        $settings->put([self::SETTING => $stored]);
    }

    /**
     * @param  list<string>  $parts
     * @return array{name: string, size: int, sha256: string}
     */
    private static function assemble(string $platform, string $name, array $parts): array
    {
        $disk = Storage::disk('local');
        $tmp = $disk->path(self::PARTS.'/'.Str::uuid()->toString().'.bin');
        $out = fopen($tmp, 'wb');
        if ($out === false) {
            throw new RuntimeException('Не вдалося зберегти файл.');
        }
        $size = 0;
        try {
            foreach ($parts as $part) {
                $in = fopen($disk->path($part), 'rb');
                if ($in === false) {
                    throw new RuntimeException('Частина файлу загубилася. Завантажте ще раз.');
                }
                $size += (int) stream_copy_to_stream($in, $out);
                fclose($in);
                if ($size > self::MAX_BYTES) {
                    throw new RuntimeException('Файл більший за 1 ГБ.');
                }
            }
        } finally {
            fclose($out);
        }

        try {
            // APK — це zip-архів: перші байти «PK». Так відсіюємо випадково вибраний не той файл.
            if ($platform === 'apk' && file_get_contents($tmp, false, null, 0, 2) !== 'PK') {
                throw new RuntimeException('Це не схоже на APK-файл.');
            }
            $sha = (string) hash_file('sha256', $tmp);
            $clean = self::cleanName($name);
            $path = 'downloads/'.$platform.'/'.$clean;

            $settings = app(SiteSettings::class);
            $stored = self::stored($settings);
            $old = $stored[$platform]['path'] ?? null;

            $stream = fopen($tmp, 'rb');
            if ($stream === false || ! Storage::disk('public')->put($path, $stream)) {
                throw new RuntimeException('Не вдалося зберегти файл.');
            }
            fclose($stream);
            if (is_string($old) && $old !== $path) {
                Storage::disk('public')->delete($old);
            }

            $stored[$platform] = ['path' => $path, 'name' => $clean, 'size' => $size, 'sha256' => $sha, 'uploaded_at' => now()->toIso8601String()];
            $settings->put([self::SETTING => $stored]);

            return ['name' => $clean, 'size' => $size, 'sha256' => $sha];
        } finally {
            File::delete($tmp);
        }
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private static function stored(SiteSettings $settings): array
    {
        $stored = $settings->get(self::SETTING);

        return is_array($stored) ? array_filter($stored, 'is_array') : [];
    }

    /** Безпечна назва: латиниця, цифри, крапка, дефіс; закінчення зберігаємо. */
    private static function cleanName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $clean = preg_replace('/[^A-Za-z0-9._-]+/', '-', Str::ascii($name)) ?? '';
        $clean = trim($clean, '.-');

        return $clean === '' ? 'GameCon' : (strlen($clean) > 120 ? substr($clean, -120) : $clean);
    }

    /** Прибирає недокачані завантаження, старші за добу. */
    private static function sweep(): void
    {
        $disk = Storage::disk('local');
        foreach ($disk->directories(self::PARTS) as $dir) {
            if (now()->timestamp - (int) @filemtime($disk->path($dir)) > 86400) {
                $disk->deleteDirectory($dir);
            }
        }
    }
}

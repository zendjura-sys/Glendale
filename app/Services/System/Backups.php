<?php

namespace App\Services\System;

use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Резервні копії бази: щоденний дамп у приватне сховище (storage/app/private/backups), зберігаються останні KEEP.
 * Пароль бази передається через змінну середовища, не в командному рядку.
 * Хмара (№268): якщо в Інтеграціях задано S3-сховище й пароль шифрування, кожна копія ще йде
 * туди зашифрованою — на випадок, коли сервер утрачено разом із диском.
 */
class Backups
{
    public const DIR = 'backups';

    public const KEEP = 14;

    /** Скільки копій тримати в хмарі за замовчуванням (≈ місяць щоденних). */
    public const CLOUD_KEEP = 30;

    private const CLOUD_STATUS = 'backups.cloud.last';

    /**
     * @return list<array{name: string, size: int, created_at: string}>
     */
    public function list(): array
    {
        $disk = Storage::disk('local');
        $files = array_filter($disk->files(self::DIR), fn (string $f) => str_ends_with($f, '.gz'));
        $rows = array_map(fn (string $f) => [
            'name' => basename($f),
            'size' => $disk->size($f),
            'created_at' => date(DATE_ATOM, $disk->lastModified($f)),
        ], $files);
        usort($rows, fn (array $a, array $b) => strcmp($b['created_at'], $a['created_at']));

        return $rows;
    }

    /** Створює копію й прибирає старі; повертає ім’я файлу. */
    public function create(): string
    {
        $name = 'gamecon-'.now()->format('Ymd-His').'.sql.gz';
        $disk = Storage::disk('local');
        $disk->makeDirectory(self::DIR);
        $target = $disk->path(self::DIR.'/'.$name);
        $connection = config('database.default');
        $config = (array) config("database.connections.{$connection}");

        match ($config['driver'] ?? null) {
            'mysql', 'mariadb' => $this->run(
                ['mysqldump', '--single-transaction', '--quick', '--routines', '-h', (string) ($config['host'] ?? '127.0.0.1'), '-P', (string) ($config['port'] ?? 3306), '-u', (string) ($config['username'] ?? ''), (string) ($config['database'] ?? '')],
                ['MYSQL_PWD' => (string) ($config['password'] ?? '')],
                $target,
            ),
            'pgsql' => $this->run(
                ['pg_dump', '-h', (string) ($config['host'] ?? '127.0.0.1'), '-p', (string) ($config['port'] ?? 5432), '-U', (string) ($config['username'] ?? ''), (string) ($config['database'] ?? '')],
                ['PGPASSWORD' => (string) ($config['password'] ?? '')],
                $target,
            ),
            'sqlite' => $this->sqlite((string) ($config['database'] ?? ''), $target),
            default => throw new RuntimeException('Невідомий драйвер бази для резервної копії.'),
        };
        $this->prune();
        // Хмара — окремий крок: її збій не скасовує локальну копію, лише пишеться в журнал і в адмінку.
        if ($this->cloudReady()) {
            try {
                $this->upload($name);
            } catch (\Throwable $e) {
                Log::warning('backup: cloud upload failed', ['file' => $name, 'error' => $e->getMessage()]);
                Cache::forever(self::CLOUD_STATUS, ['at' => now()->toIso8601String(), 'ok' => false, 'file' => $name, 'error' => $e->getMessage()]);
            }
        }

        return $name;
    }

    /** Сховище й пароль шифрування задано. */
    public function cloudReady(): bool
    {
        return app(S3Storage::class)->configured() && $this->passphrase() !== null;
    }

    /** Зашифрувати копію, відправити в хмару й прибрати там найстаріші. */
    public function upload(string $name): void
    {
        $path = $this->path($name) ?? throw new RuntimeException('Копію не знайдено.');
        $passphrase = $this->passphrase() ?? throw new RuntimeException('Не задано пароль шифрування копій.');
        $encrypted = $path.'.enc';
        try {
            BackupCipher::encrypt($path, $encrypted, $passphrase);
            $s3 = app(S3Storage::class);
            $s3->put($s3->prefix().$name.'.enc', $encrypted);
        } finally {
            @unlink($encrypted);
        }
        $this->pruneCloud();
        Cache::forever(self::CLOUD_STATUS, ['at' => now()->toIso8601String(), 'ok' => true, 'file' => $name.'.enc', 'error' => null]);
        Log::info('backup: uploaded to cloud', ['file' => $name.'.enc']);
    }

    /**
     * Остання спроба відправити копію в хмару (для адмінки).
     *
     * @return array{at: string, ok: bool, file: string, error: string|null}|null
     */
    public function cloudStatus(): ?array
    {
        $status = Cache::get(self::CLOUD_STATUS);
        if (! is_array($status)) {
            return null;
        }

        return [
            'at' => (string) ($status['at'] ?? ''),
            'ok' => (bool) ($status['ok'] ?? false),
            'file' => (string) ($status['file'] ?? ''),
            'error' => isset($status['error']) ? (string) $status['error'] : null,
        ];
    }

    private function pruneCloud(): void
    {
        $s3 = app(S3Storage::class);
        $keep = max(3, (int) (app(SiteSettings::class)->get('backup_cloud_keep') ?: self::CLOUD_KEEP));
        $ours = array_values(array_filter($s3->list($s3->prefix()),
            fn (array $o) => preg_match('/gamecon-\d{8}-\d{6}\.sql\.gz\.enc$/', $o['key']) === 1));
        // Імена з датою — сортуються самі; видаляємо лише свої файли, не чіпаючи іншого в кошику.
        usort($ours, fn (array $a, array $b) => strcmp($b['key'], $a['key']));
        foreach (array_slice($ours, $keep) as $old) {
            $s3->delete($old['key']);
        }
    }

    private function passphrase(): ?string
    {
        $value = app(SiteSettings::class)->secret('backup_passphrase');

        return is_string($value) && strlen($value) >= 12 ? $value : null;
    }

    public function path(string $name): ?string
    {
        if (! preg_match('/^gamecon-\d{8}-\d{6}\.sql\.gz$/', $name)) {
            return null;
        }
        $disk = Storage::disk('local');

        return $disk->exists(self::DIR.'/'.$name) ? $disk->path(self::DIR.'/'.$name) : null;
    }

    private function prune(): void
    {
        $disk = Storage::disk('local');
        foreach (array_slice($this->list(), self::KEEP) as $old) {
            $disk->delete(self::DIR.'/'.$old['name']);
        }
    }

    /**
     * @param  list<string>  $command
     * @param  array<string, string>  $env
     */
    private function run(array $command, array $env, string $target): void
    {
        // Потоком у gzip — дамп не тримається в пам’яті; аргументи передаються як "$@", без підстановки в рядок.
        $result = Process::env([...$env, 'GC_BACKUP_TARGET' => $target])->timeout(1800)
            ->run(['bash', '-c', 'set -o pipefail; "$@" | gzip -6 > "$GC_BACKUP_TARGET"', 'bash', ...$command]);
        if (! $result->successful()) {
            @unlink($target);
            throw new RuntimeException('Резервна копія не вдалася: '.trim($result->errorOutput()));
        }
    }

    private function sqlite(string $database, string $target): void
    {
        if ($database === ':memory:' || ! is_file($database)) {
            file_put_contents($target, gzencode('-- база в пам’яті, копіювати нічого', 6));

            return;
        }
        file_put_contents($target, gzencode((string) file_get_contents($database), 6));
    }
}

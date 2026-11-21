<?php

namespace Tests\Feature;

use App\Services\System\BackupCipher;
use App\Services\System\Backups;
use App\Services\System\S3Storage;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

/** №268: зашифровані копії бази в S3-сумісному сховищі. */
class CloudBackupsTest extends TestCase
{
    use RefreshDatabase;

    private function configure(): void
    {
        $settings = app(SiteSettings::class);
        $settings->put([
            'backup_s3_endpoint' => 'https://acc.r2.cloudflarestorage.com',
            'backup_s3_bucket' => 'gc-backups',
            'backup_s3_key' => 'AKIAEXAMPLEKEY12',
            'backup_s3_prefix' => 'gamecon',
            'backup_cloud_keep' => 3,
        ]);
        $settings->putSecret('backup_s3_secret', 'secret-secret-secret-secret');
        $settings->putSecret('backup_passphrase', 'дуже-довгий-пароль');
    }

    public function test_cipher_round_trip_rejects_wrong_password_and_tampering(): void
    {
        $dir = sys_get_temp_dir();
        $plain = "$dir/gc-plain.bin";
        // Більше одного шматка (1 МБ), щоб перевірити потік.
        file_put_contents($plain, random_bytes(1048576 * 2 + 123));
        BackupCipher::encrypt($plain, "$dir/gc.enc", 'пароль-12345');
        BackupCipher::decrypt("$dir/gc.enc", "$dir/gc.out", 'пароль-12345');
        $this->assertSame(hash_file('sha256', $plain), hash_file('sha256', "$dir/gc.out"));

        try {
            BackupCipher::decrypt("$dir/gc.enc", "$dir/gc.out", 'не той пароль');
            $this->fail('Неправильний пароль мав не пройти.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Неправильний пароль', $e->getMessage());
        }

        $bytes = (string) file_get_contents("$dir/gc.enc");
        $bytes[200] = chr(ord($bytes[200]) ^ 1);
        file_put_contents("$dir/gc.enc", $bytes);
        $this->expectException(RuntimeException::class);
        BackupCipher::decrypt("$dir/gc.enc", "$dir/gc.out", 'пароль-12345');
    }

    public function test_backup_goes_to_cloud_encrypted_and_old_copies_are_pruned(): void
    {
        Storage::fake('local');
        $this->configure();
        $list = '<ListBucketResult>'
            .collect(['20261101-041000', '20261102-041000', '20261103-041000', '20261104-041000'])
                ->map(fn ($d) => "<Contents><Key>gamecon/gamecon-$d.sql.gz.enc</Key><Size>10</Size><LastModified>x</LastModified></Contents>")->implode('')
            .'<Contents><Key>gamecon/чуже.txt</Key><Size>1</Size><LastModified>x</LastModified></Contents></ListBucketResult>';
        $uploaded = '';
        Http::fake(function (Request $r) use (&$list, &$uploaded) {
            if ($r->method() === 'PUT') {
                $uploaded = substr($r->body(), 0, 5);
                // Як справжнє сховище: нова копія тепер теж у списку.
                $key = substr((string) parse_url($r->url(), PHP_URL_PATH), strlen('/gc-backups/'));
                $list = str_replace('</ListBucketResult>', "<Contents><Key>$key</Key><Size>10</Size><LastModified>x</LastModified></Contents></ListBucketResult>", $list);
            }

            return Http::response($r->method() === 'GET' ? $list : '');
        });

        $name = app(Backups::class)->create();

        Http::assertSent(fn (Request $r) => $r->method() === 'PUT'
            && $r->url() === "https://acc.r2.cloudflarestorage.com/gc-backups/gamecon/$name.enc"
            && str_starts_with($r->header('Authorization')[0] ?? '', 'AWS4-HMAC-SHA256 Credential=AKIAEXAMPLEKEY12/'));
        $this->assertSame('GCBK1', $uploaded, 'у хмару йде зашифрований файл');
        // Тримаємо 3: з 4 старих видаляються 2 найстаріші, чужий файл не чіпаємо.
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && str_ends_with($r->url(), 'gamecon-20261101-041000.sql.gz.enc'));
        Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && str_ends_with($r->url(), 'gamecon-20261102-041000.sql.gz.enc'));
        Http::assertNotSent(fn (Request $r) => $r->method() === 'DELETE' && str_contains(urldecode($r->url()), 'чуже'));
        $this->assertTrue(app(Backups::class)->cloudStatus()['ok'] ?? false);
    }

    public function test_cloud_failure_keeps_local_copy_and_is_reported(): void
    {
        Storage::fake('local');
        $this->configure();
        Http::fake(['*' => Http::response('denied', 403)]);

        $name = app(Backups::class)->create();

        $this->assertNotNull(app(Backups::class)->path($name));
        $status = app(Backups::class)->cloudStatus();
        $this->assertFalse($status['ok'] ?? true);
        $this->assertStringContainsString('не прийняло ключі', (string) $status['error']);
        $this->assertFalse(app(S3Storage::class)->test());
    }
}

<?php

namespace App\Console\Commands;

use App\Services\System\BackupCipher;
use Illuminate\Console\Command;
use Throwable;

/**
 * Відновлення з хмари (№268): розшифрувати копію «gamecon-….sql.gz.enc» у «.sql.gz».
 * Пароль питаємо в консолі (не в аргументах — щоб не лишився в історії команд).
 * Далі: gunzip -c файл.sql.gz | mysql назва_бази
 */
class BackupDecrypt extends Command
{
    protected $signature = 'gc:backup-decrypt {file : зашифрована копія .enc} {--out= : куди записати (за замовчуванням — поруч без .enc)}';

    protected $description = 'Розшифрувати копію бази з хмари';

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        if (! is_file($file)) {
            $this->error('Файл не знайдено: '.$file);

            return self::FAILURE;
        }
        $out = (string) ($this->option('out') ?: preg_replace('/\.enc$/', '', $file));
        if ($out === $file) {
            $out .= '.dec';
        }
        $passphrase = (string) $this->secret('Пароль шифрування копій');
        try {
            BackupCipher::decrypt($file, $out, $passphrase);
        } catch (Throwable $e) {
            @unlink($out);
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info('Готово: '.$out);
        $this->line('Відновлення: gunzip -c '.$out.' | mysql назва_бази');

        return self::SUCCESS;
    }
}

<?php

namespace App\Services\System;

use RuntimeException;

/**
 * Шифрування копії бази перед відправкою в хмару (№268). Ключ — з пароля адміністратора
 * (Argon2id), дані — потоком XChaCha20-Poly1305 шматками по 1 МБ: великий дамп не читається
 * в пам’ять, а підмінений чи обрізаний файл не розшифрується.
 *
 * Формат: «GCBK1» · сіль (16 байт) · заголовок потоку (24) · шматки [довжина 4 байти][шифр].
 * Розшифрувати: php artisan gc:backup-decrypt файл.enc
 */
class BackupCipher
{
    private const MAGIC = 'GCBK1';

    private const CHUNK = 1048576;

    public static function encrypt(string $from, string $to, string $passphrase): void
    {
        [$in, $out] = self::open($from, $to);
        $salt = random_bytes(SODIUM_CRYPTO_PWHASH_SALTBYTES);
        $key = self::key($passphrase, $salt);
        [$state, $header] = sodium_crypto_secretstream_xchacha20poly1305_init_push($key);
        fwrite($out, self::MAGIC.$salt.$header);
        $chunk = fread($in, self::CHUNK);
        while (true) {
            $next = feof($in) ? '' : (string) fread($in, self::CHUNK);
            $last = $next === '' && feof($in);
            $cipher = sodium_crypto_secretstream_xchacha20poly1305_push($state, (string) $chunk, '', $last
                ? SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL
                : SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE);
            fwrite($out, pack('N', strlen($cipher)).$cipher);
            if ($last) {
                break;
            }
            $chunk = $next;
        }
        sodium_memzero($key);
        fclose($in);
        fclose($out);
    }

    public static function decrypt(string $from, string $to, string $passphrase): void
    {
        [$in, $out] = self::open($from, $to);
        $head = (string) fread($in, strlen(self::MAGIC) + SODIUM_CRYPTO_PWHASH_SALTBYTES + SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES);
        if (! str_starts_with($head, self::MAGIC)) {
            throw new RuntimeException('Це не зашифрована копія GameCon.');
        }
        $salt = substr($head, strlen(self::MAGIC), SODIUM_CRYPTO_PWHASH_SALTBYTES);
        $header = substr($head, strlen(self::MAGIC) + SODIUM_CRYPTO_PWHASH_SALTBYTES);
        $key = self::key($passphrase, $salt);
        $state = sodium_crypto_secretstream_xchacha20poly1305_init_pull($header, $key);
        sodium_memzero($key);
        $done = false;
        while (! $done) {
            $size = fread($in, 4);
            if ($size === false || strlen($size) !== 4) {
                throw new RuntimeException('Файл копії обрізано.');
            }
            $length = unpack('N', $size);
            $length = is_array($length) ? (int) $length[1] : 0;
            if ($length < 1 || $length > self::CHUNK + SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_ABYTES) {
                throw new RuntimeException('Файл копії пошкоджено.');
            }
            $cipher = (string) fread($in, $length);
            $result = sodium_crypto_secretstream_xchacha20poly1305_pull($state, $cipher);
            if ($result === false) {
                throw new RuntimeException('Неправильний пароль або файл пошкоджено.');
            }
            [$plain, $tag] = $result;
            fwrite($out, $plain);
            $done = $tag === SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL;
        }
        fclose($in);
        fclose($out);
    }

    private static function key(string $passphrase, string $salt): string
    {
        return sodium_crypto_pwhash(
            SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES, $passphrase, $salt,
            SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE, SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE,
            SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13,
        );
    }

    /** @return array{0: resource, 1: resource} */
    private static function open(string $from, string $to): array
    {
        $in = fopen($from, 'rb');
        $out = fopen($to, 'wb');
        if ($in === false || $out === false) {
            throw new RuntimeException('Не вдалося відкрити файл копії.');
        }

        return [$in, $out];
    }
}

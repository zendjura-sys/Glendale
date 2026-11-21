<?php

namespace App\Services\Antispam;

use App\Models\LoginEvent;
use App\Models\SpamBlock;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Антифрод реєстрацій (№229): одноразова пошта, надто швидке заповнення форми (бот) і ознака
 * обходу бану — новий акаунт з адреси, з якої нещодавно входив заблокований. Останнє лише
 * позначаємо для адміністрації: за однією IP часто багато людей (мобільний інтернет, гуртожиток).
 */
class FraudGuard
{
    /** Скільки днів дивимось назад, шукаючи заблокованих з тієї ж адреси. */
    public const EVASION_DAYS = 30;

    public static function disposable(string $email): bool
    {
        $domain = strtolower(trim((string) substr(strrchr($email, '@') ?: '', 1)));
        if ($domain === '') {
            return false;
        }
        foreach ((array) config('antifraud.disposable_domains') as $bad) {
            if ($domain === $bad || str_ends_with($domain, '.'.$bad)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Перевірка перед створенням акаунта. $startedAt — коли відкрили форму (мс, від клієнта);
     * null — застосунок чи стара форма: час не перевіряємо.
     */
    public function checkSignup(string $email, ?int $startedAt, ?string $ip): void
    {
        if (self::disposable($email)) {
            // У журнал — лише домен, без самої адреси.
            $this->record('signup_disposable', null, $ip, (string) substr(strrchr($email, '@') ?: '', 1));

            throw ValidationException::withMessages(['email' => 'Одноразові поштові скриньки не підходять — вкажіть свою пошту.']);
        }
        if ($startedAt !== null && $startedAt > 0) {
            $seconds = (int) floor(now()->getTimestampMs() / 1000) - (int) floor($startedAt / 1000);
            if ($seconds >= 0 && $seconds < (int) config('antifraud.min_form_seconds', 3)) {
                $this->record('signup_fast', null, $ip, $seconds.' с');

                throw ValidationException::withMessages(['email' => 'Не вдалося зареєструватися. Спробуйте ще раз.']);
            }
        }
    }

    /**
     * Після створення: чи входив з цієї адреси нещодавно заблокований акаунт. Позначка — у
     * налаштуваннях акаунта (fraud_flags) і в журналі антиспаму; рішення — за адміністрацією.
     */
    public function flagEvasion(User $user, ?string $ip): bool
    {
        if ($ip === null || $ip === '') {
            return false;
        }
        $banned = LoginEvent::query()->where('ip', $ip)->where('created_at', '>=', now()->subDays(self::EVASION_DAYS))
            ->whereIn('user_id', User::query()->whereNotNull('banned_at')->select('id'))
            ->distinct()->pluck('user_id')->all();
        if ($banned === []) {
            return false;
        }
        $user->mergePref(['fraud_flags' => ['ban_evasion' => ['banned' => array_values(array_map('intval', $banned)), 'at' => now()->toIso8601String()]]]);
        $this->record('ban_evasion', $user->id, $ip, 'Заблоковані з тієї ж адреси: #'.implode(', #', $banned));
        Log::warning('antifraud: possible ban evasion', ['user' => $user->id, 'banned' => $banned]);

        return true;
    }

    private function record(string $kind, ?int $userId, ?string $ip, string $detail): void
    {
        rescue(fn () => SpamBlock::query()->create([
            'kind' => $kind,
            'user_id' => $userId,
            'ip_hash' => $ip !== null ? IpBans::hash($ip) : null,
            'detail' => mb_substr($detail, 0, 190),
            'created_at' => now(),
        ]), report: false);
    }
}

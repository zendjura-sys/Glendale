<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\ReferralJoined;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Throwable;

/**
 * Запрошення друзів: особисте посилання /r/{код}. Хто зареєструвався за ним — одразу в друзях,
 * а за кожного, хто підтвердив пошту, запрошувач отримує досвід і бейджі.
 */
class Referrals
{
    public const COOKIE = 'gc_ref';

    /** Досвід за одного активного запрошеного (рахується в Achievements). */
    public const XP = 30;

    /** Сходинки нагород: скільки активних запрошених. */
    public const LADDER = [1, 5, 10, 25];

    public function __construct(private readonly FriendshipService $friendships) {}

    public function code(User $user): string
    {
        if ($user->invite_code === null) {
            do {
                $code = Str::lower(Str::random(8));
            } while (User::query()->where('invite_code', $code)->exists());
            $user->forceFill(['invite_code' => $code])->saveQuietly();
        }

        return (string) $user->invite_code;
    }

    public function link(User $user): string
    {
        return URL::to('/r/'.$this->code($user));
    }

    /** Новий акаунт: прив’язуємо до запрошувача, робимо друзями й повідомляємо його. */
    public function attach(User $user, ?string $code): void
    {
        if ($code === null || $code === '' || $user->invited_by !== null) {
            return;
        }
        $inviter = User::query()->where('invite_code', $code)->first();
        if (! $inviter instanceof User || $inviter->is($user) || $inviter->banned_at !== null) {
            return;
        }
        $user->forceFill(['invited_by' => $inviter->id])->saveQuietly();

        try {
            $this->friendships->request($inviter, $user);
            $this->friendships->accept($user, $inviter);
        } catch (Throwable) {
            // Дружба — бонус; запрошення зараховане й без неї.
        }
        $inviter->notify(new ReferralJoined($user));
    }

    /** Активні запрошені — ті, хто підтвердив пошту. */
    public function active(User $user): int
    {
        return User::query()->where('invited_by', $user->id)->whereNotNull('email_verified_at')->count();
    }

    /**
     * @return array{link: string, total: int, active: int, xp: int, ladder: list<array{target: int, reached: bool}>, people: list<array<string, mixed>>}
     */
    public function summary(User $user): array
    {
        $active = $this->active($user);
        $people = User::query()->where('invited_by', $user->id)->latest('id')->limit(30)->get();

        return [
            'link' => $this->link($user),
            'total' => User::query()->where('invited_by', $user->id)->count(),
            'active' => $active,
            'xp' => $active * self::XP,
            'ladder' => array_map(fn (int $target) => ['target' => $target, 'reached' => $active >= $target], self::LADDER),
            'people' => array_values($people->map(fn (User $p) => [...$p->toCard(), 'active' => $p->email_verified_at !== null])->all()),
        ];
    }
}

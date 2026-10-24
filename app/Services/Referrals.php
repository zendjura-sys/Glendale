<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\ReferralActivated;
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

    /** Запрошений підтвердив пошту — запрошувачу сповіщення з прогресом до наступної нагороди. */
    public function activated(User $user): void
    {
        $inviter = $user->invited_by ? User::query()->find($user->invited_by) : null;
        if (! $inviter instanceof User || $inviter->banned_at !== null) {
            return;
        }
        $active = $this->active($inviter);
        $target = collect(self::LADDER)->first(fn (int $t) => $active < $t);
        $inviter->notify(new ReferralActivated($user, $active, $target));
    }

    /** Активні запрошені — ті, хто підтвердив пошту. */
    public function active(User $user): int
    {
        return User::query()->where('invited_by', $user->id)->whereNotNull('email_verified_at')->count();
    }

    /**
     * @return array{link: string, total: int, active: int, xp: int, ladder: list<array{target: int, reached: bool}>, next: array{target: int, left: int, from: int}|null, people: list<array<string, mixed>>}
     */
    public function summary(User $user): array
    {
        $active = $this->active($user);
        $people = User::query()->where('invited_by', $user->id)->withCount('posts')
            ->withExists(['playedPlaces as played'])->latest('id')->limit(30)->get();
        // Наступна сходинка: скільки ще активних друзів і звідки рахувати смужку.
        $target = collect(self::LADDER)->first(fn (int $t) => $active < $t);
        $from = (int) collect(self::LADDER)->filter(fn (int $t) => $t <= $active)->last();

        return [
            'link' => $this->link($user),
            'total' => User::query()->where('invited_by', $user->id)->count(),
            'active' => $active,
            'xp' => $active * self::XP,
            'ladder' => array_map(fn (int $target) => ['target' => $target, 'reached' => $active >= $target], self::LADDER),
            'next' => $target === null ? null : ['target' => $target, 'left' => $target - $active, 'from' => $from],
            // Перші кроки запрошеного: пошта, аватар, перший допис, «граю в…».
            'people' => array_values($people->map(fn (User $p) => [
                ...$p->toCard(),
                'active' => $p->email_verified_at !== null,
                'steps' => [
                    'verified' => $p->email_verified_at !== null,
                    'avatar' => $p->avatar_path !== null,
                    'post' => (int) $p->posts_count > 0,
                    'played' => (bool) $p->getAttribute('played'),
                ],
            ])->all()),
        ];
    }
}

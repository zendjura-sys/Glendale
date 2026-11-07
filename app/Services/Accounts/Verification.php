<?php

namespace App\Services\Accounts;

use App\Models\Post;
use App\Models\User;
use App\Models\VerificationRequest;
use App\Notifications\AccountNotice;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Верифікація 2.0: позначка має вид (особа, автор/стрімер, бізнес, організація), заявку
 * подають лише після базових вимог, рішення приймає команда з причиною. Документ, якщо
 * його додали, лежить на приватному диску й видаляється одразу після рішення.
 */
class Verification
{
    public const KINDS = [
        'identity' => 'Особа',
        'creator' => 'Автор або стрімер',
        'business' => 'Бізнес',
        'organization' => 'Організація',
    ];

    public const MIN_DAYS = 30;

    public const MIN_POSTS = 5;

    /** Після відмови — повторна заявка не раніше ніж за стільки днів. */
    public const COOLDOWN_DAYS = 14;

    /**
     * Які види позначки доступні для типу акаунта.
     *
     * @return list<string>
     */
    public static function kindsFor(string $type): array
    {
        return match ($type) {
            'streamer', 'creator' => ['identity', 'creator'],
            'business' => ['business'],
            'agency', 'team', 'studio', 'media' => ['organization'],
            default => ['identity'],
        };
    }

    /**
     * Базові вимоги перед заявкою.
     *
     * @return list<array{key: string, label: string, ok: bool}>
     */
    public function requirements(User $user): array
    {
        $posts = Post::query()->where('author_id', $user->id)->where('is_draft', false)->count();

        return [
            ['key' => 'email', 'label' => 'Пошта підтверджена', 'ok' => $user->email_verified_at !== null],
            ['key' => 'two_factor', 'label' => 'Увімкнено двоетапний вхід', 'ok' => $user->two_factor_confirmed_at !== null],
            ['key' => 'age', 'label' => 'Акаунту щонайменше '.self::MIN_DAYS.' днів', 'ok' => $user->created_at !== null && $user->created_at->lte(now()->subDays(self::MIN_DAYS))],
            ['key' => 'avatar', 'label' => 'Є власний аватар', 'ok' => $user->avatar_path !== null],
            ['key' => 'posts', 'label' => 'Щонайменше '.self::MIN_POSTS.' записів', 'ok' => $posts >= self::MIN_POSTS],
        ];
    }

    /**
     * @return array{verified: bool, kind: string|null, verified_at: string|null, kinds: array<string, string>, requirements: list<array{key: string, label: string, ok: bool}>, request: array<string, mixed>|null, retry_at: string|null}
     */
    public function state(User $user): array
    {
        $last = VerificationRequest::query()->where('user_id', $user->id)->latest('id')->first();
        $retry = $last?->status === VerificationRequest::REJECTED && $last->decided_at?->addDays(self::COOLDOWN_DAYS)->isFuture()
            ? $last->decided_at->addDays(self::COOLDOWN_DAYS)->toIso8601String() : null;

        return [
            'verified' => $user->is_verified,
            'kind' => $user->verification_kind,
            'verified_at' => $user->verified_at?->toIso8601String(),
            'kinds' => array_intersect_key(self::KINDS, array_flip(self::kindsFor($user->account_type))),
            'requirements' => $this->requirements($user),
            'request' => $last ? [
                'id' => $last->id,
                'kind' => $last->kind,
                'status' => $last->status,
                'reason' => $last->reason,
                'created_at' => $last->created_at->toIso8601String(),
            ] : null,
            'retry_at' => $retry,
        ];
    }

    /**
     * @param  list<string>  $links
     */
    public function apply(User $user, string $kind, array $links, ?string $note, ?UploadedFile $document): VerificationRequest
    {
        if (! in_array($kind, self::kindsFor($user->account_type), true)) {
            throw ValidationException::withMessages(['kind' => 'Цей вид позначки не відповідає типу акаунта.']);
        }
        if ($user->is_verified && $user->verification_kind === $kind) {
            throw ValidationException::withMessages(['kind' => 'Акаунт уже має цю позначку.']);
        }
        $missing = array_filter($this->requirements($user), fn (array $r) => ! $r['ok']);
        if ($missing !== []) {
            throw ValidationException::withMessages(['kind' => 'Спершу виконайте вимоги: '.implode(', ', array_map(fn (array $r) => mb_strtolower($r['label']), $missing)).'.']);
        }
        $last = VerificationRequest::query()->where('user_id', $user->id)->latest('id')->first();
        if ($last !== null && in_array($last->status, [VerificationRequest::PENDING, VerificationRequest::NEEDS_INFO], true)) {
            // Уточнення до тієї ж заявки — замість нової.
            if ($last->status === VerificationRequest::NEEDS_INFO) {
                $this->dropDocument($last);
                $last->update(['kind' => $kind, 'links' => $links, 'note' => $note, 'status' => VerificationRequest::PENDING, 'document_path' => $document?->store('verification', 'local')]);

                return $last;
            }
            throw ValidationException::withMessages(['kind' => 'Заявка вже на розгляді.']);
        }
        if ($last?->status === VerificationRequest::REJECTED && $last->decided_at?->addDays(self::COOLDOWN_DAYS)->isFuture()) {
            throw ValidationException::withMessages(['kind' => 'Повторна заявка — через '.self::COOLDOWN_DAYS.' днів після відмови.']);
        }

        return VerificationRequest::query()->create([
            'user_id' => $user->id,
            'kind' => $kind,
            'links' => $links,
            'note' => $note,
            'document_path' => $document?->store('verification', 'local'),
        ]);
    }

    /** Рішення команди: approve, reject або needs_info (з причиною). */
    public function decide(VerificationRequest $request, User $admin, string $decision, ?string $reason): void
    {
        abort_unless(in_array($request->status, [VerificationRequest::PENDING, VerificationRequest::NEEDS_INFO], true), 422, 'Заявку вже розглянуто.');
        $user = $request->user;
        abort_if($user === null, 404);

        $status = match ($decision) {
            'approve' => VerificationRequest::APPROVED,
            'needs_info' => VerificationRequest::NEEDS_INFO,
            default => VerificationRequest::REJECTED,
        };
        $request->update(['status' => $status, 'reviewer_id' => $admin->id, 'reason' => $reason, 'decided_at' => now()]);
        if ($status !== VerificationRequest::NEEDS_INFO) {
            $this->dropDocument($request);
        }

        if ($status === VerificationRequest::APPROVED) {
            $user->forceFill(['is_verified' => true, 'verification_kind' => $request->kind, 'verified_at' => now()])->save();
        }
        Log::info('admin: verification decided', ['request' => $request->id, 'user' => $user->id, 'decision' => $status, 'by' => $admin->id]);

        [$title, $text] = match ($status) {
            VerificationRequest::APPROVED => ['Профіль верифіковано: '.mb_strtolower(self::KINDS[$request->kind] ?? ''), 'Позначка вже на вашій сторінці.'],
            VerificationRequest::NEEDS_INFO => ['Для верифікації потрібні уточнення', $reason ?? 'Додайте більше підтверджень.'],
            default => ['Заявку на верифікацію відхилено', $reason ?? 'Спробуйте пізніше.'],
        };
        $user->notify(new AccountNotice('verification', null, $title, $text, '/settings/account-type'));
    }

    /** Зняти позначку (з причиною — людина отримає сповіщення). */
    public function revoke(User $user, User $admin, string $reason): void
    {
        $user->forceFill(['is_verified' => false, 'verification_kind' => null, 'verified_at' => null])->save();
        Log::info('admin: verification revoked', ['user' => $user->id, 'by' => $admin->id, 'reason' => $reason]);
        $user->notify(new AccountNotice('verification', null, 'Позначку верифікації знято', $reason, '/settings/account-type'));
    }

    private function dropDocument(VerificationRequest $request): void
    {
        if ($request->document_path !== null) {
            Storage::disk('local')->delete($request->document_path);
            $request->forceFill(['document_path' => null])->save();
        }
    }
}

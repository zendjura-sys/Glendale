<?php

namespace App\Services\Families;

use App\Http\Controllers\Mail\UnsubscribeController;
use App\Mail\FamilyBankDigestMail;
use App\Models\FamilyMember;
use App\Models\FamilyTransaction;
use App\Models\User;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;

/**
 * Особиста тижнева зведення листом: рахунок у банку кожної сім’ї, де людина зараз,
 * і всі операції з ним за тиждень. Лише для учасників сімей; відписка — як від листів про активність.
 */
class PersonalBankDigest
{
    /**
     * Зведення для людини; порожній список — людина не в жодній сім’ї.
     *
     * @return list<array{family: string, slug: string, member: string, balance: int, income: int, spent: int, operations: list<array{date: string, label: string, amount: int, comment: string|null}>}>
     */
    public function build(User $user, ?CarbonImmutable $at = null): array
    {
        ['start' => $start, 'end' => $end] = WeeklyDigest::week($at);
        $members = FamilyMember::query()->with('family')
            ->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->get();

        $out = [];
        foreach ($members as $member) {
            $family = $member->family;
            $operations = FamilyTransaction::query()
                ->where('family_id', $family->id)->where('member_id', $member->id)->where('amount', '!=', 0)
                ->whereBetween('created_at', [$start->utc(), $end->utc()])
                ->orderBy('created_at')->get();

            $out[] = [
                'family' => "[{$family->tag}] {$family->name}",
                'slug' => $family->slug,
                'member' => $member->displayName(),
                'balance' => $member->balance,
                'income' => (int) $operations->where('amount', '>', 0)->sum('amount'),
                'spent' => (int) -$operations->where('amount', '<', 0)->sum('amount'),
                'operations' => array_values($operations->map(fn (FamilyTransaction $t) => [
                    'date' => $t->created_at->setTimezone(ReportService::TIMEZONE)->format('d.m H:i'),
                    'label' => FamilyTransaction::TYPES[$t->type] ?? $t->type,
                    'amount' => $t->amount,
                    'comment' => $t->comment,
                ])->all()),
            ];
        }

        return $out;
    }

    /** Надіслати лист; false — людина не в сім’ї, без пошти або відписалася. */
    public function send(User $user, ?CarbonImmutable $at = null): bool
    {
        $email = trim((string) $user->email);
        if ($user->banned_at !== null || $user->email_social === false || $email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return false;
        }
        $accounts = $this->build($user, $at);
        if ($accounts === []) {
            return false;
        }
        ['start' => $start, 'end' => $end] = WeeklyDigest::week($at);
        Mail::to($email)->queue(new FamilyBankDigestMail(
            accounts: $accounts,
            period: $start->format('d.m').' – '.$end->format('d.m.Y'),
            unsubscribeUrl: UnsubscribeController::url($user),
        ));

        return true;
    }

    /**
     * Розсилка всім учасникам сімей.
     *
     * @return int скільки листів поставлено в чергу
     */
    public function sendAll(?CarbonImmutable $at = null): int
    {
        $sent = 0;
        User::query()->whereIn('id', FamilyMember::query()->where('status', FamilyMember::STATUS_ACTIVE)->select('user_id'))
            ->whereNull('banned_at')->orderBy('id')
            ->chunk(200, function ($users) use (&$sent, $at) {
                foreach ($users as $user) {
                    $sent += $this->send($user, $at) ? 1 : 0;
                }
            });

        return $sent;
    }

    public static function money(int $minor): string
    {
        return Money::format($minor);
    }

    /**
     * Тема листа: з назвою сім’ї, якщо вона одна.
     *
     * @param  list<array{family: string}>  $accounts
     */
    public static function subject(array $accounts): string
    {
        return count($accounts) === 1
            ? 'Ваш рахунок у '.$accounts[0]['family'].' за тиждень'
            : 'Ваші рахунки в сім’ях за тиждень';
    }
}

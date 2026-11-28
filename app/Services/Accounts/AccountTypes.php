<?php

namespace App\Services\Accounts;

use App\Models\AccountLink;
use App\Models\User;
use App\Notifications\AccountNotice;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Спеціальні акаунти: стрімер, автор, бізнес, агенція стрімерів, кіберспортивна команда,
 * ігрова студія, медіа. Кожен тип має свої публічні поля; агенція, команда й студія — склад,
 * у який людина вступає лише за власною згодою.
 */
class AccountTypes
{
    public const MAX_ROSTER = 200;

    /** Тип → назва, іконка Lucide, поля (ключ → назва), чи є склад. */
    public const TYPES = [
        'personal' => ['label' => 'Особистий', 'icon' => 'user-round', 'fields' => [], 'roster' => false],
        'streamer' => ['label' => 'Стрімер', 'icon' => 'radio', 'fields' => ['twitch' => 'Twitch', 'youtube' => 'YouTube', 'kick' => 'Kick', 'email' => 'Пошта для співпраці'], 'roster' => false],
        'creator' => ['label' => 'Автор', 'icon' => 'pen-line', 'fields' => ['niche' => 'Про що пишу', 'email' => 'Пошта для співпраці'], 'roster' => false],
        'business' => ['label' => 'Бізнес', 'icon' => 'store', 'fields' => ['category' => 'Сфера', 'address' => 'Адреса', 'hours' => 'Години роботи', 'phone' => 'Телефон', 'email' => 'Пошта', 'website' => 'Сайт'], 'roster' => false],
        'agency' => ['label' => 'Агенція стрімерів', 'icon' => 'briefcase', 'fields' => ['website' => 'Сайт', 'email' => 'Пошта для співпраці'], 'roster' => true],
        'team' => ['label' => 'Кіберспортивна команда', 'icon' => 'trophy', 'fields' => ['discipline' => 'Дисципліна', 'website' => 'Сайт'], 'roster' => true],
        'studio' => ['label' => 'Ігрова студія', 'icon' => 'gamepad-2', 'fields' => ['games' => 'Наші ігри', 'website' => 'Сайт', 'email' => 'Пошта'], 'roster' => true],
        'media' => ['label' => 'Медіа', 'icon' => 'newspaper', 'fields' => ['website' => 'Сайт', 'email' => 'Пошта редакції'], 'roster' => false],
    ];

    /**
     * Для сторінки людини: тип, поля, склад і де людина сама в складі.
     *
     * @return array{type: string, label: string, icon: string, details: array<string, array{label: string, value: string}>, roster: list<array<string, mixed>>|null, member_of: list<array<string, mixed>>}
     */
    public function card(User $user): array
    {
        $type = self::TYPES[$user->account_type] ?? self::TYPES['personal'];
        $details = [];
        foreach ($type['fields'] as $key => $label) {
            $value = $user->account_details[$key] ?? null;
            if (is_string($value) && $value !== '') {
                $details[$key] = ['label' => $label, 'value' => $value];
            }
        }

        return [
            'type' => array_key_exists($user->account_type, self::TYPES) ? $user->account_type : 'personal',
            'label' => $type['label'],
            'icon' => $type['icon'],
            'details' => $details,
            'roster' => $type['roster'] ? $this->roster($user) : null,
            'member_of' => array_values(AccountLink::query()->with('owner')->where('member_id', $user->id)->where('status', 'active')->get()
                ->filter(fn (AccountLink $link) => $link->owner !== null)
                ->map(fn (AccountLink $link) => [...$link->owner->toCard(), 'role' => $link->role])->all()),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function roster(User $owner, bool $withPending = false): array
    {
        return array_values(AccountLink::query()->with('member')->where('owner_id', $owner->id)
            ->when(! $withPending, fn ($q) => $q->where('status', 'active'))
            ->orderBy('id')->limit(self::MAX_ROSTER)->get()
            ->filter(fn (AccountLink $link) => $link->member !== null)
            ->map(fn (AccountLink $link) => [...$link->member->toCard(), 'link_id' => $link->id, 'role' => $link->role, 'link_status' => $link->status])
            ->all());
    }

    /**
     * Змінити тип і поля. Позначка «бізнес»/«організація» без відповідного типу знімається.
     *
     * @param  array<string, mixed>  $details
     */
    public function set(User $user, string $type, array $details): void
    {
        if (! array_key_exists($type, self::TYPES)) {
            throw ValidationException::withMessages(['type' => 'Невідомий тип акаунта.']);
        }
        $clean = [];
        foreach (self::TYPES[$type]['fields'] as $key => $label) {
            $value = trim((string) ($details[$key] ?? ''));
            if ($value === '') {
                continue;
            }
            if (in_array($key, ['website', 'twitch', 'youtube', 'kick'], true) && ! preg_match('#^https?://#i', $value)) {
                $value = 'https://'.$value;
            }
            if (in_array($key, ['website', 'twitch', 'youtube', 'kick'], true) && filter_var($value, FILTER_VALIDATE_URL) === false) {
                throw ValidationException::withMessages(["details.{$key}" => "«{$label}» — це має бути посилання."]);
            }
            if ($key === 'email' && filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                throw ValidationException::withMessages(["details.{$key}" => 'Вкажіть справжню пошту.']);
            }
            $clean[$key] = mb_substr($value, 0, 160);
        }

        $previous = $user->account_type;
        $user->forceFill(['account_type' => $type, 'account_details' => $clean === [] ? null : $clean]);
        if ($user->is_verified && $user->verification_kind !== null && ! in_array($user->verification_kind, Verification::kindsFor($type), true)) {
            $user->forceFill(['is_verified' => false, 'verification_kind' => null, 'verified_at' => null]);
            Log::info('verification: revoked after type change', ['user' => $user->id, 'from' => $previous, 'to' => $type]);
        }
        $user->save();
        // Склад був лише в агенції, команди чи студії — тепер він не потрібен.
        if (! self::TYPES[$type]['roster']) {
            AccountLink::query()->where('owner_id', $user->id)->delete();
        }
    }

    /** Запросити людину до складу (вона підтверджує в налаштуваннях). */
    public function invite(User $owner, User $member, ?string $role): AccountLink
    {
        if (! (self::TYPES[$owner->account_type]['roster'] ?? false)) {
            throw ValidationException::withMessages(['username' => 'Склад є лише в агенції, команди чи студії.']);
        }
        if ($owner->is($member)) {
            throw ValidationException::withMessages(['username' => 'Себе додавати не треба.']);
        }
        if (AccountLink::query()->where('owner_id', $owner->id)->count() >= self::MAX_ROSTER) {
            throw ValidationException::withMessages(['username' => 'У складі вже '.self::MAX_ROSTER.' людей.']);
        }
        $link = AccountLink::query()->firstOrCreate(
            ['owner_id' => $owner->id, 'member_id' => $member->id],
            ['role' => $role !== null && trim($role) !== '' ? mb_substr(trim($role), 0, 40) : null, 'status' => 'pending'],
        );
        if ($link->wasRecentlyCreated) {
            $member->notify(new AccountNotice('roster_invite', $owner, '«'.$owner->name.'» додає вас до складу ('.self::TYPES[$owner->account_type]['label'].')', 'Підтвердіть у налаштуваннях — інакше на сторінці вас не покажуть.', '/settings/account-type'));
        }

        return $link;
    }

    /** Людина приймає чи відхиляє запрошення (відхилене — зникає). */
    public function answer(User $member, AccountLink $link, bool $accept): void
    {
        abort_unless($link->member_id === $member->id, 403);
        $accept ? $link->update(['status' => 'active']) : $link->delete();
    }

    /** Прибрати зі складу: власник або сама людина. */
    public function remove(User $by, AccountLink $link): void
    {
        abort_unless($link->owner_id === $by->id || $link->member_id === $by->id, 403);
        $link->delete();
    }

    /**
     * Запрошення, що чекають на людину.
     *
     * @return list<array<string, mixed>>
     */
    public function invitations(User $member): array
    {
        return array_values(AccountLink::query()->with('owner')->where('member_id', $member->id)->get()
            ->filter(fn (AccountLink $link) => $link->owner !== null)
            ->map(fn (AccountLink $link) => [...$link->owner->toCard(), 'link_id' => $link->id, 'role' => $link->role, 'link_status' => $link->status, 'owner_type' => self::TYPES[$link->owner->account_type]['label'] ?? null])
            ->all());
    }
}

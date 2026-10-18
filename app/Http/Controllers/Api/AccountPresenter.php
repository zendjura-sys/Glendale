<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Services\Moderation\ContentFilter;
use App\Support\Modules\ModuleManager;
use App\Support\Skins;

class AccountPresenter
{
    /**
     * Повний профіль власника токена.
     *
     * @return array<string, mixed>
     */
    public static function make(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'cover_url' => $user->cover_url,
            'is_online' => $user->is_online,
            'is_verified' => $user->is_verified,
            'status' => $user->status,
            'about' => $user->about,
            'city' => $user->city,
            'birthday' => $user->birthday?->toDateString(),
            'gender' => $user->gender,
            'website' => $user->website,
            'is_private' => $user->is_private,
            'message_privacy' => $user->message_privacy,
            'role' => $user->role,
            'nav_tabs' => app(ModuleManager::class)->navTabsFor($user),
            // Тема, як на сайті: system (як на пристрої), dark («Неоновий синій») або light («Крижана Арктика»).
            'theme' => Skins::theme($user),
            'two_factor' => $user->two_factor_confirmed_at !== null,
            'discord' => filled($user->discord_id),
            'discord_username' => $user->discord_username,
            'google' => filled($user->google_id),
            // Застосунок ховає мат зірочками сам, якщо людина це ввімкнула.
            'profanity_mask' => $user->pref('hide_profanity') ? app(ContentFilter::class)->clientPattern() : null,
        ];
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Services\Moderation\ContentFilter;
use App\Services\Wrapped\YearInReview;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use App\Support\Plugins\Plugins;
use App\Support\Seasons;
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
        $modes = app(NetworkModes::class);

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
            'status' => $user->statusExpired() ? null : $user->status,
            'status_emoji' => $user->statusExpired() ? null : $user->status_emoji,
            'status_until' => $user->statusExpired() ? null : $user->status_until?->toIso8601String(),
            'about' => $user->about,
            'city' => $user->city,
            'birthday' => $user->birthday?->toDateString(),
            'gender' => $user->gender,
            'website' => $user->website,
            'is_private' => $user->is_private,
            'message_privacy' => $user->message_privacy,
            'role' => $user->role,
            // Як на сайті: панель і меню лише з розділів поточного режиму («Геймер», «Класика»…).
            'nav_tabs' => array_values(array_intersect(app(ModuleManager::class)->navTabsFor($user), $modes->modulesFor($user))),
            'modules' => $modes->modulesFor($user),
            'network_mode' => $modes->for($user)['id'],
            // Сезонні прикраси (Новий рік, Хелловін…) — той самий сезон, що бачить людина на сайті.
            'season' => app(Seasons::class)->for($user),
            // Функції-плагіни, які застосунок показує так само, як сайт (напр. пошук GIF у новому записі).
            'plugins' => array_intersect_key($modes->pluginsFor($user), array_flip(['gif_search', 'ideas_board', 'duels', 'tier_lists', 'scheduled_posts', 'author_subscriptions', 'open_polls', 'bio_links', 'community_calendar', 'community_channels', 'community_wiki', 'game_backlog', 'game_deals', 'game_giveaways', 'meme_maker', 'nick_generator', 'pixel_avatar', 'topic_follows', 'account_types'])),
            // Кнопки ШІ в чаті застосунку (ШІ-редактор у полі вводу, «Підсумок від ШІ» в меню бесіди).
            'ai' => array_intersect_key($modes->pluginsFor($user), array_flip(['ai_writer', 'ai_summary'])),
            // Рік «Підсумків року», коли їхній сезон (грудень — січень): банер у стрічці застосунку.
            'wrapped' => app(Plugins::class)->on('wrapped') ? app(YearInReview::class)->season() : null,
            'modes' => array_map(fn (array $mode) => ['id' => $mode['id'], 'name' => $mode['name'], 'description' => $mode['description'], 'icon' => $mode['icon']], $modes->available()),
            // Тема, як на сайті: system (як на пристрої), dark («Неоновий синій») або light («Крижана Арктика»).
            'theme' => Skins::theme($user),
            'two_factor' => $user->two_factor_confirmed_at !== null,
            'discord' => filled($user->discord_id),
            'discord_username' => $user->discord_username,
            'google' => filled($user->google_id),
            // Застосунок ховає мат зірочками сам, якщо людина це ввімкнула.
            'profanity_mask' => $user->pref('hide_profanity') ? app(ContentFilter::class)->clientPattern() : null,
            // «Показувати, що я слухаю»: одне налаштування для сайту й застосунку.
            'show_listening' => $user->showsListening(),
            'morning_digest' => $user->wantsDigest(),
        ];
    }
}

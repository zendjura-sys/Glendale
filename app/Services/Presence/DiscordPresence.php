<?php

namespace App\Services\Presence;

use App\Models\User;
use App\Support\Settings\SiteSettings;

/**
 * Discord Rich Presence → «Граю в…». Бот GameCon бачить активність учасників свого
 * Discord-сервера (Presence Intent); тут розбираємо її й ставимо статус тим, хто прив’язав Discord.
 */
class DiscordPresence
{
    /** Скільки хвилин діє статус; бот підтверджує його, поки людина грає. */
    public const MINUTES = 20;

    /** Активність «Грає» в Discord. */
    private const TYPE_PLAYING = 0;

    /** @var array<string, int> discord_id → user_id */
    private array $linked = [];

    private int $linkedAt = 0;

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly PlayingStatus $status,
    ) {}

    public function token(): ?string
    {
        $value = $this->settings->secret('discord_bot_token') ?? config('services.discord.bot_token');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function guildId(): ?string
    {
        $value = $this->settings->get('discord_guild_id') ?: config('services.discord.guild_id');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function configured(): bool
    {
        return $this->token() !== null;
    }

    /**
     * Одна подія присутності з шлюзу (PRESENCE_UPDATE або елемент presences у GUILD_CREATE).
     *
     * @param  array<string, mixed>  $presence
     * @return bool чи знайшли людину GameCon
     */
    public function handle(array $presence): bool
    {
        $guild = $this->guildId();
        if ($guild !== null && isset($presence['guild_id']) && (string) $presence['guild_id'] !== $guild) {
            return false;
        }
        $discordId = is_array($presence['user'] ?? null) ? (string) ($presence['user']['id'] ?? '') : '';
        $userId = $this->linkedUsers()[$discordId] ?? null;
        if ($userId === null) {
            return false;
        }
        $user = User::query()->find($userId);
        if (! $user instanceof User) {
            return false;
        }

        $activity = null;
        if (($presence['status'] ?? 'online') !== 'offline') {
            foreach (is_array($presence['activities'] ?? null) ? $presence['activities'] : [] as $a) {
                if (is_array($a) && (int) ($a['type'] ?? -1) === self::TYPE_PLAYING && is_string($a['name'] ?? null) && trim($a['name']) !== '') {
                    $activity = $a;
                    break;
                }
            }
        }

        $target = $activity === null ? null : $this->status->fromActivity(
            (string) $activity['name'],
            is_string($activity['details'] ?? null) ? $activity['details'] : null,
            is_string($activity['state'] ?? null) ? $activity['state'] : null,
        );
        $this->status->apply($user, $target, PlayingStatus::SOURCE_DISCORD, self::MINUTES);

        return true;
    }

    /**
     * Хто з GameCon прив’язав Discord (оновлюємо раз на 5 хвилин, щоб не питати базу на кожну подію).
     *
     * @return array<string, int>
     */
    private function linkedUsers(): array
    {
        if ($this->linkedAt < time() - 300) {
            $this->linked = [];
            User::query()->whereNotNull('discord_id')->where('playing_auto', true)->select(['id', 'discord_id'])->cursor()
                ->each(function (User $u) {
                    $this->linked[(string) $u->discord_id] = $u->id;
                });
            $this->linkedAt = time();
        }

        return $this->linked;
    }
}

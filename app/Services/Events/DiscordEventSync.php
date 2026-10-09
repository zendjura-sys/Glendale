<?php

namespace App\Services\Events;

use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Services\Auth\DiscordOAuth;
use App\Services\Presence\DiscordPresence;
use App\Services\Servers\DiscordInvites;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Події серверів із Discord: заплановані події (Scheduled Events) Discord-сервера проєкту
 * потрапляють у календар GameCon, якщо на тому Discord-сервері є бот GameCon.
 * Скасовані й видалені в Discord — прибираються.
 */
class DiscordEventSync
{
    public function __construct(
        private readonly DiscordPresence $bot,
        private readonly DiscordInvites $invites,
        private readonly DiscordOAuth $oauth,
    ) {}

    /** Посилання, щоб адміністрація проєкту додала бота GameCon на свій Discord (лише перегляд каналів і подій). */
    public function botInviteUrl(): ?string
    {
        $clientId = $this->oauth->clientId();
        if (! $this->bot->configured() || $clientId === null || $clientId === '') {
            return null;
        }

        return 'https://discord.com/oauth2/authorize?'.http_build_query(['client_id' => $clientId, 'scope' => 'bot', 'permissions' => 1024]);
    }

    /**
     * @return array{servers: int, events: int}
     */
    public function sync(): array
    {
        $token = $this->bot->token();
        if ($token === null) {
            return ['servers' => 0, 'events' => 0];
        }
        $servers = 0;
        $events = 0;
        GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)->whereNotNull('discord_invite')->orderBy('id')
            ->each(function (GtaServer $server) use ($token, &$servers, &$events) {
                $count = $this->syncServer($server, $token);
                if ($count !== null) {
                    $servers++;
                    $events += $count;
                }
            });

        return ['servers' => $servers, 'events' => $events];
    }

    /**
     * @return int|null скільки подій, або null — бота на цьому Discord немає
     */
    public function syncServer(GtaServer $server, string $token): ?int
    {
        $guild = $server->discord_guild_id;
        if ($guild === null) {
            $code = DiscordInvites::code($server->discord_invite);
            $guild = $code === null ? null : ($this->invites->lookup($code)['guild_id'] ?? null);
            if ($guild === null) {
                return null;
            }
            $server->forceFill(['discord_guild_id' => $guild])->save();
        }
        try {
            $response = Http::timeout(10)->acceptJson()->withHeaders(['Authorization' => 'Bot '.$token])
                ->get(rtrim((string) config('services.discord.api_url', 'https://discord.com/api'), '/').'/v10/guilds/'.$guild.'/scheduled-events', ['with_user_count' => 'true']);
        } catch (Throwable) {
            return null;
        }
        $rows = $response->json();
        if (! $response->successful() || ! is_array($rows)) {
            // 403/404 — бота на цьому Discord-сервері немає.
            return null;
        }
        $seen = [];
        foreach ($rows as $row) {
            // 1 — заплановано, 2 — триває; 3 і 4 — завершено чи скасовано.
            if (! is_array($row) || ! in_array((int) ($row['status'] ?? 0), [1, 2], true) || ! isset($row['id'], $row['name'], $row['scheduled_start_time'])) {
                continue;
            }
            $start = Carbon::parse((string) $row['scheduled_start_time'])->utc();
            $end = isset($row['scheduled_end_time']) ? Carbon::parse((string) $row['scheduled_end_time'])->utc() : null;
            $event = ServerEvent::query()->updateOrCreate(['source' => 'discord', 'external_id' => (string) $row['id']], [
                'gta_server_id' => $server->id,
                'title' => Str::limit(trim((string) $row['name']), 117),
                'type' => 'event',
                'description' => isset($row['description']) && trim((string) $row['description']) !== '' ? Str::limit(trim((string) $row['description']), 997) : null,
                'starts_at' => $start,
                'ends_at' => $end,
                'url' => 'https://discord.com/events/'.$guild.'/'.$row['id'],
                'is_official' => false,
            ]);
            $seen[] = $event->id;
        }
        ServerEvent::query()->where('gta_server_id', $server->id)->where('source', 'discord')
            ->where('starts_at', '>', now())->whereNotIn('id', $seen ?: [0])->delete();
        $server->forceFill(['discord_events_at' => now()])->save();

        return count($seen);
    }
}

<?php

namespace App\Http\Controllers\Bots;

use App\Http\Controllers\Controller;
use App\Models\BotLink;
use App\Models\User;
use App\Services\Bots\BotHub;
use App\Services\Bots\BotRender;
use App\Services\Bots\DiscordApi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Натискання кнопок у Discord (Interactions Endpoint URL). Підпис Ed25519 перевіряємо завжди. */
class DiscordInteractionsController extends Controller
{
    private const EPHEMERAL = 64;

    public function __construct(private readonly DiscordApi $discord, private readonly BotHub $hub) {}

    public function __invoke(Request $request): JsonResponse
    {
        $body = $request->getContent();
        if (! $this->discord->verify((string) $request->header('X-Signature-Ed25519'), (string) $request->header('X-Signature-Timestamp'), $body)) {
            return response()->json(['error' => 'invalid signature'], 401);
        }
        $interaction = json_decode($body, true);
        if (! is_array($interaction)) {
            return response()->json(['error' => 'bad request'], 400);
        }

        // PING від Discord під час збереження адреси в порталі розробника.
        if (($interaction['type'] ?? 0) === 1) {
            return response()->json(['type' => 1]);
        }
        if (($interaction['type'] ?? 0) !== 3) {
            return response()->json(['type' => 4, 'data' => ['content' => 'Користуйтеся кнопками під повідомленнями бота.', 'flags' => self::EPHEMERAL]]);
        }

        $discordId = (string) ($interaction['member']['user']['id'] ?? $interaction['user']['id'] ?? '');
        $user = $discordId !== '' ? User::query()->where('discord_id', $discordId)->first() : null;
        $result = $this->hub->press(BotLink::DISCORD, (string) ($interaction['data']['custom_id'] ?? ''), $user);

        if ($result['card'] !== null && ! $result['personal']) {
            // Оновлюємо спільну картку (лічильник «Йдуть»), а відповідь людині — окремо й лише їй.
            if ($result['toast'] !== null && is_string($interaction['token'] ?? null)) {
                $token = $interaction['token'];
                $toast = $result['toast'];
                dispatch(fn () => app(DiscordApi::class)->followup($token, ['content' => $toast, 'flags' => self::EPHEMERAL]))->afterResponse();
            }

            return response()->json(['type' => 7, 'data' => BotRender::discord($result['card'])]);
        }

        $data = $result['card'] !== null ? BotRender::discord($result['card']) : ['content' => $result['toast'] ?? 'Готово.'];
        if ($result['card'] !== null && $result['toast'] !== null) {
            $data['content'] = $result['toast'];
        }

        return response()->json(['type' => 4, 'data' => [...$data, 'flags' => self::EPHEMERAL]]);
    }
}

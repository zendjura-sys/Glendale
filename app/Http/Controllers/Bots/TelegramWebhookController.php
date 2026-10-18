<?php

namespace App\Http\Controllers\Bots;

use App\Http\Controllers\Controller;
use App\Models\BotLink;
use App\Models\User;
use App\Services\Bots\BotHub;
use App\Services\Bots\BotRender;
use App\Services\Bots\TelegramApi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/** Оновлення від Telegram: прив’язка групи чи акаунта (параметр start) і натискання кнопок. */
class TelegramWebhookController extends Controller
{
    public function __construct(private readonly TelegramApi $telegram, private readonly BotHub $hub) {}

    public function __invoke(Request $request): JsonResponse
    {
        if (! hash_equals($this->telegram->webhookSecret(), (string) $request->header('X-Telegram-Bot-Api-Secret-Token'))) {
            return response()->json(['ok' => false], 403);
        }
        $update = $request->all();

        if (is_array($update['callback_query'] ?? null)) {
            $this->callback($update['callback_query']);
        } elseif (is_array($update['message'] ?? null)) {
            $this->message($update['message']);
        } elseif (is_array($update['my_chat_member'] ?? null)) {
            $status = $update['my_chat_member']['new_chat_member']['status'] ?? null;
            if (in_array($status, ['left', 'kicked'], true)) {
                BotLink::query()->where('platform', BotLink::TELEGRAM)->where('chat_id', (string) ($update['my_chat_member']['chat']['id'] ?? ''))->delete();
            }
        }

        return response()->json(['ok' => true]);
    }

    /**
     * @param  array<string, mixed>  $message
     */
    private function message(array $message): void
    {
        $chat = (array) ($message['chat'] ?? []);
        $chatId = (string) ($chat['id'] ?? '');
        $text = trim((string) ($message['text'] ?? ''));
        $private = ($chat['type'] ?? '') === 'private';
        // /start <код> приходить сам, коли людина відкриває посилання з сайту, — вводити нічого не треба.
        if (preg_match('/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{16,64}))?$/', $text, $m) !== 1) {
            if ($private) {
                $this->say($chatId, $this->welcome());
            }

            return;
        }
        $code = $m[1] ?? null;

        if ($private) {
            $user = $code ? $this->hub->linkTelegramAccount($code, (string) ($message['from']['id'] ?? ''), $message['from']['username'] ?? null) : null;
            $this->say($chatId, $user ? [
                'title' => '✅ Telegram прив’язано',
                'lines' => ["Вітаємо, **{$user->name}**! Тепер кнопки «Піду» й «Не піду» в групах працюють від вашого імені."],
                'buttons' => [[['label' => '🌐 Відкрити GameCon', 'url' => URL::to('/')]]],
            ] : $this->welcome());

            return;
        }

        $link = $code ? $this->hub->linkTelegramGroup($code, $chatId, (string) ($chat['title'] ?? 'Група')) : null;
        if ($link === null) {
            $this->say($chatId, [
                'title' => '⚠️ Посилання застаріло',
                'lines' => ['Відкрийте налаштування групи на GameCon і натисніть «Додати в Telegram» ще раз.'],
            ]);

            return;
        }
        $this->hub->panel($link);
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private function callback(array $query): void
    {
        $data = (string) ($query['data'] ?? '');
        $message = (array) ($query['message'] ?? []);
        $chat = (array) ($message['chat'] ?? []);
        $user = User::query()->where('telegram_id', (string) ($query['from']['id'] ?? ''))->first();
        $result = $this->hub->press(BotLink::TELEGRAM, $data, $user);

        // «Я» в групі — лише спливаюче вікно для того, хто натиснув: баланс і ранг не для всіх.
        if (str_starts_with($data, 'me:') && ($chat['type'] ?? '') !== 'private' && $result['card'] !== null) {
            $card = $result['card'];
            $lines = array_map(fn (array $f) => "{$f[0]}: {$f[1]}", $card['fields'] ?? []);
            $this->telegram->call('answerCallbackQuery', [
                'callback_query_id' => $query['id'],
                'text' => mb_substr(trim($card['title']."\n".implode("\n", $lines ?: $card['lines'] ?? [])), 0, 190),
                'show_alert' => true,
            ]);

            return;
        }

        if ($result['card'] !== null && isset($message['message_id'])) {
            $this->telegram->call('editMessageText', [
                'chat_id' => $chat['id'] ?? null,
                'message_id' => $message['message_id'],
                ...BotRender::telegram($result['card']),
            ]);
        }
        $this->telegram->call('answerCallbackQuery', array_filter([
            'callback_query_id' => $query['id'] ?? null,
            'text' => $result['toast'],
        ]));
    }

    /**
     * @return array<string, mixed>
     */
    private function welcome(): array
    {
        return [
            'title' => '👋 Бот GameCon',
            'lines' => [
                'Я публікую події, нагадування й новини ваших сімей, кланів і спільнот, а кнопки «Піду» записують на подію.',
                'Щоб додати мене в групу, відкрийте налаштування групи на GameCon і натисніть «Додати в Telegram».',
            ],
            'buttons' => [[
                ['label' => '🔗 Прив’язати акаунт', 'url' => URL::to('/settings/account')],
                ['label' => '🌐 GameCon', 'url' => URL::to('/')],
            ]],
        ];
    }

    /**
     * @param  array<string, mixed>  $card
     */
    private function say(string $chatId, array $card): void
    {
        $this->telegram->call('sendMessage', ['chat_id' => $chatId, ...BotRender::telegram($card)]);
    }
}

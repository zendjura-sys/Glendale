<?php

namespace App\Http\Controllers\Bots;

use App\Http\Controllers\Controller;
use App\Models\BotLink;
use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use App\Services\Bots\BotHub;
use App\Services\Bots\DiscordApi;
use App\Services\Bots\TelegramApi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/** Керівник групи підключає ботів GameCon у Telegram і Discord і налаштовує, що вони публікують. */
class BotLinkController extends Controller
{
    public function __construct(
        private readonly BotHub $hub,
        private readonly TelegramApi $telegram,
        private readonly DiscordApi $discord,
    ) {}

    public function state(Request $request, string $type, int $id): JsonResponse
    {
        return response()->json($this->hub->state($this->manage($request, $type, $id)));
    }

    public function telegram(Request $request, string $type, int $id): Response
    {
        $owner = $this->manage($request, $type, $id);
        abort_unless($this->telegram->configured(), 422, 'Бот Telegram ще не налаштований адміністрацією сайту.');

        return Inertia::location((string) $this->telegram->groupLink($this->hub->issueCode($request->user(), BotLink::TELEGRAM, 'group', $owner)));
    }

    public function discord(Request $request, string $type, int $id): Response
    {
        $owner = $this->manage($request, $type, $id);
        abort_unless($this->discord->configured(), 422, 'Бот Discord ще не налаштований адміністрацією сайту.');
        $code = $this->hub->issueCode($request->user(), BotLink::DISCORD, 'group', $owner);

        return Inertia::location((string) $this->discord->inviteUrl($code, route('bots.discord.callback')));
    }

    /** Discord повертає сюди після «Авторизувати»: сервер беремо з обміну коду, не з адреси. */
    public function discordCallback(Request $request): RedirectResponse
    {
        $row = $this->hub->consume((string) $request->query('state', ''), BotLink::DISCORD, 'group');
        abort_unless($row !== null && $row->user_id === $request->user()->id, 403, 'Посилання застаріло — спробуйте ще раз.');
        $owner = $this->hub->owner((string) $row->owner_type, (int) $row->owner_id);
        $guild = is_string($request->query('code')) ? $this->discord->guildFromCode($request->query('code'), route('bots.discord.callback')) : null;
        if ($guild === null) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Discord не підтвердив додавання бота. Спробуйте ще раз.']);

            return redirect($this->hub->settingsUrl($owner));
        }
        $this->hub->linkDiscordGuild($row, $guild);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Бота додано на сервер. Оберіть канал для публікацій.']);

        return redirect($this->hub->settingsUrl($owner));
    }

    public function update(Request $request, BotLink $link): RedirectResponse
    {
        $owner = $this->manage($request, $link->owner_type, $link->owner_id);
        $data = $request->validate([
            'channel_id' => ['nullable', 'string', 'regex:/^\d{15,22}$/'],
            'post_events' => ['boolean'],
            'post_reminders' => ['boolean'],
            'post_posts' => ['boolean'],
            'member_role_id' => ['nullable', 'string', 'regex:/^\d{15,22}$/'],
            'leader_role_id' => ['nullable', 'string', 'regex:/^\d{15,22}$/'],
        ]);
        $fresh = false;
        if ($link->platform === BotLink::DISCORD) {
            if (array_key_exists('channel_id', $data) && $data['channel_id'] !== $link->chat_id) {
                abort_unless($data['channel_id'] === null || in_array($data['channel_id'], array_column($this->discord->channels((string) $link->guild_id), 'id'), true), 422, 'Оберіть канал зі списку.');
                $link->chat_id = $data['channel_id'];
                $fresh = $data['channel_id'] !== null;
            }
            $roles = array_column($this->discord->roles((string) $link->guild_id), 'id');
            foreach (['member_role_id', 'leader_role_id'] as $field) {
                if (array_key_exists($field, $data)) {
                    abort_unless($data[$field] === null || in_array($data[$field], $roles, true), 422, 'Оберіть роль зі списку.');
                    $link->{$field} = $data[$field];
                }
            }
        }
        foreach (['post_events', 'post_reminders', 'post_posts'] as $flag) {
            if (array_key_exists($flag, $data)) {
                $link->{$flag} = (bool) $data[$flag];
            }
        }
        $link->save();
        if ($fresh) {
            $this->hub->panel($link);
        }
        if ($link->hasRoles() && ($link->wasChanged('member_role_id') || $link->wasChanged('leader_role_id'))) {
            $this->hub->syncRoles($link);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $fresh ? 'Канал обрано — бот опублікував панель.' : 'Налаштування бота збережено.']);

        return redirect($this->hub->settingsUrl($owner));
    }

    public function panel(Request $request, BotLink $link): RedirectResponse
    {
        $this->manage($request, $link->owner_type, $link->owner_id);
        $ok = $this->hub->panel($link);
        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => 'Панель із кнопками опубліковано.']
            : ['type' => 'error', 'message' => 'Не вдалося надіслати: перевірте, що бот є в чаті й може писати.']);

        return back();
    }

    public function roles(Request $request, BotLink $link): RedirectResponse
    {
        $this->manage($request, $link->owner_type, $link->owner_id);
        $result = $this->hub->syncRoles($link);
        Inertia::flash('toast', $link->roles_error
            ? ['type' => 'error', 'message' => $link->roles_error]
            : ['type' => 'success', 'message' => "Ролі оновлено: +{$result['added']}, −{$result['removed']}."]);

        return back();
    }

    public function destroy(Request $request, BotLink $link): RedirectResponse
    {
        $this->manage($request, $link->owner_type, $link->owner_id);
        $this->hub->unlink($link);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Бота відключено.']);

        return back();
    }

    public function telegramAccount(Request $request): Response
    {
        abort_unless($this->telegram->configured(), 422, 'Бот Telegram ще не налаштований адміністрацією сайту.');

        return Inertia::location((string) $this->telegram->privateLink($this->hub->issueCode($request->user(), BotLink::TELEGRAM, 'account')));
    }

    public function telegramUnlink(Request $request): RedirectResponse
    {
        $request->user()->forceFill(['telegram_id' => null, 'telegram_username' => null])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Telegram відв’язано.']);

        return back();
    }

    private function manage(Request $request, string $type, int $id): Family|Clan|Community
    {
        $owner = $this->hub->owner($type, $id);
        abort_unless($this->hub->canManage($request->user(), $owner), 403);

        return $owner;
    }
}

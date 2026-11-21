<?php

namespace App\Http\Controllers;

use App\Models\CommunityChannel;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\Antispam\IpBans;
use App\Services\Communities\CommunityChannels;
use App\Services\Messenger;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Бан гостя з гостьового чату: адміни каналу — у своїй спільноті, адміністрація сайту — всюди. */
class GuestBanController extends Controller
{
    public function store(Request $request, Conversation $conversation, Message $message, IpBans $bans, Messenger $messenger): JsonResponse
    {
        app(Plugins::class)->ensure('ip_bans');
        $user = $request->user();
        abort_unless($message->conversation_id === $conversation->id, 404);
        $channel = CommunityChannel::query()->with('community')->where('conversation_id', $conversation->id)->first();
        abort_unless(
            $user->isStaff() || $conversation->participantFor($user)?->canManage()
                || ($channel !== null && app(CommunityChannels::class)->canManage($channel->community, $user)),
            403,
        );
        $data = $request->validate([
            'days' => ['nullable', 'integer', Rule::in([1, 7, 30])],
            'everywhere' => ['nullable', 'boolean'],
            'reason' => ['nullable', 'string', 'max:200'],
            'delete' => ['nullable', 'boolean'],
        ]);
        $everywhere = $user->isStaff() && ($data['everywhere'] ?? false);
        $community = $everywhere ? null : $channel?->community;
        abort_if(! $everywhere && $community === null, 422, 'Гостей можна блокувати лише в гостьовому чаті спільноти.');

        $bans->banGuest($user, $message, $community, $data['reason'] ?? null, isset($data['days']) ? (int) $data['days'] : null);
        if ($data['delete'] ?? true) {
            $messenger->moderatorDelete($message);
        }

        return response()->json(['message' => 'Гостя заблоковано.']);
    }
}

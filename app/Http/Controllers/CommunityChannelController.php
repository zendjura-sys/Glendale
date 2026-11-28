<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Models\CommunityChannelCategory;
use App\Services\ChatCatchUp;
use App\Services\Communities\CommunityChannels;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Канали спільноти: бічна панель із категоріями, текстовий канал (месенджер), «Оголошення»
 * й голосовий канал (голосова кімната). Керують каналами власник і адміністратори спільноти.
 */
class CommunityChannelController extends Controller
{
    public function __construct(
        private readonly CommunityChannels $channels,
        private readonly Messenger $messenger,
        private readonly MessengerPresenter $presenter,
    ) {}

    /** Перший канал, який людина бачить. */
    public function index(Request $request, Community $community): RedirectResponse|Response
    {
        $this->ensure();
        $user = $request->user();
        if (! $community->membershipFor($user)?->isActive() && ! $user->isStaff()) {
            return $this->page($community, null, $request);
        }
        $tree = $this->channels->tree($community, $user);
        $all = array_merge(...array_column($tree['categories'], 'channels'), ...[$tree['uncategorized']]);
        $first = collect($all)->first(fn (array $c) => $c['type'] !== CommunityChannel::VOICE);

        return $first ? redirect("/c/{$community->slug}/channels/{$first['id']}") : $this->page($community, null, $request);
    }

    public function show(Request $request, Community $community, CommunityChannel $channel): Response
    {
        $this->ensure();
        abort_unless($channel->community_id === $community->id, 404);
        $channel->setRelation('community', $community);
        abort_unless($this->channels->canView($channel, $request->user()), 403, 'Цей канал приватний.');

        return $this->page($community, $channel, $request);
    }

    public function store(Request $request, Community $community): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40'],
            'type' => ['required', Rule::in(CommunityChannel::TYPES)],
            'category_id' => ['nullable', 'integer'],
            'topic' => ['nullable', 'string', 'max:200'],
            'is_private' => ['boolean'],
            'members' => ['array', 'max:200'],
            'members.*' => ['integer'],
        ]);
        // Спершу стартові канали, щоб новий не став єдиним і «загальне» не загубилося.
        $this->channels->bootstrap($community);
        $channel = $this->channels->createChannel($community, $data, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Канал створено.']);

        return redirect("/c/{$community->slug}/channels/{$channel->id}");
    }

    public function update(Request $request, Community $community, CommunityChannel $channel): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        abort_unless($channel->community_id === $community->id, 404);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:40'],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'topic' => ['sometimes', 'nullable', 'string', 'max:200'],
            'is_private' => ['sometimes', 'boolean'],
            'members' => ['sometimes', 'array', 'max:200'],
            'members.*' => ['integer'],
        ]);
        $this->channels->updateChannel($channel, $data);

        return back();
    }

    public function destroy(Request $request, Community $community, CommunityChannel $channel): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        abort_unless($channel->community_id === $community->id, 404);
        abort_if($community->channels()->where('type', '!=', CommunityChannel::VOICE)->count() <= 1 && ! $channel->isVoice(), 422, 'У спільноті має лишитися хоча б один текстовий канал.');
        $this->channels->deleteChannel($channel);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Канал видалено.']);

        return redirect("/c/{$community->slug}/channels");
    }

    public function storeCategory(Request $request, Community $community): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        $data = $request->validate(['name' => ['required', 'string', 'max:40']]);
        $this->channels->createCategory($community, $data['name']);

        return back();
    }

    public function updateCategory(Request $request, Community $community, CommunityChannelCategory $category): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        abort_unless($category->community_id === $community->id, 404);
        $data = $request->validate(['name' => ['required', 'string', 'max:40']]);
        $category->update(['name' => trim($data['name'])]);

        return back();
    }

    public function destroyCategory(Request $request, Community $community, CommunityChannelCategory $category): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        abort_unless($category->community_id === $community->id, 404);
        $this->channels->deleteCategory($category);

        return back();
    }

    /** Новий порядок після перетягування: категорії й канали в кожній. */
    public function reorder(Request $request, Community $community): RedirectResponse
    {
        $this->authorizeManage($request, $community);
        $data = $request->validate([
            'categories' => ['present', 'array'],
            'categories.*' => ['integer'],
            'groups' => ['present', 'array'],
            'groups.*.category_id' => ['nullable', 'integer'],
            'groups.*.channels' => ['present', 'array'],
            'groups.*.channels.*' => ['integer'],
        ]);
        $groups = array_values(array_map(fn (array $group) => [
            'category_id' => isset($group['category_id']) ? (int) $group['category_id'] : null,
            'channels' => array_values(array_map('intval', $group['channels'])),
        ], $data['groups']));
        $this->channels->reorder($community, array_values(array_map('intval', $data['categories'])), $groups);

        return back();
    }

    /** Учасники для вибору в приватний канал. */
    public function members(Request $request, Community $community): JsonResponse
    {
        $this->authorizeManage($request, $community);

        return response()->json(['members' => $this->channels->memberOptions($community, trim((string) $request->query('q', '')))]);
    }

    private function page(Community $community, ?CommunityChannel $channel, Request $request): Response
    {
        $user = $request->user();
        $membership = $community->membershipFor($user);
        $joined = (bool) $membership?->isActive() || $user->isStaff();
        $props = [
            'community' => [...$community->toCard(), 'members_count' => $community->members_count],
            'joined' => $joined,
            'can_manage' => $this->channels->canManage($community, $user),
            'tree' => $joined ? $this->channels->tree($community, $user) : ['categories' => [], 'uncategorized' => []],
            'channel' => null,
            'active' => null,
            'history' => null,
        ];
        if ($channel !== null) {
            $channel->loadMissing('voiceRoom.participants.user');
            $props['channel'] = [
                ...$this->channels->card($channel),
                'members' => $channel->is_private ? array_values($channel->members()->get()->map->toCard()->all()) : [],
            ];
            $me = $this->channels->open($channel, $user);
            $conversation = $channel->conversation;
            if ($me !== null && $conversation !== null) {
                $props['active'] = [
                    ...$this->presenter->details($conversation, $user, $me, $this->messenger),
                    'title' => $channel->name,
                    'can_write' => $this->channels->canPost($channel, $user),
                    'locked_text' => $channel->type === CommunityChannel::ANNOUNCEMENT ? 'В оголошеннях пишуть лише адміністратори спільноти.' : null,
                    'catch_up' => app(ChatCatchUp::class)->for($conversation, $user, $me->last_read_message_id),
                ];
                $props['history'] = $this->presenter->history($conversation, viewer: $user);
            }
        }

        return Inertia::render('communities/channels', $props);
    }

    private function authorizeManage(Request $request, Community $community): void
    {
        $this->ensure();
        abort_unless($this->channels->canManage($community, $request->user()), 403);
    }

    private function ensure(): void
    {
        app(Plugins::class)->ensure('community_channels');
    }
}

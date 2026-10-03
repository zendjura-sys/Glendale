<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\User;
use App\Models\VoiceParticipant;
use App\Models\VoiceRoom;
use App\Services\CommunityService;
use App\Services\Families\FamilyService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VoiceRoomsTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-livekit-secret-0123456789';

    private Family $family;

    private User $leader;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();

        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $this->leader = User::factory()->create();
        $this->family = app(FamilyService::class)->create($this->leader, [
            'server_id' => $server->id,
            'name' => 'Scaletta Family',
            'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '10001',
        ]);
    }

    private function configure(): void
    {
        $settings = app(SiteSettings::class);
        $settings->put(['livekit_url' => 'wss://voice.gamecon.test', 'livekit_api_key' => 'APIgamecon']);
        $settings->putSecret('livekit_api_secret', self::SECRET);
    }

    private function member(int $rank = 1): User
    {
        $user = User::factory()->create();
        $this->family->members()->create([
            'user_id' => $user->id,
            'rp_nickname' => 'Tony_Moretti',
            'static_id' => '20002',
            'rank' => $rank,
            'status' => FamilyMember::STATUS_ACTIVE,
            'joined_at' => now(),
        ]);

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function claims(string $jwt): array
    {
        $parts = explode('.', $jwt);

        return json_decode((string) base64_decode(strtr($parts[1], '-_', '+/')), true);
    }

    private function signedWebhook(array $event, string $secret = self::SECRET): \Illuminate\Testing\TestResponse
    {
        $body = (string) json_encode($event);
        $b64 = fn (string $v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');
        $head = $b64((string) json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $claims = $b64((string) json_encode(['iss' => 'APIgamecon', 'exp' => time() + 60, 'sha256' => base64_encode(hash('sha256', $body, true))]));
        $jwt = $head.'.'.$claims.'.'.$b64(hash_hmac('sha256', $head.'.'.$claims, $secret, true));

        return $this->call('POST', '/api/livekit/webhook', [], [], [], ['HTTP_AUTHORIZATION' => $jwt, 'CONTENT_TYPE' => 'application/webhook+json'], $body);
    }

    public function test_family_member_sees_default_room_and_outsider_is_refused(): void
    {
        $member = $this->member();

        $this->actingAs($member)->getJson(route('voice.index', ['family', $this->family->id]))
            ->assertOk()
            ->assertJsonPath('enabled', false)
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('rooms.0.name', 'Загальна');

        $this->actingAs(User::factory()->create())->getJson(route('voice.index', ['family', $this->family->id]))->assertForbidden();
    }

    public function test_join_issues_a_livekit_token_only_when_configured(): void
    {
        $member = $this->member();
        $room = VoiceRoom::query()->create(['owner_type' => 'family', 'owner_id' => $this->family->id, 'name' => 'Штаб']);

        $this->actingAs($member)->postJson(route('voice.join', $room))->assertStatus(503);

        $this->configure();
        $response = $this->actingAs($member)->postJson(route('voice.join', $room))
            ->assertOk()
            ->assertJsonPath('url', 'wss://voice.gamecon.test')
            ->assertJsonPath('room', 'gc-'.$room->id);

        $claims = $this->claims($response->json('token'));
        $this->assertSame('APIgamecon', $claims['iss']);
        $this->assertSame('u'.$member->id, $claims['sub']);
        $this->assertSame('Tony_Moretti [20002]', $claims['name']);
        $this->assertSame('gc-'.$room->id, $claims['video']['room']);
        $this->assertTrue($claims['video']['canPublish']);

        $this->actingAs(User::factory()->create())->postJson(route('voice.join', $room))->assertForbidden();
    }

    public function test_only_ranks_with_voice_permission_manage_rooms(): void
    {
        $recruit = $this->member(1);
        $officer = $this->member(7);

        $this->actingAs($recruit)->postJson(route('voice.store', ['family', $this->family->id]), ['name' => 'Рейд'])->assertForbidden();

        $this->actingAs($officer)->postJson(route('voice.store', ['family', $this->family->id]), ['name' => 'Рейд'])
            ->assertCreated()
            ->assertJsonPath('can_manage', true)
            ->assertJsonCount(2, 'rooms');

        $room = VoiceRoom::query()->where('name', 'Рейд')->sole();
        $this->actingAs($this->leader)->patchJson(route('voice.update', $room), ['name' => 'Рейд 2'])->assertOk();
        $this->assertSame('Рейд 2', $room->fresh()->name);
    }

    public function test_webhook_tracks_who_is_in_the_room_and_rejects_forged_calls(): void
    {
        $this->configure();
        $member = $this->member();
        $first = VoiceRoom::query()->create(['owner_type' => 'family', 'owner_id' => $this->family->id, 'name' => 'Загальна']);
        $second = VoiceRoom::query()->create(['owner_type' => 'family', 'owner_id' => $this->family->id, 'name' => 'Штаб']);

        $joined = ['event' => 'participant_joined', 'room' => ['name' => 'gc-'.$first->id], 'participant' => ['identity' => 'u'.$member->id]];
        $this->signedWebhook($joined, 'wrong-secret-0123456789')->assertUnauthorized();
        $this->assertSame(0, VoiceParticipant::query()->count());

        $this->signedWebhook($joined)->assertOk();
        $this->actingAs($member)->getJson(route('voice.index', ['family', $this->family->id]))
            ->assertJsonPath('rooms.0.participants.0.id', $member->id)
            ->assertJsonPath('rooms.0.participants.0.name', 'Tony_Moretti [20002]');

        // Перейшов в іншу кімнату — у попередній його більше немає.
        $this->signedWebhook(['event' => 'participant_joined', 'room' => ['name' => 'gc-'.$second->id], 'participant' => ['identity' => 'u'.$member->id]])->assertOk();
        $this->assertSame([$second->id], VoiceParticipant::query()->pluck('voice_room_id')->all());

        $this->signedWebhook(['event' => 'participant_left', 'room' => ['name' => 'gc-'.$second->id], 'participant' => ['identity' => 'u'.$member->id]])->assertOk();
        $this->assertSame(0, VoiceParticipant::query()->count());
    }

    public function test_moderator_mutes_through_livekit(): void
    {
        $this->configure();
        Http::fake(['voice.gamecon.test/twirp/*' => Http::response([], 200)]);
        $member = $this->member();
        $room = VoiceRoom::query()->create(['owner_type' => 'family', 'owner_id' => $this->family->id, 'name' => 'Загальна']);
        VoiceParticipant::query()->create(['voice_room_id' => $room->id, 'user_id' => $member->id, 'joined_at' => now()]);

        $this->actingAs($member)->postJson(route('voice.moderate', [$room, $member->id]), ['action' => 'mute'])->assertForbidden();
        $this->actingAs($this->leader)->postJson(route('voice.moderate', [$room, $member->id]), ['action' => 'mute'])
            ->assertOk()
            ->assertJsonPath('rooms.0.participants.0.muted', true);

        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/twirp/livekit.RoomService/UpdateParticipant')
            && $request['identity'] === 'u'.$member->id
            && $request['permission']['canPublish'] === false);

        $claims = $this->claims($this->actingAs($member)->postJson(route('voice.join', $room))->json('token'));
        $this->assertFalse($claims['video']['canPublish']);
    }

    public function test_community_members_use_their_own_rooms(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'Кіберспорт UA',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN,
            'category' => 'esports',
        ]);

        $this->actingAs($owner)->getJson(route('voice.index', ['community', $community->id]))
            ->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('owner.type', 'community');

        $this->actingAs(User::factory()->create())->getJson(route('voice.index', ['community', $community->id]))->assertForbidden();
    }
}

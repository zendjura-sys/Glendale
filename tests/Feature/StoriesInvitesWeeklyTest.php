<?php

namespace Tests\Feature;

use App\Mail\SocialActivityMail;
use App\Models\Follow;
use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\Story;
use App\Models\User;
use App\Services\Families\FamilyService;
use App\Services\Stories;
use App\Services\WeeklyLetter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class StoriesInvitesWeeklyTest extends TestCase
{
    use RefreshDatabase;

    public function test_close_stories_invites_and_the_weekly_letter(): void
    {
        [$author, $close, $other] = User::factory()->count(3)->create();
        $this->actingAs($author)->post(route('friends.store', $close));
        $this->actingAs($close)->post(route('friends.accept', $author));
        $this->actingAs($author)->post(route('friends.store', $other));
        $this->actingAs($other)->post(route('friends.accept', $author));
        $this->actingAs($author)->put(route('appearance.update'), [
            'palette' => 'aurora',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'looking_for_group' => false,
            'close_friends' => [$close->id, 999],
        ])->assertRedirect();
        $this->assertSame([$close->id], $author->fresh()->pref('close_friends'));

        $story = Story::query()->create([
            'user_id' => $author->id,
            'media_type' => 'image',
            'path' => 'stories/test.jpg',
            'width' => 10,
            'height' => 10,
            'duration' => 6,
            'privacy' => Story::PRIVACY_CLOSE,
            'expires_at' => now()->addHour(),
        ]);
        $stories = app(Stories::class);
        $this->assertTrue($stories->canView($story, $close));
        $this->assertFalse($stories->canView($story, $other));

        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $leader = User::factory()->create();
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id,
            'name' => 'Scaletta Family',
            'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '10001',
        ]);
        app(FamilyService::class)->setStatus($family, User::factory()->admin()->create(), 'verified', null);
        $this->actingAs($leader)->post(route('friends.store', $close));
        $this->actingAs($close)->post(route('friends.accept', $leader));
        $this->actingAs($leader)->post(route('servers.invite', $server), [
            'kind' => 'family',
            'id' => $family->id,
            'username' => $close->username,
        ])->assertRedirect();
        $this->assertTrue($close->fresh()->notifications->contains(fn ($note) => ($note->data['kind'] ?? null) === 'group_invite'));

        $game = Game::query()->create([
            'slug' => 'nova-drift', 'name' => 'Nova Drift', 'letter' => 'N', 'category' => 'pc', 'is_published' => true,
        ]);
        $event = GameEvent::query()->create([
            'title' => 'Nova Night', 'type' => 'event', 'starts_at' => now()->addDay(), 'source' => 'manual',
        ]);
        $event->games()->attach($game->id);
        ServerEvent::query()->create([
            'gta_server_id' => $server->id,
            'title' => 'Raid Night',
            'type' => 'raid',
            'starts_at' => now()->addDays(2),
            'source' => 'manual',
        ]);
        $reader = User::factory()->create(['email_social' => true]);
        Follow::query()->create(['user_id' => $reader->id, 'kind' => 'game', 'subject_id' => $game->id]);
        Follow::query()->create(['user_id' => $reader->id, 'kind' => 'server', 'subject_id' => $server->id]);

        Mail::fake();
        $this->assertSame(1, app(WeeklyLetter::class)->sendAll());
        Mail::assertQueued(SocialActivityMail::class);
    }
}

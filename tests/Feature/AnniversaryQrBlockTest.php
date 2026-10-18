<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AnniversaryQrBlockTest extends TestCase
{
    use RefreshDatabase;

    public function test_anniversary_profile_card_and_block(): void
    {
        $owner = User::factory()->create(['username' => 'olena', 'first_name' => 'Олена', 'last_name' => 'Коваль']);
        $viewer = User::factory()->create(['username' => 'taras']);
        $friendships = app(FriendshipService::class);
        $friendships->request($viewer, $owner);
        $friendships->accept($owner, $viewer);
        $friendships->between($owner, $viewer)?->forceFill(['accepted_at' => now()->subYears(2)])->save();

        $this->actingAs($owner)->post(route('posts.store'), [
            'body' => 'Таємниця рейду',
            'visibility' => 'public',
        ])->assertRedirect();

        $this->withoutVite()->actingAs($viewer)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('anniversary', true)
                ->where('anniversaryYears', 2)
                ->where('canSeeContent', true)
                ->where('canMessage', true));

        $this->withoutVite()->get(route('profile.card', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('profile.username', 'olena')
                ->where('qr', fn ($qr) => is_string($qr) && str_contains($qr, '<svg')));

        $this->withoutVite()->actingAs($viewer)->get(route('feed', ['tab' => 'friends']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data.0.body', 'Таємниця рейду'));

        $this->actingAs($owner)->post(route('blocks.toggle', $owner))->assertStatus(422);
        $this->actingAs($owner)->post(route('blocks.toggle', $viewer))->assertRedirect();
        $this->assertSame(FriendshipService::FRIENDS, $friendships->status($owner, $viewer));

        $this->withoutVite()->actingAs($viewer)->get(route('feed', ['tab' => 'friends']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', []));
        $this->assertNull(Post::query()->visibleTo($viewer, [$owner->id])->where('body', 'Таємниця рейду')->first());

        $this->withoutVite()->actingAs($viewer)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('limited', true)
                ->where('canSeeContent', false)
                ->where('canMessage', false));

        $admin = User::factory()->admin()->create();
        $this->assertNotNull(Post::query()->visibleTo($admin, [])->where('body', 'Таємниця рейду')->first());

        $this->actingAs($owner)->post(route('blocks.toggle', $viewer))->assertRedirect();
        $this->withoutVite()->actingAs($viewer)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('limited', false)->where('canSeeContent', true));
    }
}

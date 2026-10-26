<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ProfileVisit;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProfileVisitorsOrderBirthdayTest extends TestCase
{
    use RefreshDatabase;

    public function test_visitors_block_order_and_birthday_chat(): void
    {
        $owner = User::factory()->create([
            'username' => 'olena',
            'birthday' => now()->toDateString(),
        ]);
        $viewer = User::factory()->create(['username' => 'taras', 'birthday' => now()->subDays(3)->toDateString()]);
        $friendships = app(FriendshipService::class);
        $friendships->request($viewer, $owner);
        $friendships->accept($owner, $viewer);
        $this->withoutVite();

        $this->actingAs($viewer)->get(route('profile.show', $owner))->assertOk();
        $this->assertSame(0, ProfileVisit::query()->count());

        $this->actingAs($owner)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('showVisitors', false)
                ->where('visitors', [])
                ->where('birthdayToday', true)
                ->where('blockOrder.0', 'platforms'));

        $this->actingAs($owner)->put(route('appearance.update'), $this->appearance([
            'show_visitors' => true,
            'profile_blocks' => ['photos', 'friends', 'nope'],
        ]))->assertRedirect();

        $owner->refresh();
        $this->assertTrue($owner->pref('show_visitors'));
        $this->assertSame(
            ['photos', 'friends', 'platforms', 'steam', 'games', 'about', 'achievements', 'audio', 'characters'],
            $owner->pref('profile_blocks'),
        );

        $this->actingAs($owner)->put(route('appearance.update'), $this->appearance())->assertRedirect();
        $owner->refresh();
        $this->assertTrue($owner->pref('show_visitors'));
        $this->assertSame('photos', $owner->pref('profile_blocks')[0]);

        $this->actingAs($viewer)->get(route('profile.show', $owner))->assertOk();
        $this->actingAs($viewer)->get(route('profile.show', $owner))->assertOk();
        $this->assertSame(1, ProfileVisit::query()->count());

        $this->actingAs($viewer)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('showVisitors', false)
                ->where('visitors', [])
                ->where('birthdayToday', true)
                ->where('blockOrder.0', 'photos'));

        $this->actingAs($owner)->get(route('profile.show', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('showVisitors', true)
                ->where('visitors.0.username', 'taras')
                ->where('blockOrder.0', 'photos'));

        $this->actingAs($owner)->get(route('profile.show', $viewer))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('birthdayToday', false));

        $this->actingAs($viewer)
            ->get(route('messages.direct', ['user' => $owner, 'text' => 'З днем народження!']))
            ->assertRedirect();

        $this->actingAs($viewer)
            ->get(route('messages.show', [
                'conversation' => Conversation::query()->firstOrFail(),
                'text' => 'З днем народження!',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('draft', 'З днем народження!'));

        $long = str_repeat('а', 140);
        $this->actingAs($viewer)
            ->get(route('messages.show', [
                'conversation' => Conversation::query()->firstOrFail(),
                'text' => $long,
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('draft', mb_substr($long, 0, 120)));
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function appearance(array $extra = []): array
    {
        return [
            'palette' => 'ocean',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'languages' => [],
            'looking_for_group' => false,
            ...$extra,
        ];
    }
}

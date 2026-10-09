<?php

namespace Tests\Feature;

use App\Models\FriendMark;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FriendMarksTest extends TestCase
{
    use RefreshDatabase;

    public function test_private_list_nickname_and_note(): void
    {
        $owner = User::factory()->create(['username' => 'taras']);
        $friend = User::factory()->create([
            'username' => 'marta',
            'first_name' => 'Марта',
            'last_name' => 'Коваль',
        ]);
        $stranger = User::factory()->create();
        $friendships = app(FriendshipService::class);
        $friendships->request($owner, $friend);
        $friendships->accept($friend, $owner);

        $this->actingAs($stranger)->put(route('friends.mark', $friend), [
            'nickname' => 'Чужа',
        ])->assertForbidden();

        $this->actingAs($owner)->put(route('friends.mark', $friend), [
            'list' => 'raid',
            'nickname' => 'Капітан',
            'note' => 'Бере танк',
        ])->assertRedirect();

        $this->withoutVite()->actingAs($owner)->get(route('friends.index', ['tab' => 'raid']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('users.data.0.alias', 'Капітан')
                ->where('users.data.0.note', 'Бере танк')
                ->where('users.data.0.list', 'raid')
                ->where('counts.raid', 1));

        $this->withoutVite()->actingAs($owner)->get(route('friends.index', ['tab' => 'cinema']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('users.data', []));

        $this->withoutVite()->actingAs($owner)->get(route('friends.index', ['q' => 'Капітан']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('users.data.0.username', 'marta'));

        $this->withoutVite()->actingAs($friend)->get(route('friends.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('users.data.0.alias', null));

        $this->withoutVite()->actingAs($owner)->get(route('profile.show', $friend))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('profile.alias', 'Капітан')
                ->where('profile.note', 'Бере танк'));

        $this->withoutVite()->actingAs($friend)->get(route('profile.show', $friend))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('profile.alias', null));

        $this->actingAs($owner)->put(route('friends.mark', $friend), [
            'list' => null,
            'nickname' => '',
            'note' => '',
        ])->assertRedirect();
        $this->assertSame(0, FriendMark::query()->count());

        $this->actingAs($owner)->put(route('friends.mark', $friend), [
            'list' => 'work',
            'nickname' => 'Колега',
            'note' => 'Зміна ввечері',
        ])->assertRedirect();
        $this->actingAs($owner)->delete(route('friends.destroy', $friend))->assertRedirect();
        $this->assertSame(0, FriendMark::query()->count());
        $this->actingAs($owner)->put(route('friends.mark', $friend), [
            'nickname' => 'Знову',
        ])->assertForbidden();
    }
}

<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\Accounts\AccountSwitcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BioLinksSwitcherTopicsTest extends TestCase
{
    use RefreshDatabase;

    public function test_bio_links_page_is_public_and_counts_clicks(): void
    {
        $user = User::factory()->create(['username' => 'neo']);
        $this->get('/l/neo')->assertNotFound();
        $this->actingAs($user)->put('/settings/links', ['links' => [['title' => 'Twitch', 'url' => 'javascript:alert(1)']]])->assertSessionHasErrors();
        $this->actingAs($user)->put('/settings/links', ['links' => [['title' => 'Twitch', 'url' => 'https://twitch.tv/neo'], ['title' => 'YouTube', 'url' => 'https://youtube.com/@neo']]])->assertSessionHasNoErrors();

        auth()->logout();
        $this->get('/l/neo')->assertInertia(fn (Assert $page) => $page->component('links/show')->where('links.0.title', 'Twitch')->where('links.1.host', 'youtube.com'));
        $this->get('/l/neo/go/0')->assertRedirect('https://twitch.tv/neo');
        $this->get('/l/neo/go/9')->assertNotFound();

        $this->actingAs($user->fresh())->get('/settings/links')->assertInertia(fn (Assert $page) => $page->where('links.0.clicks', 1));
    }

    public function test_switcher_remembers_accounts_and_switches_only_with_valid_token(): void
    {
        $main = User::factory()->create();
        $second = User::factory()->create(['email' => 'second@example.test', 'password' => 'secret-pass-123']);

        // «Додати акаунт»: поточний запамʼятовано, вихід і звичайний вхід другим.
        $response = $this->actingAs($main)->post('/account/switcher/add')->assertRedirect('/login');
        $cookie = $response->getCookie(AccountSwitcher::COOKIE);
        $this->assertNotNull($cookie);
        $this->assertGuest();

        $login = $this->withCookie(AccountSwitcher::COOKIE, $cookie->getValue())
            ->post('/login', ['email' => 'second@example.test', 'password' => 'secret-pass-123']);
        $this->assertAuthenticatedAs($second);
        $pairs = json_decode((string) $login->getCookie(AccountSwitcher::COOKIE)?->getValue(), true);
        $this->assertEqualsCanonicalizing([$main->id, $second->id], array_keys($pairs));
        $this->assertSame(2, DB::table('device_account_tokens')->count());

        $this->withCredentials()->withCookie(AccountSwitcher::COOKIE, (string) json_encode($pairs))->getJson('/account/switcher')->assertOk()->assertJsonCount(2, 'accounts');
        $this->withCookie(AccountSwitcher::COOKIE, (string) json_encode($pairs))->post("/account/switcher/{$main->id}")->assertRedirect();
        $this->assertAuthenticatedAs($main);

        // Підроблений токен — відмова.
        $this->withCookie(AccountSwitcher::COOKIE, (string) json_encode([$second->id => str_repeat('x', 40)]))->post("/account/switcher/{$second->id}")->assertForbidden();
    }

    public function test_topics_follow_and_feed_tab(): void
    {
        $user = User::factory()->create();
        $author = User::factory()->create();
        Post::query()->create(['author_id' => $author->id, 'wall_type' => $author->getMorphClass(), 'wall_id' => $author->id, 'body' => 'Новий патч! #speedrun', 'visibility' => 'public']);
        Post::query()->create(['author_id' => $author->id, 'wall_type' => $author->getMorphClass(), 'wall_id' => $author->id, 'body' => 'Просто запис', 'visibility' => 'public']);

        $this->actingAs($user)->postJson('/t/%23SpeedRun/follow')->assertOk()->assertJsonPath('following', true)->assertJsonPath('topics', ['speedrun']);
        $this->actingAs($user)->get('/t/speedrun')->assertInertia(fn (Assert $page) => $page->where('following', true)->has('posts.data', 1));
        $this->actingAs($user)->get('/feed?tab=topics')->assertInertia(fn (Assert $page) => $page->where('tab', 'topics')->has('posts.data', 1)->where('posts.data.0.body', 'Новий патч! #speedrun'));
        $this->actingAs($user)->postJson('/t/speedrun/follow')->assertJsonPath('following', false);
        $this->actingAs($user)->postJson('/t/'.urlencode('bad tag!').'/follow')->assertStatus(422);
    }
}

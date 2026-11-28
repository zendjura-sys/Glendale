<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Post;
use App\Models\PostSeries;
use App\Models\User;
use App\Services\Messenger;
use App\Support\TeenMode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PostSeriesTeenModeTest extends TestCase
{
    use RefreshDatabase;

    public function test_author_builds_series_and_readers_see_parts(): void
    {
        $author = User::factory()->create();
        $reader = User::factory()->create();
        $first = Post::factory()->create(['author_id' => $author->id, 'wall_id' => $author->id]);
        $second = Post::factory()->create(['author_id' => $author->id, 'wall_id' => $author->id]);

        $id = $this->actingAs($author)->postJson('/series', ['title' => 'Гайд по CS2'])->assertOk()->json('series.id');
        $this->actingAs($author)->post("/posts/{$first->id}/series", ['series_id' => $id])->assertRedirect();
        $this->actingAs($author)->post("/posts/{$second->id}/series", ['series_id' => $id])->assertRedirect();
        $this->assertSame([1, 2], Post::query()->where('series_id', $id)->orderBy('id')->pluck('series_position')->all());

        // Чужий запис чи чужа серія — не можна.
        $this->actingAs($reader)->post("/posts/{$first->id}/series", ['series_id' => $id])->assertForbidden();
        $own = Post::factory()->create(['author_id' => $reader->id, 'wall_id' => $reader->id]);
        $this->actingAs($reader)->post("/posts/{$own->id}/series", ['series_id' => $id])->assertSessionHasErrors('series_id');

        $this->actingAs($reader)->get("/series/{$id}")->assertInertia(fn (Assert $page) => $page
            ->component('series/show')
            ->where('series.title', 'Гайд по CS2')
            ->where('series.mine', false)
            ->has('posts', 2)
            ->where('posts.1.series.position', 2)
            ->where('posts.1.series.count', 2)
            ->where('posts.0.can.series', false));
        $this->actingAs($author)->getJson('/series/mine')->assertJsonPath('series.0.count', 2);

        // Прибрати із серії; видалення серії лишає записи.
        $this->actingAs($author)->post("/posts/{$second->id}/series", ['series_id' => null])->assertRedirect();
        $this->assertNull($second->fresh()->series_id);
        $this->actingAs($author)->delete("/series/{$id}")->assertRedirect();
        $this->assertNull(PostSeries::query()->find($id));
        $this->assertNull($first->fresh()->series_id);
        $this->assertNotNull($first->fresh());
    }

    public function test_teen_mode_protects_minors(): void
    {
        $teen = User::factory()->create(['birthday' => now()->subYears(15), 'first_name' => 'Тарас', 'message_privacy' => User::MESSAGES_EVERYONE]);
        $adult = User::factory()->create(['birthday' => now()->subYears(30)]);
        $friend = User::factory()->create(['birthday' => now()->subYears(16)]);
        Friendship::query()->create(['requester_id' => $teen->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);

        $this->assertTrue(TeenMode::locked($teen));
        $messenger = app(Messenger::class);
        $this->assertFalse($messenger->canMessage($adult, $teen));
        $this->assertTrue($messenger->canMessage($friend, $teen));
        $this->assertTrue($messenger->canMessage($teen, $adult));

        // Незнайомий дорослий не знаходить підлітка в пошуку людей; підліток — знаходить.
        $this->actingAs($adult)->get('/people?q=Тарас')->assertInertia(fn (Assert $page) => $page->where('total', 0));
        $this->actingAs($friend)->get('/people?q=Тарас')->assertInertia(fn (Assert $page) => $page->where('total', 1));

        // До 18 вимкнути не можна; мат приховано.
        $this->actingAs($teen)->put('/settings/account/teen-mode', ['on' => false])->assertRedirect();
        $this->assertTrue(TeenMode::on($teen->fresh()));
        $this->actingAs($teen)->get('/settings/account')->assertInertia(fn (Assert $page) => $page
            ->where('teenMode', ['on' => true, 'locked' => true])
            ->whereNot('auth.user.profanity_mask', null));

        // Дорослий вмикає режим сам — і зникає з пошуку для інших дорослих.
        $this->actingAs($adult)->put('/settings/account/teen-mode', ['on' => true])->assertRedirect();
        $this->assertTrue(TeenMode::on($adult->fresh()));
        $other = User::factory()->create(['birthday' => now()->subYears(25)]);
        $this->actingAs($other)->get('/people?q='.urlencode($adult->first_name))->assertInertia(fn (Assert $page) => $page->where('total', 0));
        $this->actingAs($adult)->put('/settings/account/teen-mode', ['on' => false])->assertRedirect();
        $this->assertFalse(TeenMode::on($adult->fresh()));
    }
}

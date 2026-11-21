<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** №271: оцінки й коментарі до серій; коментарі ще не переглянутої серії приховано. */
class EpisodeTalkTest extends TestCase
{
    use RefreshDatabase;

    public function test_episode_ratings_and_spoiler_free_comments(): void
    {
        [$fan, $newbie, $staff] = [User::factory()->create(), User::factory()->create(), User::factory()->create(['role' => User::ROLE_ADMIN])];
        $movie = Movie::query()->create(['slug' => 'arcane', 'type' => 'series', 'title' => 'Аркейн', 'is_published' => true, 'episodes_count' => 9]);
        $base = '/cinema/arcane/episodes/1/3';

        $this->actingAs($fan)->postJson("{$base}/rate", ['score' => 6])->assertStatus(422);
        $this->actingAs($fan)->postJson("{$base}/rate", ['score' => 5])->assertOk()->assertJsonPath('mine', 5);
        $this->actingAs($newbie)->postJson("{$base}/rate", ['score' => 4])->assertOk()->assertJsonPath('avg', 4.5)->assertJsonPath('votes', 2);
        $this->actingAs($fan)->postJson("{$base}/comments", ['body' => 'Фінал серії — розрив!'])->assertOk()->assertJsonPath('count', 1);

        // Ще не бачив серію — лише кількість, без текстів.
        $this->actingAs($newbie)->getJson("{$base}/talk")->assertOk()
            ->assertJsonPath('seen', false)->assertJsonPath('count', 1)->assertJsonPath('comments', null);
        // Сам відкрив — бачить.
        $this->actingAs($newbie)->getJson("{$base}/talk?reveal=1")->assertJsonPath('comments.0.body', 'Фінал серії — розрив!');
        // Відмітив серію переглянутою — відкрито й без reveal.
        $this->actingAs($newbie)->postJson('/cinema/arcane/episodes', ['season' => 1, 'episode' => 3])->assertOk();
        $talk = $this->actingAs($newbie)->getJson("{$base}/talk")->assertJsonPath('seen', true)->json();
        $this->assertFalse($talk['comments'][0]['mine']);

        $id = $talk['comments'][0]['id'];
        $this->actingAs($newbie)->deleteJson("{$base}/comments/{$id}")->assertForbidden();
        $this->actingAs($staff)->deleteJson("{$base}/comments/{$id}")->assertOk()->assertJsonPath('count', 0);

        // Інша серія — свої оцінки.
        $this->actingAs($fan)->getJson('/cinema/arcane/episodes/1/4/talk')->assertJsonPath('votes', 0);
        $token = app(ApiTokens::class)->issue($fan, 'android');
        $this->withToken($token)->getJson("/api/v1/site{$base}/talk")->assertOk()->assertJsonPath('mine', 5);
    }
}

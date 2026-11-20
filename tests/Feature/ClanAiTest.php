<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Services\Clans\ClanService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** ШІ-помічник кланів і гільдій: чернетка статуту й назв рангів лише для керівництва, нічого не зберігає. */
class ClanAiTest extends TestCase
{
    use RefreshDatabase;

    public function test_leader_gets_rules_and_ranks_drafts(): void
    {
        app(SiteSettings::class)->putSecret('ai_key', 'sk-ant-test-key');
        $replies = [
            json_encode(['text' => "# Статут гільдії\n1. Допомагай своїм."]),
            json_encode(['ranks' => ['Учень', 'Підмайстер', 'Майстер', 'Магістр', 'Архімаг']]),
        ];
        Http::fake(['api.anthropic.com/*' => function () use (&$replies) {
            return Http::response(['content' => [['type' => 'text', 'text' => array_shift($replies)]], 'stop_reason' => 'end_turn']);
        }]);
        $owner = User::factory()->create();
        $game = Game::query()->create(['slug' => 'wow', 'name' => 'World of Warcraft', 'letter' => 'W', 'category' => 'pc', 'is_published' => true]);
        $clan = app(ClanService::class)->create($owner, ['type' => 'guild', 'name' => 'Срібні круки', 'tag' => 'RVN', 'game_id' => $game->id, 'features' => ['rules'], 'join_mode' => 'open'], null);
        $titles = $clan->rankTitles();

        $this->actingAs($owner)->postJson("/clans/{$clan->slug}/ai/rules", ['brief' => 'дружня атмосфера'])->assertOk()
            ->assertJsonPath('text', "# Статут гільдії\n1. Допомагай своїм.");
        $this->actingAs($owner)->postJson("/clans/{$clan->slug}/ai/ranks", ['style' => 'магічна академія'])->assertOk()
            ->assertJsonPath('ranks.1', 'Учень')->assertJsonPath('ranks.5', 'Архімаг');
        $this->actingAs(User::factory()->create())->postJson("/clans/{$clan->slug}/ai/rules", ['brief' => 'x'])->assertForbidden();
        $this->assertSame($titles, $clan->fresh()->rankTitles());
    }
}

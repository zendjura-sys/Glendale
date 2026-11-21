<?php

namespace Tests\Feature;

use App\Models\DeveloperApp;
use App\Models\User;
use App\Services\Billing\Wallet;
use App\Services\Developer\DeveloperPro;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/** №305: пакет GameCon Dev Pro — купівля з балансу, ліміти й ШІ-відповіді з квотою, гнучко з адмінки. */
class DeveloperProTest extends TestCase
{
    use RefreshDatabase;

    private function offer(array $extra = []): void
    {
        app(SiteSettings::class)->put(['dev_pro_enabled' => true, 'dev_pro_price' => 199, 'dev_pro_apps' => 30, 'dev_pro_ai_quota' => 2, ...$extra]);
    }

    public function test_purchase_extends_and_unlocks_limits(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post('/developers/pro')->assertSessionHasErrors('pro'); // ще не продається
        $this->offer();
        $this->actingAs($user)->post('/developers/pro')->assertSessionHasErrors('pro'); // немає коштів

        app(Wallet::class)->credit($user, 50_000, 'topup', 'Тест');
        $this->actingAs($user)->post('/developers/pro')->assertRedirect();
        $pro = app(DeveloperPro::class);
        $this->assertTrue($pro->active($user->fresh()));
        $this->assertSame(30, $pro->appsLimit($user->fresh()));
        $this->assertSame(50_000 - 19_900, (int) $user->fresh()->balance);

        // Продовження — від поточної дати завершення.
        $first = $pro->until($user->fresh());
        $this->actingAs($user)->post('/developers/pro')->assertRedirect();
        $this->assertSame($first->copy()->addDays(30)->toDateString(), $pro->until($user->fresh())->toDateString());

        // Адміністратор вимкнув функцію — діє одразу.
        app(SiteSettings::class)->put(['dev_pro_f_apps' => false]);
        $this->assertSame(DeveloperApp::MAX_PER_USER, $pro->appsLimit($user->fresh()));
    }

    public function test_ai_reply_needs_pro_and_respects_quota(): void
    {
        $this->offer();
        app(SiteSettings::class)->putSecret('ai_key', 'sk-ant-test-key');
        Http::fake(['api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => 'Сервер працює з 10:00.']]])]);
        $owner = User::factory()->create();
        $secret = 'secret-'.Str::random(24);
        $app = DeveloperApp::query()->forceCreate([
            'user_id' => $owner->id, 'name' => 'Форум RP', 'client_id' => Str::random(24), 'client_secret' => hash('sha256', $secret),
            'public_key' => Str::random(32), 'confidential' => true, 'redirect_uris' => [], 'scopes' => ['profile'],
        ]);
        $call = fn () => $this->postJson('/api/developer/v1/server/ai/reply', ['client_id' => $app->client_id, 'client_secret' => $secret, 'prompt' => 'Коли працює сервер?']);

        $call()->assertStatus(402);
        $owner->mergePref(['dev_pro_until' => now()->addDays(5)->toIso8601String()]);
        $call()->assertOk()->assertJsonPath('reply', 'Сервер працює з 10:00.')->assertJsonPath('quota.used', 1);
        $call()->assertOk();
        $call()->assertStatus(429); // квота 2 на місяць
    }
}

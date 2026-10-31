<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Geo\CountryRestrictions;
use App\Services\Geo\GeoIp;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CountryRestrictionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        // Замість бази «IP → країна»: 5.6.7.8 — Китай, 9.9.9.9 — невідомо, решта — Україна.
        $this->app->instance(GeoIp::class, new class(app(SiteSettings::class)) extends GeoIp
        {
            public function country(string $ip): ?string
            {
                return match ($ip) {
                    '5.6.7.8' => 'CN',
                    '9.9.9.9' => null,
                    default => 'UA',
                };
            }

            public function available(): bool
            {
                return true;
            }
        });
    }

    private function fromIp(string $ip): static
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip]);
    }

    private function restrict(): void
    {
        app(CountryRestrictions::class)->save('CN', ['cinema'], ['polls'], 'тест');
    }

    public function test_restricted_section_is_hidden_and_blocked_for_visitors_from_the_country(): void
    {
        $user = User::factory()->create();
        $this->restrict();

        $this->fromIp('5.6.7.8')->actingAs($user)->get('/feed')
            ->assertInertia(fn (Assert $page) => $page
                ->where('modules', fn ($modules) => ! collect($modules)->contains('cinema') && collect($modules)->contains('music'))
                ->where('plugins.polls', false)
                ->where('nav', fn ($nav) => ! collect($nav)->pluck('key')->contains('cinema')));
        $this->fromIp('5.6.7.8')->actingAs($user)->get('/cinema')->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page->component('error')->where('message', CountryRestrictions::MESSAGE));

        // Функція (плагін): 403 з поясненням.
        $post = Post::factory()->create();
        $this->fromIp('5.6.7.8')->actingAs($user)->postJson("/posts/{$post->id}/poll", ['option_id' => 1])
            ->assertForbidden()->assertJsonPath('message', CountryRestrictions::MESSAGE);

        // Інша країна й невідома країна — без обмежень.
        $this->fromIp('1.2.3.4')->actingAs($user)->get('/cinema')->assertOk();
        $this->fromIp('9.9.9.9')->actingAs($user)->get('/cinema')->assertOk();
        $this->fromIp('1.2.3.4')->actingAs($user)->get('/feed')
            ->assertInertia(fn (Assert $page) => $page->where('modules', fn ($modules) => collect($modules)->contains('cinema'))->where('plugins.polls', true));
    }

    public function test_admins_are_never_restricted(): void
    {
        $this->restrict();
        $admin = User::factory()->admin()->create();

        $this->fromIp('5.6.7.8')->actingAs($admin)->get('/cinema')->assertOk();
        $this->fromIp('5.6.7.8')->actingAs($admin)->get('/admin/geo/restrictions')->assertOk();
    }

    public function test_app_bootstrap_and_api_reflect_restrictions(): void
    {
        $this->restrict();
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user, 'Pixel');

        $this->fromIp('5.6.7.8')->withToken($token)->getJson('/api/v1/me')->assertOk()
            ->assertJsonPath('user.modules', fn ($modules) => ! in_array('cinema', $modules, true) && in_array('music', $modules, true));
        $this->fromIp('5.6.7.8')->withToken($token)->getJson('/api/v1/site/cinema')
            ->assertForbidden()->assertJsonPath('message', CountryRestrictions::MESSAGE);

        $this->fromIp('1.2.3.4')->withToken($token)->getJson('/api/v1/me')
            ->assertJsonPath('user.modules', fn ($modules) => in_array('cinema', $modules, true));
    }

    public function test_cloudflare_header_is_respected_only_when_trusted(): void
    {
        $this->restrict();
        $user = User::factory()->create();
        app(SiteSettings::class)->put(['geo_trust_cloudflare' => true]);
        $this->fromIp('1.2.3.4')->actingAs($user)->get('/cinema', ['CF-IPCountry' => 'CN'])->assertForbidden();

        app(SiteSettings::class)->put(['geo_trust_cloudflare' => false]);
        $this->fromIp('1.2.3.4')->actingAs($user)->get('/cinema', ['CF-IPCountry' => 'CN'])->assertOk();
    }

    public function test_admin_page_saves_and_logs_changes(): void
    {
        Log::spy();
        $admin = User::factory()->admin()->create();
        $this->actingAs(User::factory()->create())->get('/admin/geo/restrictions')->assertForbidden();
        $this->actingAs(User::factory()->create())->put('/admin/geo/restrictions/CN', ['modules' => ['cinema'], 'plugins' => []])->assertForbidden();

        $this->actingAs($admin)->get('/admin/geo/restrictions')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('admin/geo-restrictions')
                ->where('recommended.CN.modules', fn ($modules) => collect($modules)->contains('cinema'))
                ->where('modules', fn ($modules) => ! collect($modules)->pluck('key')->contains('profile')));

        // Модуль ядра й невідомий плагін не приймаються.
        $this->actingAs($admin)->put('/admin/geo/restrictions/CN', ['modules' => ['profile'], 'plugins' => []])->assertSessionHasErrors('modules.0');
        $this->actingAs($admin)->put('/admin/geo/restrictions/CN', ['modules' => [], 'plugins' => ['nope']])->assertSessionHasErrors('plugins.0');

        $this->actingAs($admin)->put('/admin/geo/restrictions/CN', ['modules' => ['cinema', 'phone'], 'plugins' => ['polls'], 'note' => 'Перевірено'])
            ->assertSessionHasNoErrors();
        $this->assertSame(['modules' => ['cinema', 'phone'], 'plugins' => ['polls'], 'note' => 'Перевірено'], app(CountryRestrictions::class)->for('CN'));
        Log::shouldHaveReceived('info')->withArgs(fn ($message, $context = []) => $message === 'geo: country restrictions updated'
            && $context['country'] === 'CN' && $context['by'] === $admin->id && $context['modules'] === ['cinema', 'phone']);

        // Порожній набір знімає обмеження.
        $this->actingAs($admin)->put('/admin/geo/restrictions/CN', ['modules' => [], 'plugins' => []])->assertSessionHasNoErrors();
        $this->assertSame([], app(CountryRestrictions::class)->all());
    }

    public function test_recommendations_endpoint_is_a_suggestion_only(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs(User::factory()->create())->getJson('/admin/geo/restrictions/CN/recommendations')->assertForbidden();

        $this->actingAs($admin)->getJson('/admin/geo/restrictions/CN/recommendations')->assertOk()
            ->assertJsonPath('country', 'CN')
            ->assertJsonPath('modules', fn ($modules) => in_array('cinema', $modules, true) && in_array('phone', $modules, true))
            ->assertJsonPath('reasons.0.id', fn ($id) => is_string($id));
        $this->actingAs($admin)->getJson('/admin/geo/restrictions/FI/recommendations')->assertOk()
            ->assertJsonPath('modules', [])->assertJsonPath('reasons', []);

        // Рекомендації нічого не застосовують самі.
        $this->assertSame([], app(CountryRestrictions::class)->all());
    }
}

<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServerLanguageTest extends TestCase
{
    use RefreshDatabase;

    private function server(string $slug, string $language): GtaServer
    {
        return GtaServer::query()->create([
            'slug' => $slug, 'name' => ucfirst($slug), 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed', 'language' => $language,
        ]);
    }

    private function user(string $locale): User
    {
        $user = User::factory()->create();
        $user->forceFill(['locale' => $locale])->save();

        return $user;
    }

    public function test_catalog_shows_servers_of_interface_language_by_default(): void
    {
        app(SiteSettings::class)->put(['languages' => [['code' => 'de', 'enabled' => true], ['code' => 'en', 'enabled' => true]]]);
        $this->server('kyiv-rp', 'uk');
        $this->server('lviv-rp', 'uk');
        $this->server('berlin-rp', 'de');

        // Німецький інтерфейс — німецькі сервери й заголовок «Німецькі».
        $this->actingAs($this->user('de'))->get('/servers')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.lang', 'de')
                ->where('heading', 'Німецькі')
                ->has('servers', 1)
                ->where('servers.0.language', 'de')
                ->where('stats.servers', 1)
                ->has('languages', 2));

        // Англомовних серверів немає — показуємо всі.
        $this->actingAs($this->user('en'))->get('/servers')
            ->assertInertia(fn (Assert $page) => $page->where('filters.lang', 'all')->where('heading', null)->has('servers', 3));

        // Українською — українські; вибір мови вручну.
        $uk = User::factory()->create();
        // Тестовий клієнт за замовчуванням надсилає Accept-Language: en-us.
        $this->actingAs($uk)->get('/servers', ['Accept-Language' => 'uk-UA,uk;q=0.9'])
            ->assertInertia(fn (Assert $page) => $page->where('filters.lang', 'uk')->where('heading', 'Українські')->has('servers', 2));
        $this->actingAs($uk)->get('/servers?lang=de')
            ->assertInertia(fn (Assert $page) => $page->where('filters.lang', 'de')->has('servers', 1));
        $this->actingAs($uk)->get('/servers?lang=all')
            ->assertInertia(fn (Assert $page) => $page->has('servers', 3));
    }
}

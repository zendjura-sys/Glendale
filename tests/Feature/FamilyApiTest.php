<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Database\Seeders\SystemPermissionsSeeder;
use Tests\TestCase;

class FamilyApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function user(string $name = 'Гравець'): User
    {
        return User::factory()->create(['first_name' => $name, 'last_name' => 'Test']);
    }

    private function admin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $admin = $this->user('Адмін');
        $admin->assignRole('admin');

        return $admin;
    }

    private function register(User $leader, array $extra = []): array
    {
        Sanctum::actingAs($leader);

        return $this->post('/api/v2/families', array_merge([
            'name' => 'Corleone',
            'tag' => 'crl',
            'project' => 'Verba Online',
            'server' => '1',
            'description' => 'Сім\'я',
            'proof' => UploadedFile::fake()->image('proof.jpg'),
        ], $extra), ['Accept' => 'application/json'])->assertCreated()->json();
    }

    public function test_registration_requires_proof_and_starts_pending(): void
    {
        Sanctum::actingAs($this->user());
        $this->postJson('/api/v2/families', ['name' => 'X', 'project' => 'P', 'server' => 'S'])
            ->assertStatus(422)->assertJsonValidationErrors(['proof', 'name']);

        $family = $this->register($this->user('Лідер'));
        $this->assertSame('pending', $family['status']);
        $this->assertSame('CRL', $family['tag']);
        $this->assertSame('leader', $family['myRole']);
        $this->assertNotNull($family['proof']);
    }

    public function test_pending_family_is_hidden_from_others_and_admin_verifies_it(): void
    {
        $leader = $this->user('Лідер');
        $family = $this->register($leader);

        $stranger = $this->user('Чужий');
        Sanctum::actingAs($stranger);
        $this->getJson("/api/v2/families/{$family['id']}")->assertNotFound();
        $this->getJson('/api/v2/families')->assertJsonCount(0);

        // Звичайний користувач не має доступу до адмінки родин.
        $this->actingAs($stranger)->get('/admin/families')->assertForbidden();

        $admin = $this->admin();
        $this->actingAs($admin)->get('/admin/families')->assertOk();
        $this->actingAs($admin)->post("/admin/families/{$family['id']}/reject", [])->assertSessionHasErrors('note');
        $this->actingAs($admin)->post("/admin/families/{$family['id']}/verify")->assertRedirect();

        Sanctum::actingAs($stranger);
        $this->getJson('/api/v2/families')->assertJsonPath('0.id', $family['id']);
        Sanctum::actingAs($leader);
        $this->getJson('/api/v2/notifications')->assertJsonPath('items.0.type', 'family_verified')
            ->assertJsonPath('items.0.familyId', $family['id']);
    }

    public function test_rejected_family_can_be_fixed_and_resubmitted(): void
    {
        $leader = $this->user('Лідер');
        $family = $this->register($leader);
        $this->actingAs($this->admin())->post("/admin/families/{$family['id']}/reject", ['note' => 'Нечіткий скріншот']);

        Sanctum::actingAs($leader);
        $this->getJson("/api/v2/families/{$family['id']}")
            ->assertJsonPath('status', 'rejected')->assertJsonPath('reviewNote', 'Нечіткий скріншот');
        $this->postJson("/api/v2/families/{$family['id']}/resubmit")->assertJsonPath('status', 'pending');
    }

    public function test_join_request_approval_roles_and_one_family_per_server(): void
    {
        $leader = $this->user('Лідер');
        $family = $this->register($leader);
        $this->actingAs($this->admin())->post("/admin/families/{$family['id']}/verify");

        $player = $this->user('Новачок');
        Sanctum::actingAs($player);
        $this->postJson("/api/v2/families/{$family['id']}/join", ['message' => 'Візьміть мене'])->assertJsonPath('requested', true);

        Sanctum::actingAs($leader);
        $this->getJson("/api/v2/families/{$family['id']}/requests")->assertJsonPath('0.message', 'Візьміть мене');
        $this->postJson("/api/v2/families/{$family['id']}/requests/{$player->id}")->assertOk();
        $this->patchJson("/api/v2/families/{$family['id']}/members/{$player->id}", ['role' => 'deputy'])->assertOk();
        $this->getJson("/api/v2/families/{$family['id']}/members")->assertJsonPath('1.role', 'deputy');

        // Гравець не може заснувати ще одну родину на тому самому сервері…
        Sanctum::actingAs($player);
        $this->post('/api/v2/families', [
            'name' => 'Друга', 'project' => 'verba online', 'server' => '1',
            'proof' => UploadedFile::fake()->image('p.jpg'),
        ], ['Accept' => 'application/json'])->assertStatus(409);
        // …а на іншому — може.
        $this->register($player, ['name' => 'Друга', 'server' => '2']);

        // Лідер не може просто вийти, заступник — може.
        Sanctum::actingAs($leader);
        $this->deleteJson("/api/v2/families/{$family['id']}/join")->assertStatus(400);
    }

    public function test_verified_family_identity_is_locked(): void
    {
        $leader = $this->user('Лідер');
        $family = $this->register($leader);
        $this->actingAs($this->admin())->post("/admin/families/{$family['id']}/verify");

        Sanctum::actingAs($leader);
        $this->patchJson("/api/v2/families/{$family['id']}", ['name' => 'Інша'])->assertForbidden();
        $this->patchJson("/api/v2/families/{$family['id']}", ['description' => 'Новий опис'])->assertJsonPath('description', 'Новий опис');
    }

    public function test_leader_picks_a_family_color_from_the_preset_list(): void
    {
        $leader = $this->user('Лідер');
        $family = $this->register($leader);
        $this->actingAs($this->admin())->post("/admin/families/{$family['id']}/verify");

        Sanctum::actingAs($leader);
        // Навіть на верифікованій родині — колір не входить у "заблоковану"
        // ідентичність (назва/проєкт/сервер), його можна міняти будь-коли.
        $this->patchJson("/api/v2/families/{$family['id']}", ['color' => \App\Social\Families::COLORS[3]])
            ->assertOk()->assertJsonPath('color', \App\Social\Families::COLORS[3]);
        $this->patchJson("/api/v2/families/{$family['id']}", ['color' => '#123456'])->assertUnprocessable();
        $this->patchJson("/api/v2/families/{$family['id']}", ['color' => null])
            ->assertOk()->assertJsonPath('color', null);
    }

    public function test_unions_flow(): void
    {
        $admin = $this->admin();
        $a = $this->user('ЛідерА');
        $b = $this->user('ЛідерБ');
        $famA = $this->register($a, ['name' => 'Alpha']);
        $famB = $this->register($b, ['name' => 'Bravo']);
        $this->actingAs($admin)->post("/admin/families/{$famA['id']}/verify");
        $this->actingAs($admin)->post("/admin/families/{$famB['id']}/verify");

        // Створити союз може лише лідер верифікованої родини.
        Sanctum::actingAs($b);
        $this->postJson('/api/v2/unions', ['name' => 'Союз', 'familyId' => $famA['id']])->assertForbidden();

        Sanctum::actingAs($a);
        $union = $this->postJson('/api/v2/unions', ['name' => 'Північний союз', 'tag' => 'nrth', 'familyId' => $famA['id']])
            ->assertCreated()->assertJsonPath('status', 'pending')->assertJsonPath('isFounder', true)->json();

        // До верифікації вступити не можна.
        Sanctum::actingAs($b);
        $this->postJson("/api/v2/unions/{$union['id']}/join", ['familyId' => $famB['id']])->assertNotFound();

        $this->actingAs($admin)->post("/admin/families/unions/{$union['id']}/verify")->assertRedirect();

        Sanctum::actingAs($b);
        $this->postJson("/api/v2/unions/{$union['id']}/join", ['familyId' => $famB['id']])->assertOk();
        Sanctum::actingAs($a);
        $this->postJson("/api/v2/unions/{$union['id']}/requests/{$famB['id']}")->assertOk();
        $this->getJson("/api/v2/unions/{$union['id']}")->assertJsonCount(2, 'families');
        $this->getJson("/api/v2/families/{$famB['id']}")->assertJsonPath('union.id', $union['id']);

        // Родина — лише в одному союзі.
        Sanctum::actingAs($b);
        $this->postJson('/api/v2/unions', ['name' => 'Ще один', 'familyId' => $famB['id']])->assertStatus(409);
        $this->getJson('/api/v2/notifications')->assertJsonPath('items.0.type', 'union_join_accepted');
    }

    public function test_me_lists_my_families_for_the_menu(): void
    {
        $leader = $this->user('Лідер');
        $family = $this->register($leader);

        Sanctum::actingAs($leader);
        $this->getJson('/api/v2/me')->assertJsonPath('user.families.0.id', $family['id'])
            ->assertJsonPath('user.families.0.role', 'leader')
            ->assertJsonPath('user.canManageFamilies', false);
    }

    public function test_project_directory_with_custom_entries_approved_with_family(): void
    {
        $admin = $this->admin();
        $verba = \Illuminate\Support\Facades\DB::table('game_projects')->where('name', 'Verba Online')->value('id');
        $this->assertNotNull($verba, 'стартові проєкти засіяні');

        // Адмін додає сервери списком, дублікати пропускаються.
        $this->actingAs($admin)->post("/admin/families/projects/{$verba}/servers", ['names' => "1\n2\n1"])->assertRedirect();
        $this->assertSame(2, \Illuminate\Support\Facades\DB::table('game_servers')->where('project_id', $verba)->count());
        $server = \Illuminate\Support\Facades\DB::table('game_servers')->where('project_id', $verba)->where('name', '2')->value('id');

        // Вибір зі списку за id.
        $a = $this->user('ЛідерА');
        $famA = $this->register($a, ['project' => null, 'server' => null, 'projectId' => $verba, 'serverId' => $server]);
        $this->assertSame('Verba Online', $famA['project']);
        $this->assertSame($server, $famA['serverId']);

        // Свій проєкт — непідтверджений: інші його не бачать, автор — бачить.
        $b = $this->user('ЛідерБ');
        $famB = $this->register($b, ['name' => 'Kyiv Boys', 'project' => 'Ukraine RP', 'server' => '3']);
        $this->getJson('/api/v2/families/projects')->assertJsonFragment(['name' => 'Ukraine RP', 'approved' => false]);
        Sanctum::actingAs($a);
        $this->assertNotContains('Ukraine RP', collect($this->getJson('/api/v2/families/projects')->json())->pluck('name'));

        // Підтвердження родини підтверджує і її проєкт та сервер.
        $this->actingAs($admin)->post("/admin/families/{$famB['id']}/verify");
        Sanctum::actingAs($a);
        $projects = collect($this->getJson('/api/v2/families/projects')->json())->keyBy('name');
        $this->assertTrue($projects['Ukraine RP']['approved']);
        $this->assertSame('3', $projects['Ukraine RP']['servers'][0]['name']);

        // Фільтр каталогу за проєктом.
        $this->getJson('/api/v2/families?projectId='.$projects['Ukraine RP']['id'])->assertJsonCount(1)->assertJsonPath('0.name', 'Kyiv Boys');
    }

    public function test_project_logo_is_fetched_from_official_site(): void
    {
        $png = "\x89PNG\r\n\x1a\n".str_repeat("\0", 200);
        Http::fake([
            'verba.online/img/*' => Http::response($png, 200, ['Content-Type' => 'image/png']),
            'verba.online' => Http::response('<html><head><link rel="icon" href="/fav.png" sizes="32x32"><link rel="apple-touch-icon" href="/img/touch.png"><meta property="og:image" content="https://cdn.example/og.jpg"></head></html>'),
            '*' => Http::response('', 404),
        ]);

        $this->artisan('projects:fetch-logos')->assertSuccessful();

        $project = DB::table('game_projects')->where('name', 'Verba Online')->first();
        $this->assertSame('https://verba.online', $project->website);
        $this->assertNotNull($project->logo_path);
        Storage::disk('public')->assertExists($project->logo_path);
        Http::assertSent(fn ($r) => $r->url() === 'https://verba.online/img/touch.png');

        // Адмін міняє сайт і підтягує логотип кнопкою.
        $admin = $this->admin();
        $this->actingAs($admin)->post(route('admin.families.projects.website', $project->id), ['website' => 'bad site'])
            ->assertSessionHasErrors('website');
        $this->actingAs($admin)->post(route('admin.families.projects.website', $project->id), ['website' => 'verba.online'])
            ->assertSessionHas('status');
    }

    public function test_manual_server_input_and_new_project_logo(): void
    {
        $admin = $this->admin();
        $verba = DB::table('game_projects')->where('name', 'Verba Online')->value('id');

        // Сервери вводяться вручну: номер 1–999 або назва кирилицею; решта пропускається.
        $this->actingAs($admin)->post("/admin/families/projects/{$verba}/servers", ['names' => "1\n999\nЛьвів\nБіла Церква\nPhoenix\nRed-Rock\n1000\n0\nServer 5\n7a"])
            ->assertSessionHas('status', fn ($s) => str_starts_with($s, 'Додано серверів: 6. Пропущено некоректних: 4'));
        $this->assertEqualsCanonicalizing(['1', '999', 'Львів', 'Біла Церква', 'Phoenix', 'Red-Rock'], DB::table('game_servers')->where('project_id', $verba)->pluck('name')->all());
        $this->actingAs($admin)->post("/admin/families/projects/{$verba}/servers", ['names' => "a1"])->assertSessionHasErrors('names');

        $family0 = $this->register($this->user('Латиниця'), ['server' => 'Kyiv']);
        $this->assertSame('Kyiv', $family0['server']);

        // У формі — так само; «999» — це наявний сервер, а не новий запис.
        $family = $this->register($this->user('Лідер'), ['server' => '999']);
        $this->assertSame('999', $family['server']);
        Sanctum::actingAs($this->user('Ще один'));
        foreach (['Server 1', '1000', '07', 'Kyiv!', 'a1'] as $bad) {
            $this->post('/api/v2/families', ['name' => 'X', 'project' => 'Verba Online', 'server' => $bad, 'proof' => UploadedFile::fake()->image('p.jpg')], ['Accept' => 'application/json'])
                ->assertStatus(422);
        }
        $this->assertSame(7, DB::table('game_servers')->where('project_id', $verba)->count());

        // Новий проєкт — одразу з логотипом.
        $other = $this->register($this->user('Інший'), ['project' => 'Kyiv RP', 'server' => '1', 'projectLogo' => UploadedFile::fake()->image('logo.png', 128, 128)]);
        $logo = DB::table('game_projects')->where('id', $other['projectId'])->value('logo_path');
        $this->assertNotNull($logo);
        Storage::disk('public')->assertExists($logo);

        // Адмін додає проєкт із логотипом.
        $this->actingAs($admin)->post('/admin/families/projects', ['name' => 'Lviv RP', 'logo' => UploadedFile::fake()->image('l.png')])->assertSessionHas('status');
        $this->assertNotNull(DB::table('game_projects')->where('name', 'Lviv RP')->value('logo_path'));
    }

    public function test_ragemp_servers_are_synced_automatically(): void
    {
        $master = [
                '1.2.3.4:22005' => ['name' => '🔮 Quant RP | Server 1 | [UKRAINE] [VOICE]', 'url' => 'https://quant5.com.ua', 'players' => 812, 'maxplayers' => 2000],
                '1.2.3.5:22005' => ['name' => '🔮 Quant RP | Server 2 | [UKRAINE]', 'url' => 'quant5.com.ua', 'players' => 301, 'maxplayers' => 2000],
                'ua1.nexus-rp.net:22005' => ['name' => 'Nexus RP | Україна', 'url' => 'https://nexus-rp.net', 'players' => 90, 'maxplayers' => 1000],
                '9.9.9.9:22005' => ['name' => 'Some Other RP', 'url' => 'https://other.example', 'players' => 5, 'maxplayers' => 100],
        ];
        Http::fake(['cdn.rage.mp/*' => function () use (&$master) {
            return Http::response($master);
        }]);

        $this->artisan('projects:sync-servers')->assertSuccessful();

        $quant = DB::table('game_projects')->where('name', 'Quant RP')->value('id');
        $servers = DB::table('game_servers')->where('project_id', $quant)->orderBy('name')->get();
        $this->assertSame(['Server 1', 'Server 2'], $servers->pluck('name')->all());
        $this->assertSame(812, (int) $servers[0]->players);
        $this->assertSame('1.2.3.4:22005', $servers[0]->address);
        $nexus = DB::table('game_projects')->where('name', 'Nexus RP')->value('id');
        $this->assertSame(['Україна'], DB::table('game_servers')->where('project_id', $nexus)->pluck('name')->all());

        // Повторна синхронізація оновлює онлайн, а не дублює сервери.
        $master = ['1.2.3.4:22005' => ['name' => 'Quant RP | Server 1', 'url' => 'https://quant5.com.ua', 'players' => 900, 'maxplayers' => 2000]];
        $this->artisan('projects:sync-servers')->assertSuccessful();
        $this->assertSame(2, DB::table('game_servers')->where('project_id', $quant)->count());
        $this->assertSame(900, (int) DB::table('game_servers')->where('address', '1.2.3.4:22005')->value('players'));
        $this->assertNull(DB::table('game_servers')->where('address', '1.2.3.5:22005')->value('players'));
    }
}


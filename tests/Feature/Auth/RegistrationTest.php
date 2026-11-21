<?php

namespace Tests\Feature\Auth;

use App\Models\LoginEvent;
use App\Models\SpamBlock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Features;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->skipUnlessFortifyHas(Features::registration());
    }

    public function test_registration_screen_can_be_rendered()
    {
        $response = $this->get(route('register'));

        $response->assertOk();
    }

    public function test_new_users_can_register()
    {
        $response = $this->post(route('register.store'), [
            'first_name' => 'Тарас',
            'last_name' => 'Шевченко',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('feed', absolute: false));
    }

    public function test_bots_filling_the_hidden_field_are_rejected()
    {
        $this->post(route('register.store'), [
            'first_name' => 'Бот',
            'last_name' => 'Спамер',
            'email' => 'bot@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'website' => 'https://spam.example',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
        $this->assertDatabaseMissing('users', ['email' => 'bot@example.com']);
    }

    public function test_too_many_accounts_from_one_address_are_stopped()
    {
        foreach (range(1, 5) as $i) {
            $this->post(route('register.store'), [
                'first_name' => 'Гравець',
                'last_name' => 'Номер'.$i,
                'email' => "player{$i}@example.com",
                'password' => 'password',
                'password_confirmation' => 'password',
            ]);
            auth()->logout();
        }

        $this->post(route('register.store'), [
            'first_name' => 'Гравець',
            'last_name' => 'Шостий',
            'email' => 'player6@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertSessionHasErrors('email');
        $this->assertDatabaseMissing('users', ['email' => 'player6@example.com']);
    }

    public function test_disposable_email_and_instant_submit_are_rejected()
    {
        $base = ['first_name' => 'Олег', 'last_name' => 'Бот', 'password' => 'password', 'password_confirmation' => 'password'];

        $this->post(route('register.store'), [...$base, 'email' => 'x@mailinator.com'])->assertSessionHasErrors('email');
        $this->post(route('register.store'), [...$base, 'email' => 'x@sub.yopmail.com'])->assertSessionHasErrors('email');
        // Форму надіслали через секунду після відкриття — бот.
        $this->post(route('register.store'), [...$base, 'email' => 'fast@example.com', 'form_ts' => now()->subSecond()->getTimestampMs()])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertSame(3, SpamBlock::query()->whereIn('kind', ['signup_disposable', 'signup_fast'])->count());
        // У журналі — лише домен, не адреса.
        $this->assertFalse(SpamBlock::query()->where('detail', 'like', '%x@%')->exists());

        // Людина, що заповнювала форму кілька секунд, — проходить.
        $this->post(route('register.store'), [...$base, 'email' => 'human@example.com', 'form_ts' => now()->subSeconds(20)->getTimestampMs()]);
        $this->assertAuthenticated();
    }

    public function test_signup_from_banned_users_address_is_flagged_for_admins()
    {
        $banned = User::factory()->create(['banned_at' => now()]);
        LoginEvent::query()->create(['user_id' => $banned->id, 'method' => 'password', 'success' => true, 'ip' => '127.0.0.1', 'created_at' => now()->subDay()]);

        $this->post(route('register.store'), ['first_name' => 'Новий', 'last_name' => 'Акаунт', 'email' => 'new@example.com', 'password' => 'password', 'password_confirmation' => 'password']);

        $this->assertAuthenticated();
        $user = User::query()->where('email', 'new@example.com')->sole();
        $this->assertSame([$banned->id], $user->pref('fraud_flags')['ban_evasion']['banned']);
        $this->assertTrue(SpamBlock::query()->where('kind', 'ban_evasion')->where('user_id', $user->id)->exists());
    }
}

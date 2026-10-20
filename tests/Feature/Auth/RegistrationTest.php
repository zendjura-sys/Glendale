<?php

namespace Tests\Feature\Auth;

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
}

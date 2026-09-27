<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * union.gamecon.online реєструє союзників (окрема спілка/родина), а не
 * учасників самої Monsory — форма й валідація там інші. UNION_DOMAIN
 * (union.monsory.test) заданий у phpunit.xml для всієї сюїти.
 */
class UnionRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Союзний',
            'last_name' => 'Лідер',
            'email' => 'ally@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'union_family_name' => 'Family Del Rio',
            'union_role' => 'leader',
        ], $overrides);
    }

    public function test_the_union_registration_screen_exposes_the_extra_fields(): void
    {
        $this->get('http://union.monsory.test/register')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('isUnion', true)
                ->where('unionRoles.leader', 'Лідер'));
    }

    public function test_the_regular_registration_screen_does_not_expose_them(): void
    {
        $this->get('http://localhost/register')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('isUnion', false));
    }

    public function test_a_union_registrant_is_saved_with_family_name_and_role(): void
    {
        $this->post('http://union.monsory.test/register', $this->payload())
            ->assertRedirect(route('dashboard', absolute: false));

        $this->assertAuthenticated();

        $user = User::where('email', 'ally@example.com')->firstOrFail();
        $this->assertSame('Family Del Rio', $user->union_family_name);
        $this->assertSame('leader', $user->union_role);
        // Союзник не входить в ієрархію Monsory — жодної посади не присвоюється.
        $this->assertNull($user->position_key);
    }

    public function test_union_registration_requires_family_name_and_role(): void
    {
        $this->post('http://union.monsory.test/register', $this->payload([
            'union_family_name' => '',
            'union_role' => '',
        ]))->assertSessionHasErrors(['union_family_name', 'union_role']);

        $this->assertGuest();
    }

    public function test_union_registration_rejects_an_unknown_role(): void
    {
        $this->post('http://union.monsory.test/register', $this->payload(['union_role' => 'emperor']))
            ->assertSessionHasErrors('union_role');

        $this->assertGuest();
    }

    public function test_the_regular_domain_rejects_union_fields(): void
    {
        $this->post('http://localhost/register', $this->payload())
            ->assertSessionHasErrors(['union_family_name', 'union_role']);

        $this->assertGuest();
    }

    /** Тіньові акаунти — суто механіка Reports "за друга", союзника з таким ім'ям там бути не може. */
    public function test_shadow_account_matching_is_skipped_for_union_registrants(): void
    {
        User::factory()->create(['is_shadow' => true, 'name' => 'Союзний Лідер']);

        $response = $this->post('http://union.monsory.test/register', $this->payload());

        $response->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticated();
    }
}

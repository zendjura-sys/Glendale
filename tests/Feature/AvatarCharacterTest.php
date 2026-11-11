<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Profile\Character;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Персонаж-аватар: збереження набору частин і перевірка меж (міст для застосунку — в AppSiteParityTest). */
class AvatarCharacterTest extends TestCase
{
    use RefreshDatabase;

    public function test_saves_valid_character_and_rejects_unknown_variants(): void
    {
        $user = User::factory()->create();
        $set = ['skin' => 3, 'head' => 1, 'hair' => 9, 'hairColor' => 2, 'eyes' => 4, 'eyeColor' => 1, 'brows' => 2, 'nose' => 1, 'mouth' => 2, 'beard' => 2, 'extra' => 4, 'outfit' => 2, 'outfitColor' => 5, 'bg' => 3];

        $this->actingAs($user)->put('/me/character', ['character' => $set])->assertSessionHasNoErrors();
        // Частини, яких не передали, стають варіантами за замовчуванням (посадка й розмір очей — середні).
        $full = [...array_map(fn () => 0, Character::PARTS), ...Character::DEFAULTS, ...$set];
        $this->assertEquals($full, $user->fresh()->character);
        $this->assertSame(0, $user->fresh()->character['tattoo']);
        $this->assertEquals($full, $user->fresh()->toCard()['character']);
        $set = $full;

        $this->actingAs($user)->put('/me/character', ['character' => [...$set, 'hair' => 99]])->assertSessionHasErrors('character');
        $this->actingAs($user)->put('/me/character', ['character' => 'oops'])->assertSessionHasErrors('character');
        $this->assertSame($set, $user->fresh()->character);

        $this->actingAs($user)->delete('/me/character')->assertRedirect();
        $this->assertNull($user->fresh()->character);
    }
}

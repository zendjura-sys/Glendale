<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'author_id' => User::factory(),
            'wall_type' => 'user',
            'wall_id' => fn (array $attributes) => $attributes['author_id'],
            'body' => fake()->realText(160),
            'visibility' => Post::VISIBILITY_PUBLIC,
        ];
    }

    public function friendsOnly(): static
    {
        return $this->state(fn () => ['visibility' => Post::VISIBILITY_FRIENDS]);
    }

    public function private(): static
    {
        return $this->state(fn () => ['visibility' => Post::VISIBILITY_PRIVATE]);
    }
}

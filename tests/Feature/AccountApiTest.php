<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\Appeal;
use App\Models\Feedback;
use App\Models\Post;
use App\Models\User;
use App\Models\UserReport;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountApiTest extends TestCase
{
    use RefreshDatabase;

    private function bearer(User $user, string $device = 'android'): string
    {
        return app(ApiTokens::class)->issue($user, $device);
    }

    public function test_app_lists_devices_and_signs_out_the_others(): void
    {
        $user = User::factory()->create();
        $mine = $this->bearer($user, 'Pixel');
        $this->bearer($user, 'Old phone');

        $this->withToken($mine)->getJson('/api/v1/me/security')
            ->assertOk()
            ->assertJsonCount(2, 'tokens')
            ->assertJsonPath('tokens.0.current', true)
            ->assertJsonPath('hide_profanity', false)
            ->assertJsonMissingPath('appeal_kinds.ban');

        $current = ApiToken::query()->where('name', 'Pixel')->value('id');
        $this->withToken($mine)->deleteJson('/api/v1/me/tokens/'.$current)->assertStatus(422);
        $this->withToken($mine)->deleteJson('/api/v1/me/sessions')->assertOk()->assertJsonPath('count', 1);
        $this->assertSame(['Pixel'], ApiToken::query()->pluck('name')->all());
    }

    public function test_app_freeze_appeal_report_feedback_and_profanity(): void
    {
        [$user, $other] = User::factory()->count(2)->create();
        $token = $this->bearer($user);

        $this->withToken($token)->putJson('/api/v1/me/profanity', ['hide' => true])->assertOk();
        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.profanity_mask', fn ($v) => is_string($v) && $v !== '');

        $this->withToken($token)->postJson('/api/v1/me/appeals', ['kind' => 'mute', 'body' => 'Мене заглушили помилково.'])->assertCreated();
        $this->withToken($token)->postJson('/api/v1/users/'.$other->username.'/report', ['reason' => 'spam'])->assertCreated();
        $this->withToken($token)->postJson('/api/v1/feedback', ['kind' => 'idea', 'body' => 'Темна тема віджета', 'screen' => 'feed'])->assertCreated();
        $this->assertSame(1, Appeal::query()->count());
        $this->assertSame(1, UserReport::query()->count());
        $this->assertSame('app:feed', Feedback::query()->value('url'));

        $this->withToken($token)->postJson('/api/v1/me/freeze', ['password' => 'wrong'])->assertUnprocessable();
        $this->withToken($token)->postJson('/api/v1/me/freeze', ['password' => 'password'])->assertOk();
        $this->assertNotNull($user->fresh()->frozen_at);
        $this->assertSame(0, ApiToken::query()->count());
    }

    public function test_app_feed_filters_by_language(): void
    {
        $user = User::factory()->create();
        $token = $this->bearer($user);
        foreach (['Hello everyone, we are playing together tonight', 'Привіт усім, сьогодні ввечері граємо разом'] as $body) {
            $this->withToken($token)->postJson('/api/v1/posts', ['body' => $body, 'visibility' => 'public'])->assertCreated();
        }
        $this->assertSame(['en', 'uk'], Post::query()->orderBy('id')->pluck('lang')->all());

        $this->withToken($token)->getJson('/api/v1/feed?tab=discover&lang=uk')
            ->assertOk()
            ->assertJsonPath('lang', 'uk')
            ->assertJsonPath('tomorrow', [])
            ->assertJsonCount(1, 'posts.data')
            ->assertJsonPath('posts.data.0.lang', 'uk');
    }
}

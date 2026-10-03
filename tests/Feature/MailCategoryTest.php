<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Notifications\PostInteraction;
use App\Support\Mail\MailBrand;
use App\Support\Mail\MailCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class MailCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'mail.default' => 'array',
            'mail.from.address' => 'no-reply@gamecon.online',
            'mail.from.name' => 'GameCon',
            'mail.updates.address' => null,
            'mail.social.address' => null,
        ]);
    }

    public function test_password_reset_is_an_account_letter(): void
    {
        $user = User::factory()->create();

        $this->post(route('password.email'), ['email' => $user->email])->assertRedirect();

        $email = $this->onlyEmail();
        $this->assertSame(MailCategory::UPDATES, MailCategory::categoryOf($email));
        $this->assertSame('no-reply@gamecon.online', $email->getFrom()[0]->getAddress());
        $this->assertSame('GameCon', $email->getFrom()[0]->getName());
        $this->assertStringContainsString('парол', mb_strtolower($email->getSubject()));
        $this->assertSame('auto-generated', $email->getHeaders()->get('Auto-Submitted')->getBodyAsString());
        $this->assertSame('updates:account:site:gamecon', $email->getHeaders()->get('Feedback-ID')->getBodyAsString());
        $this->assertBranded($email);
    }

    public function test_friend_request_is_a_social_letter(): void
    {
        $from = User::factory()->create(['first_name' => 'Олена', 'last_name' => 'Коваль']);
        $to = User::factory()->create();

        $this->actingAs($from)->post(route('friends.store', $to))->assertRedirect();

        $email = $this->onlyEmail();
        $this->assertSame(MailCategory::SOCIAL, MailCategory::categoryOf($email));
        $this->assertSame('social@gamecon.online', $email->getFrom()[0]->getAddress());
        $this->assertSame('Олена Коваль', $email->getFrom()[0]->getName());
        $this->assertSame([$to->email], array_map(fn ($address) => $address->getAddress(), $email->getTo()));
        $this->assertStringContainsString('хоче додати вас у друзі', $email->getSubject());
        $this->assertStringContainsString('Олена Коваль', $email->getSubject());
        $this->assertSame('social:activity:site:gamecon', $email->getHeaders()->get('Feedback-ID')->getBodyAsString());
        $this->assertBranded($email);
    }

    public function test_like_is_a_social_letter_and_does_not_mail_the_actor(): void
    {
        $author = User::factory()->create();
        $actor = User::factory()->create(['first_name' => 'Ігор', 'last_name' => 'Мельник']);
        $post = Post::factory()->create([
            'author_id' => $author->id,
            'wall_type' => 'user',
            'wall_id' => $author->id,
        ]);

        $author->notify(new PostInteraction(PostInteraction::LIKE, $actor, $post));

        $email = $this->onlyEmail();
        $this->assertSame('social@gamecon.online', $email->getFrom()[0]->getAddress());
        $this->assertSame([$author->email], array_map(fn ($address) => $address->getAddress(), $email->getTo()));
        $this->assertStringContainsString('Ігор Мельник', $email->getSubject());
        $this->assertStringContainsString('оцінив(-ла) ваш запис', $email->getSubject());
    }

    public function test_social_letter_offers_one_click_unsubscribe_that_stops_activity_mail(): void
    {
        $from = User::factory()->create();
        $to = User::factory()->create();

        $this->actingAs($from)->post(route('friends.store', $to))->assertRedirect();

        $email = $this->onlyEmail();
        $headers = $email->getHeaders();
        $this->assertSame('bulk', $headers->get('Precedence')->getBodyAsString());
        $this->assertSame('List-Unsubscribe=One-Click', $headers->get('List-Unsubscribe-Post')->getBodyAsString());
        $this->assertTrue($headers->has('List-Id'));
        $url = trim($headers->get('List-Unsubscribe')->getBodyAsString(), '<>');
        $this->assertStringContainsString('/mail/unsubscribe/'.$to->id, $url);
        $this->assertStringContainsString('Не надсилати листи про активність', (string) $email->getHtmlBody());

        // Без підпису — відмова; з підписом — Gmail відписує одним POST без CSRF-токена.
        $this->post('/mail/unsubscribe/'.$to->id)->assertForbidden();
        $this->post($url)->assertOk();
        $this->assertFalse($to->fresh()->email_social);

        $this->actingAs(User::factory()->create())->post(route('friends.store', $to))->assertRedirect();
        $this->assertCount(1, app('mail.manager')->mailer('array')->getSymfonyTransport()->messages());
    }

    public function test_account_letter_uses_site_layout(): void
    {
        $user = User::factory()->create();

        $this->post(route('password.email'), ['email' => $user->email])->assertRedirect();

        $html = (string) $this->onlyEmail()->getHtmlBody();
        $this->assertStringContainsString('#10142A', $html);
        $this->assertStringContainsString('Задати новий пароль', $html);
        $this->assertStringNotContainsString('Не надсилати листи про активність', $html);
    }

    public function test_activity_mail_can_be_toggled_in_profile_settings(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patch(route('profile.update'), [
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'username' => $user->username,
            'email' => $user->email,
            'email_social' => false,
        ])->assertSessionHasNoErrors();

        $this->assertFalse($user->fresh()->email_social);
    }

    private function assertBranded(Email $email): void
    {
        $html = $email->getHtmlBody();
        $this->assertIsString($html);
        $this->assertStringContainsString(MailBrand::src(), $html);
        $this->assertStringContainsString('alt="GameCon"', $html);

        $ids = array_map(fn ($part) => $part->getContentId(), $email->getAttachments());
        $this->assertContains(MailBrand::CONTENT_ID, $ids);
    }

    private function onlyEmail(): Email
    {
        $messages = app('mail.manager')->mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);

        $email = $messages[0]->getOriginalMessage();
        $this->assertInstanceOf(Email::class, $email);

        return $email;
    }
}

<?php

namespace App\Mail;

use App\Support\Mail\MailCategory;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

/**
 * Подія стрічки, друзів, спільноти або сім’ї. Вкладка «Соцмережі».
 */
class SocialActivityMail extends Mailable implements ShouldQueue, ShouldQueueAfterCommit
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $subjectLine,
        public string $intro,
        public string $actionUrl,
        public string $fromName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(MailCategory::address(MailCategory::SOCIAL), $this->fromName),
            subject: $this->subjectLine,
        );
    }

    public function headers(): Headers
    {
        return new Headers(text: [
            'X-GameCon-Category' => MailCategory::SOCIAL,
        ]);
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.social-activity',
            text: 'mail.social-activity-text',
        );
    }
}

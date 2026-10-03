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
        public ?string $unsubscribeUrl = null,
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
        // Відписка одним натисканням і ідентифікатор розсилки — сигнали, за якими Gmail відносить листи до «Соцмереж».
        return new Headers(text: array_filter([
            'X-GameCon-Category' => MailCategory::SOCIAL,
            'List-Id' => config('app.name').' activity <social.'.(parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost').'>',
            'Precedence' => 'bulk',
            'List-Unsubscribe' => $this->unsubscribeUrl ? '<'.$this->unsubscribeUrl.'>' : null,
            'List-Unsubscribe-Post' => $this->unsubscribeUrl ? 'List-Unsubscribe=One-Click' : null,
        ]));
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.social-activity',
            text: 'mail.social-activity-text',
        );
    }
}

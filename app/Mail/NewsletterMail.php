<?php

namespace App\Mail;

use App\Support\Mail\MailCategory;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

/**
 * Новини GameCon на пошту (№284): та сама розсилка з адмінки, що й у дзвіночок, — лише тим, хто
 * погодився («Новини GameCon на пошту»). Відписка одним натисканням (RFC 8058) — лише від новин.
 */
class NewsletterMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $headline,
        public string $text,
        public string $actionUrl,
        public string $unsubscribeUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(MailCategory::address(MailCategory::UPDATES), (string) config('app.name')),
            subject: $this->headline,
        );
    }

    public function headers(): Headers
    {
        return new Headers(text: [
            'X-GameCon-Category' => MailCategory::UPDATES,
            'List-Id' => config('app.name').' news <news.'.(parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost').'>',
            'Precedence' => 'bulk',
            'List-Unsubscribe' => '<'.$this->unsubscribeUrl.'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }

    public function content(): Content
    {
        return new Content(html: 'mail.newsletter', text: 'mail.newsletter-text');
    }
}

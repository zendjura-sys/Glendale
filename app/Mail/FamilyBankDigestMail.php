<?php

namespace App\Mail;

use App\Services\Families\PersonalBankDigest;
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
 * Тижнева зведення особистого рахунку в банку сім’ї. Вкладка «Соцмережі», відписка одним натисканням.
 */
class FamilyBankDigestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * @param  list<array{family: string, slug: string, member: string, balance: int, income: int, spent: int, operations: list<array{date: string, label: string, amount: int, comment: string|null}>}>  $accounts
     */
    public function __construct(
        public array $accounts,
        public string $period,
        public ?string $unsubscribeUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(MailCategory::address(MailCategory::SOCIAL), (string) config('app.name')),
            subject: PersonalBankDigest::subject($this->accounts).' ('.$this->period.')',
        );
    }

    public function headers(): Headers
    {
        return new Headers(text: array_filter([
            'X-GameCon-Category' => MailCategory::SOCIAL,
            'List-Id' => config('app.name').' family bank <bank.'.(parse_url((string) config('app.url'), PHP_URL_HOST) ?: 'localhost').'>',
            'Precedence' => 'bulk',
            'List-Unsubscribe' => $this->unsubscribeUrl ? '<'.$this->unsubscribeUrl.'>' : null,
            'List-Unsubscribe-Post' => $this->unsubscribeUrl ? 'List-Unsubscribe=One-Click' : null,
        ]));
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.family-bank-digest',
            text: 'mail.family-bank-digest-text',
        );
    }
}

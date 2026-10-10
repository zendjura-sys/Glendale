<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/**
 * Системні повідомлення білінгу (без автора):
 *  wallet_topup — рахунок поповнено; plus_renewed — GameCon+ продовжено з рахунку;
 *  plus_renewal_failed — для продовження не вистачає коштів.
 */
class BillingNotice extends Notification
{
    public function __construct(
        public readonly string $kind,
        public readonly string $text,
        public readonly string $url = '/plus/billing',
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'text' => $this->text,
            'excerpt' => null,
            'url' => $this->url,
        ];
    }
}

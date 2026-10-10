<?php

namespace App\Listeners;

use App\Services\Plus\Billing;
use Illuminate\Events\Dispatcher;
use Laravel\Paddle\Events\SubscriptionCanceled;
use Laravel\Paddle\Events\SubscriptionCreated;
use Laravel\Paddle\Events\SubscriptionPaused;
use Laravel\Paddle\Events\SubscriptionUpdated;
use Laravel\Paddle\Events\TransactionCompleted;
use Laravel\Paddle\Events\WebhookReceived;

/**
 * Події Cashier Paddle → GameCon+. Cashier уже перевірив підпис вебхука (PADDLE_WEBHOOK_SECRET)
 * і записав підписку/транзакцію у свої таблиці; тут — синхронізація періодів GameCon+ (plus_until).
 */
class PaddleEvents
{
    public function __construct(private readonly Billing $billing) {}

    public function created(SubscriptionCreated $event): void
    {
        $this->billing->subscription($event->subscription, $event->payload);
    }

    public function updated(SubscriptionUpdated $event): void
    {
        $this->billing->subscription($event->subscription, $event->payload);
    }

    public function paused(SubscriptionPaused $event): void
    {
        $this->billing->subscription($event->subscription, $event->payload);
    }

    public function canceled(SubscriptionCanceled $event): void
    {
        $this->billing->subscription($event->subscription, $event->payload);
    }

    public function transaction(TransactionCompleted $event): void
    {
        $this->billing->transaction($event->transaction, $event->payload);
    }

    /** Повернення коштів Cashier не обробляє — ловимо сирі adjustment.* події. */
    public function webhook(WebhookReceived $event): void
    {
        if (str_starts_with((string) ($event->payload['event_type'] ?? ''), 'adjustment.')) {
            $this->billing->adjustment($event->payload);
        }
    }

    /**
     * @return array<class-string, string>
     */
    public function subscribe(Dispatcher $events): array
    {
        return [
            SubscriptionCreated::class => 'created',
            SubscriptionUpdated::class => 'updated',
            SubscriptionPaused::class => 'paused',
            SubscriptionCanceled::class => 'canceled',
            TransactionCompleted::class => 'transaction',
            WebhookReceived::class => 'webhook',
        ];
    }
}

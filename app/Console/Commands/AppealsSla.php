<?php

namespace App\Console\Commands;

use App\Models\Appeal;
use App\Models\User;
use App\Notifications\AccountNotice;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/** Оскарження без відповіді довше за SLA — нагадуємо адміністраторам (раз на кожне). */
class AppealsSla extends Command
{
    protected $signature = 'appeals:sla';

    protected $description = 'Нагадати адміністраторам про прострочені оскарження';

    public function handle(): int
    {
        $overdue = Appeal::query()->where('status', Appeal::PENDING)->where('created_at', '<', now()->subHours(Appeal::SLA_HOURS))->get()
            ->filter(fn (Appeal $a) => Cache::add("appeal-sla:{$a->id}", true, now()->addDays(30)));
        if ($overdue->isEmpty()) {
            return self::SUCCESS;
        }
        $admins = User::query()->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MODERATOR])->whereNull('banned_at')->get();
        foreach ($admins as $admin) {
            $admin->notify(new AccountNotice('appeal_sla', null, 'Прострочені оскарження: '.$overdue->count(), 'Люди чекають відповіді довше '.Appeal::SLA_HOURS.' год.', '/admin/moderation#appeals'));
        }
        $this->info('Overdue: '.$overdue->count());

        return self::SUCCESS;
    }
}

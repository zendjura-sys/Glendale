<?php

namespace App\Console\Commands;

use App\Models\Family;
use App\Services\Families\FamilyBank;
use App\Services\Families\WeeklyDigest;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('families:tick {--digest : Надіслати тижневий звіт виплат} {--force : Надіслати навіть якщо вже надсилали цього тижня} {--family= : Лише для сім’ї з цим slug}')]
#[Description('Виплата депозитів і тижневий звіт виплат сімей')]
class FamiliesTick extends Command
{
    public function handle(FamilyBank $bank, WeeklyDigest $digest): int
    {
        $this->info('Депозитів виплачено: '.$bank->matureDue());

        if (! $this->option('digest')) {
            return self::SUCCESS;
        }

        $families = Family::query()
            ->where('status', Family::STATUS_VERIFIED)
            ->when($this->option('family'), fn ($q, $slug) => $q->where('slug', $slug))
            ->get();

        foreach ($families as $family) {
            $result = $digest->send($family, (bool) $this->option('force'));
            $this->line("  [{$family->tag}] {$family->name}: ".($result === null ? 'вже надіслано' : json_encode($result)));
        }

        return self::SUCCESS;
    }
}

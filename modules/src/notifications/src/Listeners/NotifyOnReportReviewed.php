<?php

namespace Addons\Notifications\Listeners;

use Addons\Bonuses\Services\BonusCalculator;
use Addons\Notifications\Services\NotificationService;
use Addons\Reports\Models\Report;
use App\Models\User;

/**
 * Слухає report.reviewed від Reports (якщо він встановлений і активний —
 * див. коментар у routes/events.php). Створює особисте сповіщення автору
 * звіту (web + push), нічого не блокує в основному
 * потоці Reports.
 *
 * Раніше текст був голим "Звіт (contract) затверджено" — людина не бачила
 * ні хто перевіряв, ні яку оцінку отримала, ні як це відбилось на премії.
 * Тепер збираємо повну картину одним повідомленням.
 */
class NotifyOnReportReviewed
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

    public function handle($event): void
    {
        $report = $event->report;
        $user = User::find($report->user_id);
        if (! $user) {
            return;
        }

        $approved = $report->status === 'approved';
        $lines = ["Звіт «{$this->typeLabel($report->type)}» ".($approved ? 'затверджено' : 'відхилено').'.'];

        if ($detail = $this->reportDetail($report)) {
            $lines[] = $detail;
        }

        if ($reviewer = $report->reviewer) {
            $lines[] = $reviewer->verb('Перевірив', 'Перевірила').": {$reviewer->name}.";
        }

        if ($approved && $report->grade) {
            $lines[] = $this->gradeLine($report);
        }

        if ($report->review_note) {
            $lines[] = ($approved ? 'Коментар' : 'Причина').": {$report->review_note}.";
        }

        // Bonuses — опційна залежність (class_exists, як і решта
        // міжмодульних читань): якщо не встановлено, просто немає цього
        // рядка. "Прогноз", а не "ви отримаєте" — сума рахується по всіх
        // звітах тижня разом, а не по цьому одному, і може ще зміняться.
        if ($approved && class_exists(BonusCalculator::class)) {
            $lines[] = $this->weeklyBonusLine($user);
        }

        $this->notifications->notify(
            $user,
            'report_reviewed',
            'Ваш звіт розглянуто',
            implode("\n", $lines),
        );
    }

    private function typeLabel(string $type): string
    {
        return match ($type) {
            'kapt' => 'Капт',
            'contract' => 'Контракт',
            'bizwar' => 'Бізвар',
            'investment' => 'Інвестиції',
            default => 'Інше',
        };
    }

    private function reportDetail(Report $report): ?string
    {
        $date = $report->report_date?->format('d.m.Y');

        return match ($report->type) {
            'bizwar' => sprintf(
                '%s: %d–%d%s',
                $date,
                $report->wins_count ?? 0,
                $report->losses_count ?? 0,
                $report->kapt_times ? ' ('.implode(', ', $report->kapt_times).')' : '',
            ),
            'contract' => $report->weight !== null
                // Історичний формат: один звіт — один контракт однієї ваги.
                ? sprintf('%s: контракт (%s)', $date, $report->weight)
                : sprintf(
                    '%s: легкий ×%d, середній ×%d, важкий ×%d',
                    $date,
                    $report->light_count ?? 0,
                    $report->medium_count ?? 0,
                    $report->heavy_count ?? 0,
                ),
            'investment' => sprintf('Сума: %s₴', number_format($report->amount ?? 0, 0, ',', ' ')),
            default => $report->description,
        };
    }

    private function gradeLine(Report $report): string
    {
        $modifier = Report::GRADE_MODIFIERS[$report->grade] ?? 0;
        $pct = (int) round($modifier * 100);
        $pctLabel = $pct === 0 ? 'без змін до премії' : sprintf('%s%d%% до премії', $pct > 0 ? '+' : '', $pct);

        $reason = $report->grade_reason ? " — {$report->grade_reason}" : '';

        return "Оцінка: {$report->grade} ({$pctLabel}){$reason}.";
    }

    private function weeklyBonusLine(User $user): string
    {
        $preview = app(BonusCalculator::class)->previewCurrentWeek($user);
        $total = number_format($preview['total_amount'] ?? 0, 0, ',', ' ');

        return "Поточний прогноз премії за цей тиждень: {$total}₴.";
    }
}

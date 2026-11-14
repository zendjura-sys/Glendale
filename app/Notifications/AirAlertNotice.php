<?php

namespace App\Notifications;

use App\Services\Alerts\UkraineAlarm;
use App\Support\NotifyPrefs;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * Початок чи відбій тривоги за даними UkraineAlarm v3 — приходить і в тихі години.
 * 🔴 червона — в укриття; 🟡 жовта — увага (зокрема локальна тривога в районі); 🟢 відбій — з тривалістю.
 */
class AirAlertNotice extends Notification
{
    /**
     * @param  string  $region  назва регіону з довідника API
     * @param  string|null  $at  час події — коли опитування/вебхук API побачили зміну (не час роботи черги)
     * @param  bool  $local  тривога лише в районі чи громаді всередині обраної області
     * @param  string|null  $alertKey  ключ пари «початок + відбій» (відбій оновлює той самий рядок)
     * @param  string|null  $since  lastUpdate початку з API
     * @param  bool  $silent  лише рядок у дзвіночку, без пушу
     */
    public function __construct(
        public readonly bool $started,
        public readonly string $region,
        public readonly string $type = 'AIR',
        public readonly ?string $at = null,
        public readonly bool $local = false,
        public readonly ?string $alertKey = null,
        public readonly ?string $since = null,
        public readonly bool $silent = false,
        /** Повітряна тривога: yellow — лише БпЛА, red — ракети (чи невідомо). */
        public readonly string $airLevel = 'red',
        /** Та сама тривога, але API підвищив рівень із жовтого до червоного. */
        public readonly bool $raised = false,
        /** Підпис додаткового місця («Мама», «Робота»). */
        public readonly ?string $label = null,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return NotifyPrefs::channels($notifiable, 'air_alert', honorQuiet: false);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $type = UkraineAlarm::type($this->type);
        $severity = UkraineAlarm::severity($type, $this->local, $this->airLevel);
        $level = match (true) {
            $this->raised => ': рівень підвищено до червоного',
            $type !== 'AIR' || ! $this->started => '',
            $this->airLevel === 'yellow' => ' (жовтий рівень · БпЛА)',
            default => ' (червоний рівень)',
        };
        $name = UkraineAlarm::TYPES[$type][$this->started ? 0 : 1].$level.($this->local && $this->started ? ' · локально' : '');
        $at = $this->at ?? now()->toIso8601String();
        $minutes = $this->minutes($at);

        return [
            'kind' => $this->started ? 'air_alert' : 'air_alert_end',
            'raised' => $this->raised,
            'actor_id' => null,
            'text' => ($this->label !== null ? $this->label.' — ' : '').($this->raised ? UkraineAlarm::TYPES['AIR'][0].' · '.$this->region.$level : $name.': '.$this->region),
            'place_label' => $this->label,
            'excerpt' => match (true) {
                $this->raised => 'Ракетна небезпека — негайно в укриття',
                ! $this->started => ($minutes !== null ? 'Тривала '.self::duration($minutes).' · ' : '').'можна виходити з укриття',
                $type === 'AIR' && $this->airLevel === 'yellow' && ! $this->local => 'Загроза БпЛА — пройдіть в укриття',
                $severity === 'red' => 'Негайно пройдіть в укриття',
                $this->local => 'Увага: тривога в частині області',
                default => 'Увага: підвищена небезпека',
            },
            'alert_type' => $type,
            'severity' => $this->started ? $severity : 'clear',
            // Колір картки за типом (AIR червоний/жовтий, артобстріл помаранчевий, бої салатові, хімічна фіолетова,
            // радіаційна жовта з чорними смугами); відбій — смарагдовий.
            'accent' => $this->started ? UkraineAlarm::accent($type, $this->airLevel) : '#10B981',
            'striped' => $this->started && $type === 'NUCLEAR',
            'air_level' => $type === 'AIR' ? $this->airLevel : null,
            'start_severity' => $severity,
            'local' => $this->local,
            'region' => $this->region,
            'alert_key' => $this->alertKey,
            'started_at' => $this->since,
            'event_at' => $at,
            'duration_min' => $this->started ? null : $minutes,
            'silent' => $this->silent,
            'url' => '/alerts',
        ];
    }

    private function minutes(string $at): ?int
    {
        if ($this->since === null) {
            return null;
        }
        try {
            return max(0, intdiv(CarbonImmutable::parse($at)->getTimestamp() - CarbonImmutable::parse($this->since)->getTimestamp(), 60));
        } catch (Throwable) {
            return null;
        }
    }

    public static function duration(int $minutes): string
    {
        return $minutes >= 60 ? intdiv($minutes, 60).' год '.str_pad((string) ($minutes % 60), 2, '0', STR_PAD_LEFT).' хв' : $minutes.' хв';
    }
}

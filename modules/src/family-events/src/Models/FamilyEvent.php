<?php

namespace Addons\FamilyEvents\Models;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FamilyEvent extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'family_events';

    protected $fillable = ['title', 'description', 'location', 'starts_at', 'created_by', 'reminder_sent_at', 'soon_reminder_sent_at'];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'reminder_sent_at' => 'datetime',
            'soon_reminder_sent_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function rsvps(): HasMany
    {
        return $this->hasMany(FamilyEventRsvp::class);
    }

    public function rsvpStatusFor(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        return $this->rsvps->firstWhere('user_id', $user->id)?->status;
    }

    public function isPast(): bool
    {
        return $this->starts_at->lt(self::nowAsStored());
    }

    /**
     * "Зараз" у тому самому "наївному" вигляді, що й starts_at: адмін
     * вводить час за Києвом через picker, а app.timezone цього проєкту —
     * UTC, тож Laravel зберігає київські цифри без конвертації, просто
     * позначені як UTC. Звичайний now() — це СПРАВЖНІЙ UTC, і порівняння
     * з ним заднім числом зсуває результат на офсет Києва (2-3 години,
     * залежно від літнього/зимового часу) — подія могла здаватись
     * майбутньою чи минулою не в той момент.
     */
    public static function nowAsStored(): Carbon
    {
        return Carbon::parse(now('Europe/Kyiv')->format('Y-m-d H:i:s'), 'UTC');
    }
}

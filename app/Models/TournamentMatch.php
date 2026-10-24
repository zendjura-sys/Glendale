<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Матч сітки: раунд від 1, слот — місце в раунді; переможець іде в слот floor(slot/2) наступного раунду.
 *
 * @property int $id
 * @property int $tournament_id
 * @property int $round
 * @property int $slot
 * @property int|null $a_entry_id
 * @property int|null $b_entry_id
 * @property int|null $winner_entry_id
 * @property string|null $score
 */
#[Fillable(['tournament_id', 'round', 'slot', 'a_entry_id', 'b_entry_id', 'winner_entry_id', 'score'])]
class TournamentMatch extends Model
{
    protected function casts(): array
    {
        return ['round' => 'integer', 'slot' => 'integer'];
    }
}

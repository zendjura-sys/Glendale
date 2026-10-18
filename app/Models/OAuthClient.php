<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $gta_server_id
 * @property int|null $created_by
 * @property string $name
 * @property string $client_id
 * @property string $secret_hash
 * @property list<string> $redirect_uris
 * @property Carbon|null $revoked_at
 * @property Carbon $created_at
 * @property-read GtaServer $server
 */
#[Fillable(['gta_server_id', 'created_by', 'name', 'client_id', 'secret_hash', 'redirect_uris', 'revoked_at'])]
class OAuthClient extends Model
{
    protected $table = 'oauth_clients';

    protected function casts(): array
    {
        return ['redirect_uris' => 'array', 'revoked_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }
}

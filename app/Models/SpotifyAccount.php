<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $spotify_id
 * @property string|null $display_name
 * @property string|null $avatar_url
 * @property string|null $product
 * @property string|null $country
 * @property string $access_token
 * @property string|null $refresh_token
 * @property Carbon|null $expires_at
 * @property string|null $scopes
 * @property bool $show_now_playing
 * @property-read User $user
 */
#[Fillable(['spotify_id', 'display_name', 'avatar_url', 'product', 'country', 'access_token', 'refresh_token', 'expires_at', 'scopes', 'show_now_playing'])]
#[Hidden(['access_token', 'refresh_token'])]
class SpotifyAccount extends Model
{
    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'expires_at' => 'datetime',
            'show_now_playing' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPremium(): bool
    {
        return $this->product === 'premium';
    }

    public function tokenExpired(): bool
    {
        return $this->expires_at === null || $this->expires_at->subMinute()->isPast();
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'spotify_id' => $this->spotify_id,
            'display_name' => $this->display_name,
            'avatar_url' => $this->avatar_url,
            'product' => $this->product,
            'premium' => $this->isPremium(),
            'show_now_playing' => $this->show_now_playing,
            'profile_url' => 'https://open.spotify.com/user/'.$this->spotify_id,
        ];
    }
}

<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Відмітки переглянутих серій окремо від «я зараз на цій серії».
 */
class EpisodeMarks
{
    /**
     * @return list<string>
     */
    public function keys(User $user, Movie $movie): array
    {
        return DB::table('movie_episode_marks')
            ->where('user_id', $user->id)
            ->where('movie_id', $movie->id)
            ->orderBy('season')
            ->orderBy('episode')
            ->get(['season', 'episode'])
            ->map(fn ($row) => $row->season.':'.$row->episode)
            ->all();
    }

    /**
     * @return list<string>
     */
    public function toggle(User $user, Movie $movie, int $season, int $episode): array
    {
        $query = DB::table('movie_episode_marks')
            ->where('user_id', $user->id)
            ->where('movie_id', $movie->id)
            ->where('season', $season)
            ->where('episode', $episode);

        if ($query->exists()) {
            $query->delete();
        } else {
            DB::table('movie_episode_marks')->insert([
                'user_id' => $user->id,
                'movie_id' => $movie->id,
                'season' => $season,
                'episode' => $episode,
            ]);
        }

        return $this->keys($user, $movie);
    }
}

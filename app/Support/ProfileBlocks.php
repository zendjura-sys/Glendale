<?php

namespace App\Support;

class ProfileBlocks
{
    /** @var list<string> */
    public const ORDER = ['platforms', 'steam', 'about', 'achievements', 'audio', 'friends', 'photos'];

    /**
     * @return list<string>
     */
    public static function normalize(mixed $stored): array
    {
        $picked = [];
        if (is_array($stored)) {
            foreach ($stored as $key) {
                if (is_string($key) && in_array($key, self::ORDER, true) && ! in_array($key, $picked, true)) {
                    $picked[] = $key;
                }
            }
        }
        foreach (self::ORDER as $key) {
            if (! in_array($key, $picked, true)) {
                $picked[] = $key;
            }
        }

        return $picked;
    }
}

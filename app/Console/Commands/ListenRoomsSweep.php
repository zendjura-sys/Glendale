<?php

namespace App\Console\Commands;

use App\Services\Music\ListenRooms;
use Illuminate\Console\Command;

/** Кімнати «Слухати разом», де вже 10 хвилин ніхто не слухає, завершуються. */
class ListenRoomsSweep extends Command
{
    protected $signature = 'listen:sweep';

    protected $description = 'Завершити порожні кімнати «Слухати разом»';

    public function handle(ListenRooms $rooms): int
    {
        $count = $rooms->sweep();
        if ($count > 0) {
            $this->info("Завершено кімнат: {$count}");
        }

        return self::SUCCESS;
    }
}

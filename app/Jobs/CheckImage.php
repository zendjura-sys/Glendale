<?php

namespace App\Jobs;

use App\Models\Photo;
use App\Models\PostAttachment;
use App\Services\Moderation\NsfwCheck;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Автоперевірка завантаженого фото (через чергу — завантаження не чекає). */
class CheckImage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 2;

    public function __construct(public readonly string $kind, public readonly int $id) {}

    public function handle(NsfwCheck $check): void
    {
        if ($this->kind === 'photo' && ($photo = Photo::query()->find($this->id))) {
            $check->checkPhoto($photo);
        } elseif ($this->kind === 'post_image' && ($attachment = PostAttachment::query()->find($this->id))) {
            $check->checkPostImage($attachment);
        }
    }
}

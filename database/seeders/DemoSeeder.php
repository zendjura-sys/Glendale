<?php

namespace Database\Seeders;

use App\Models\Comment;
use App\Models\Friendship;
use App\Models\Like;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Демонстраційне наповнення для локальної розробки й скриншотів.
 * php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    private const PEOPLE = [
        ['Марк', 'Шевченко', 'male', 'Київ', 'Засновник GameCon. Кіно, ігри, код.'],
        ['Олена', 'Коваленко', 'female', 'Львів', 'Стрімлю інді-ігри щовечора 🎮'],
        ['Андрій', 'Бондаренко', 'male', 'Харків', 'Кіберспорт · CS2 · Dota 2'],
        ['Софія', 'Мельник', 'female', 'Одеса', 'Аніме, косплей і кава'],
        ['Дмитро', 'Ткаченко', 'male', 'Дніпро', 'Геймдизайнер. Unreal Engine 5'],
        ['Анастасія', 'Кравченко', 'female', 'Київ', 'Кінокритик-аматор'],
        ['Максим', 'Олійник', 'male', 'Запоріжжя', 'Ретро-консолі та пікселі'],
        ['Вікторія', 'Шевчук', 'female', 'Вінниця', 'Малюю концепт-арт'],
        ['Іван', 'Поліщук', 'male', 'Полтава', 'Speedrun · Souls-like'],
        ['Катерина', 'Бойко', 'female', 'Чернігів', 'Серіали — моє все'],
        ['Олександр', 'Лисенко', 'male', 'Житомир', 'Збираю ПК і ламаю рекорди'],
        ['Юлія', 'Савченко', 'female', 'Ужгород', 'Настолки та D&D майстер'],
        ['Богдан', 'Руденко', 'male', 'Тернопіль', 'Фантаст і мрійник'],
        ['Дарина', 'Марченко', 'female', 'Суми', 'K-drama addicted'],
        ['Тарас', 'Гончаренко', 'male', 'Івано-Франківськ', 'Музика, synthwave, ігри'],
        ['Ірина', 'Павленко', 'female', 'Черкаси', 'Фотографую нічне місто'],
    ];

    private const POSTS = [
        'Нарешті пройшов Elden Ring на 100%. 168 годин, 0 шкодувань. Хто наступний — Malenia чи Messmer? 🔥',
        'Переглянули вчора «Дюну: Частину 2» в IMAX. Звук пробирає до кісток. Віллньов — геній.',
        'Збираю команду на турнір GameCon Cup 5×5 у CS2. Пишіть у коментарі свій ранг 👇',
        'Мій новий сетап: OLED 240 Гц, механіка на лінійних світчах і нарешті нормальне крісло. Спина каже дякую.',
        'Хто вже дивився новий сезон «Атаки титанів»? Без спойлерів, але фінал серії — це щось.',
        'Малюю концепт-арт для інді-гри друзів. Як вам атмосфера? Хочу ще більше неону.',
        'Ретро-вечір: Sega Mega Drive, Sonic 2 і пицца. Ностальгія рівня 100.',
        'Порада дня: вимикайте вертикальну синхронізацію в змагальних іграх і ставте ліміт кадрів на 3 нижче частоти монітора.',
        'Нічний Київ з даху. Іноді місто красивіше за будь-яку гру.',
        'Тиждень без соцмереж закінчився. Повертаюся сюди, бо тут цікавіше 😄',
        'Запустили з друзями D&D кампанію у світі кіберпанку. Мій персонаж — хакер-бард.',
        'Хто грає в Baldur\'s Gate 3 у коопі? Шукаю пару на тактичний режим.',
        'Добірка аніме на вихідні: «Магічна битва», «Фрірен», «Ванпанчмен». Що додасте?',
        'Спідран Hollow Knight: новий особистий рекорд — 42:17. Ще трохи до 40!',
        'Synthwave-плейлист для нічного кодингу готовий. Скинути посилання?',
        'Кінорецензія: «Тіні сакури» — красиво, атмосферно, але другий акт затягнутий. 7.5/10.',
    ];

    private const COMMENTS = [
        'Підтримую на всі 100!', 'Оце так рівень 🔥', 'А я ще не пробував, треба спробувати', 'Візьміть мене в команду!',
        'Неймовірно красиво', 'Скинь посилання, будь ласка', 'Згоден, фінал був сильний', 'Плюсую, топ',
        'Коли стрім?', 'Це шедевр', 'Хочу так само 😍', 'Дякую за пораду, допомогло!',
    ];

    public function run(): void
    {
        $this->call(DatabaseSeeder::class);

        $users = collect(self::PEOPLE)->map(function (array $person, int $i) {
            [$first, $last, $gender, $city, $status] = $person;
            $username = $i === 0 ? 'mark' : preg_replace('/[^a-z0-9.]/', '', Str::lower(Str::transliterate($first.'.'.$last)));

            $user = User::query()->updateOrCreate(['username' => $username], [
                'first_name' => $first,
                'last_name' => $last,
                'name' => $first.' '.$last,
                'email' => $i === 0 ? 'admin@gamecon.test' : $username.'@gamecon.test',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'gender' => $gender,
                'city' => $city,
                'status' => $status,
                'about' => $i === 0 ? 'Будую соцмережу, в якій хочеться жити. Люблю аніме, кіберспорт і хороше кіно.' : null,
                'birthday' => now()->subYears(random_int(19, 34))->setMonth(random_int(1, 12))->setDay(random_int(1, 28)),
                'role' => $i === 0 ? User::ROLE_ADMIN : User::ROLE_USER,
                'is_verified' => in_array($i, [0, 1, 3], true),
                'last_seen_at' => $i % 3 === 0 ? now() : now()->subHours(random_int(1, 72)),
                'created_at' => now()->subDays(random_int(1, 29)),
            ]);

            $avatar = $this->download(
                sprintf('https://randomuser.me/api/portraits/%s/%d.jpg', $gender === 'male' ? 'men' : 'women', 10 + $i * 3),
                "demo/avatars/{$username}.jpg",
            );
            $cover = $this->download("https://picsum.photos/seed/gc-cover-{$i}/1920/560", "demo/covers/{$username}.jpg");
            $user->forceFill(['avatar_path' => $avatar, 'cover_path' => $cover])->saveQuietly();

            return $user;
        });

        $mark = $users->first();

        foreach ($users->slice(1, 11) as $friend) {
            $this->befriend($mark, $friend);
        }
        foreach ($users->slice(1)->values() as $i => $user) {
            foreach ($users->slice(1)->values()->slice($i + 1, 3) as $other) {
                $this->befriend($user, $other);
            }
        }
        foreach ($users->slice(12) as $stranger) {
            Friendship::query()->firstOrCreate(
                ['requester_id' => $stranger->id, 'addressee_id' => $mark->id],
                ['status' => Friendship::PENDING],
            );
        }

        foreach (self::POSTS as $i => $body) {
            $author = $users[$i % $users->count()];
            $post = Post::query()->create([
                'author_id' => $author->id,
                'wall_type' => 'user',
                'wall_id' => $author->id,
                'body' => $body,
                'visibility' => $i % 5 === 4 ? Post::VISIBILITY_FRIENDS : Post::VISIBILITY_PUBLIC,
                'is_pinned' => $i === 0 && $author->is($mark),
                'views_count' => random_int(120, 4800),
                'created_at' => now()->subHours(($i * 5) + random_int(0, 4))->subMinutes(random_int(0, 59)),
            ]);

            $imageCount = [1, 0, 0, 1, 0, 3, 1, 0, 1, 0, 2, 0, 0, 0, 0, 1][$i];
            for ($n = 0; $n < $imageCount; $n++) {
                $path = $this->download("https://picsum.photos/seed/gc-post-{$i}-{$n}/1280/860", "demo/posts/{$i}-{$n}.jpg");
                if ($path) {
                    $post->attachments()->create([
                        'type' => PostAttachment::TYPE_IMAGE,
                        'path' => $path,
                        'mime' => 'image/jpeg',
                        'width' => 1280,
                        'height' => 860,
                        'position' => $n,
                    ]);
                }
            }

            $likers = $users->shuffle()->take(random_int(2, $users->count() - 1));
            foreach ($likers as $liker) {
                Like::query()->firstOrCreate(['user_id' => $liker->id, 'likeable_type' => 'post', 'likeable_id' => $post->id]);
            }

            $commenters = $users->shuffle()->take(random_int(0, 4));
            foreach ($commenters as $k => $commenter) {
                Comment::query()->create([
                    'post_id' => $post->id,
                    'user_id' => $commenter->id,
                    'body' => self::COMMENTS[($i + $k) % count(self::COMMENTS)],
                    'created_at' => $post->created_at->addMinutes(10 + $k * 7),
                ]);
            }

            $post->forceFill([
                'likes_count' => $post->likes()->count(),
                'comments_count' => $post->comments()->count(),
            ])->saveQuietly();
        }
    }

    private function befriend(User $a, User $b): void
    {
        $exists = Friendship::query()
            ->where(fn ($q) => $q->where('requester_id', $a->id)->where('addressee_id', $b->id))
            ->orWhere(fn ($q) => $q->where('requester_id', $b->id)->where('addressee_id', $a->id))
            ->exists();

        if (! $exists) {
            Friendship::query()->create([
                'requester_id' => $a->id,
                'addressee_id' => $b->id,
                'status' => Friendship::ACCEPTED,
                'accepted_at' => now()->subDays(random_int(1, 20)),
            ]);
        }
    }

    private function download(string $url, string $path): ?string
    {
        $disk = Storage::disk('public');

        if ($disk->exists($path)) {
            return $path;
        }

        try {
            $response = Http::timeout(20)->retry(2, 300)->get($url);
            if ($response->successful()) {
                $disk->put($path, $response->body());

                return $path;
            }
        } catch (Throwable) {
        }

        return null;
    }
}

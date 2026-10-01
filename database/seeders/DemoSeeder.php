<?php

namespace Database\Seeders;

use App\Models\Comment;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Friendship;
use App\Models\Like;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\Sticker;
use App\Models\StickerPack;
use App\Models\User;
use App\Services\CommunityService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
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

    private const NOTO_STICKERS = [
        '1f60e' => '😎', '1f602' => '😂', '1f60d' => '😍', '1f973' => '🥳', '1f914' => '🤔', '1f62d' => '😭',
        '1f621' => '😡', '1f631' => '😱', '1f44d' => '👍', '1f44f' => '👏', '1f525' => '🔥', '1f4af' => '💯',
        '2764_fe0f' => '❤️', '1f389' => '🎉', '1f680' => '🚀', '1f47b' => '👻', '1f916' => '🤖', '1f929' => '🤩',
        '1f3c6' => '🏆', '1f60f' => '😏', '1f644' => '🙄', '1f634' => '😴', '1f92f' => '🤯', '1f970' => '🥰',
    ];

    private const GAMER_STICKERS = [
        ['GG', '🤝', '#4f8bff', '#a855f7'], ['EZ', '😎', '#22d3a6', '#38e1ff'], ['GL HF', '🍀', '#38e1ff', '#6d5dfc'],
        ['AFK', '😴', '#64748b', '#a855f7'], ['RAGE', '😡', '#ff4d6d', '#f04fd8'], ['CLUTCH', '🔥', '#ff7a59', '#f04fd8'],
        ['NOOB', '🙈', '#facc15', '#ff7a59'], ['1v1?', '⚔️', '#6d5dfc', '#f04fd8'], ['LOL', '😂', '#f04fd8', '#a855f7'],
        ['WP', '👏', '#22d3a6', '#4f8bff'], ['LAG', '🐢', '#38e1ff', '#22d3a6'], ['GO!', '🚀', '#4f8bff', '#38e1ff'],
    ];

    private function seedStickers(): void
    {
        $noto = StickerPack::query()->firstOrCreate(['slug' => 'noto_animated'], ['name' => 'Емоції', 'author' => 'Google Noto Emoji (Apache 2.0)', 'position' => 1]);
        if (! $noto->stickers()->exists()) {
            $position = 0;
            foreach (self::NOTO_STICKERS as $code => $emoji) {
                $path = $this->download("https://fonts.gstatic.com/s/e/notoemoji/latest/{$code}/512.webp", "stickers/noto/{$code}.webp");
                if ($path) {
                    $noto->stickers()->create(['path' => $path, 'emoji' => $emoji, 'position' => $position++]);
                }
            }
        }

        $gamer = StickerPack::query()->firstOrCreate(['slug' => 'gamecon_gamer'], ['name' => 'GameCon Gamer', 'author' => 'GameCon', 'position' => 2]);
        if (! $gamer->stickers()->exists()) {
            foreach (self::GAMER_STICKERS as $position => [$label, $emoji, $from, $to]) {
                $path = 'stickers/gamecon/'.Str::slug($label ?: 'x', '_').'-'.$position.'.svg';
                Storage::disk('public')->put($path, $this->stickerSvg($label, $emoji, $from, $to, $position));
                $gamer->stickers()->create(['path' => $path, 'emoji' => $emoji, 'position' => $position]);
            }
        }
    }

    private function stickerSvg(string $label, string $emoji, string $from, string $to, int $seed): string
    {
        $rotate = [-6, 4, -3, 5, -4, 3][$seed % 6];
        $size = mb_strlen($label) > 4 ? 64 : 84;
        $label = htmlspecialchars($label, ENT_XML1);

        return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{$from}"/><stop offset="1" stop-color="{$to}"/></linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g transform="rotate({$rotate} 128 128)">
    <rect x="20" y="58" width="216" height="140" rx="42" fill="url(#g)" filter="url(#glow)" opacity="0.95"/>
    <rect x="20" y="58" width="216" height="140" rx="42" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="7"/>
    <text x="128" y="128" dy="0.36em" text-anchor="middle" font-family="Unbounded, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="{$size}" fill="#fff" stroke="#0b0f1f" stroke-opacity="0.25" stroke-width="2">{$label}</text>
  </g>
  <text x="206" y="74" text-anchor="middle" font-size="58" transform="rotate(12 206 60)">{$emoji}</text>
</svg>
SVG;
    }

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

        $this->seedStickers();
        Model::unguarded(fn () => $this->seedMessages($users->values()->all()));
        Model::unguarded(fn () => $this->seedCommunities($users->values()->all()));
    }

    /**
     * @param  list<User>  $u
     */
    private function seedCommunities(array $u): void
    {
        $service = app(CommunityService::class);

        $communities = [
            ['gamecon', 'GameCon Official', Community::TYPE_PUBLIC, Community::PRIVACY_OPEN, 'games', 'Офіційна сторінка мережі GameCon', 0, true, [
                'Ласкаво просимо до GameCon! Тут — новини платформи, турніри та оновлення. Підписуйтеся, щоб нічого не пропустити 🚀',
                'Оновлення: у месенджері тепер працюють індикатор набору тексту, статуси прочитання та групові чати.',
            ]],
            ['cs2_ukraine', 'CS2 Україна', Community::TYPE_GROUP, Community::PRIVACY_OPEN, 'esports', 'Пошук тіммейтів, турніри та хайлайти', 2, true, [
                'Щотижневий мікс 5×5 у суботу о 19:00. Записуйтеся в коментарях!',
                'Хто вже бачив новий патч? Мувмент знову змінили 😅',
            ]],
            ['anime_club', 'Аніме-клуб «Сакура»', Community::TYPE_GROUP, Community::PRIVACY_OPEN, 'anime', 'Обговорюємо онгоінги та класику', 3, false, [
                'Голосуємо: яке аніме дивимося разом у п’ятницю — «Фрірен» чи «Магічна битва»?',
            ]],
            ['kino_nights', 'Кіноночі', Community::TYPE_PUBLIC, Community::PRIVACY_OPEN, 'cinema', 'Добірки, рецензії та спільні перегляди', 5, false, [
                'Топ-5 фільмів жовтня, які варто подивитися на вихідних 🎬',
            ]],
            ['indie_dev', 'Інді-розробники UA', Community::TYPE_GROUP, Community::PRIVACY_CLOSED, 'it', 'Закрита спільнота для тих, хто робить ігри', 4, false, [
                'Ділимося білдами на джем. Дедлайн — неділя, 23:59.',
            ]],
            ['synthwave', 'Synthwave Radio', Community::TYPE_PUBLIC, Community::PRIVACY_OPEN, 'music', 'Неонова музика для нічних сесій', 14, false, [
                'Новий плейлист для нічного кодингу вже тут. Вмикайте гучніше 🌆',
            ]],
            ['retro_pixels', 'Ретро та пікселі', Community::TYPE_GROUP, Community::PRIVACY_OPEN, 'games', 'Консолі, картриджі та ностальгія', 6, false, []],
            ['dnd_kyiv', 'D&D Київ', Community::TYPE_GROUP, Community::PRIVACY_CLOSED, 'other', 'Настолки, кампанії та пошук майстрів', 11, false, []],
        ];

        foreach ($communities as $i => [$slug, $name, $type, $privacy, $category, $status, $ownerIndex, $verified, $posts]) {
            $community = Community::query()->where('slug', $slug)->first() ?? $service->create($u[$ownerIndex], [
                'slug' => $slug,
                'name' => $name,
                'type' => $type,
                'privacy' => $privacy,
                'wall' => $type === Community::TYPE_GROUP ? Community::WALL_OPEN : Community::WALL_CLOSED,
                'category' => $category,
                'status' => $status,
                'description' => $status.'. Тут ми ділимося новинами, допомагаємо одне одному та просто гарно проводимо час.',
                'city' => $u[$ownerIndex]->city,
                'is_verified' => $verified,
            ]);

            $avatar = $this->download("https://picsum.photos/seed/gc-community-{$slug}/400/400", "demo/communities/{$slug}.jpg");
            $cover = $this->download("https://picsum.photos/seed/gc-community-cover-{$slug}/1920/560", "demo/communities/{$slug}-cover.jpg");
            $community->forceFill(['avatar_path' => $avatar, 'cover_path' => $cover])->saveQuietly();

            foreach ($u as $k => $member) {
                if ($k === $ownerIndex || ($k + $i) % 3 === 0) {
                    continue;
                }

                $community->memberships()->firstOrCreate(['user_id' => $member->id], [
                    'role' => $k === ($ownerIndex + 1) % count($u) ? CommunityMember::ROLE_ADMIN : CommunityMember::ROLE_MEMBER,
                    'status' => $privacy === Community::PRIVACY_CLOSED && $k % 4 === 0 ? CommunityMember::STATUS_PENDING : CommunityMember::STATUS_ACTIVE,
                    'created_at' => now()->subDays(random_int(1, 25)),
                ]);
            }

            if ($slug !== 'gamecon' && ! $community->membershipFor($u[0])) {
                $community->memberships()->create(['user_id' => $u[0]->id, 'role' => CommunityMember::ROLE_MEMBER, 'status' => CommunityMember::STATUS_ACTIVE]);
            }

            $service->recount($community);

            foreach ($posts as $n => $body) {
                $post = Post::query()->create([
                    'author_id' => $u[$ownerIndex]->id,
                    'wall_type' => 'community',
                    'wall_id' => $community->id,
                    'as_community' => true,
                    'body' => $body,
                    'visibility' => Post::VISIBILITY_PUBLIC,
                    'is_pinned' => $n === 0 && $slug === 'gamecon',
                    'views_count' => random_int(300, 9000),
                    'created_at' => now()->subHours($i * 3 + $n * 7 + 1),
                ]);

                if ($n === 0) {
                    $path = $this->download("https://picsum.photos/seed/gc-cpost-{$slug}/1280/720", "demo/communities/post-{$slug}.jpg");
                    if ($path) {
                        $post->attachments()->create(['type' => PostAttachment::TYPE_IMAGE, 'path' => $path, 'mime' => 'image/jpeg', 'width' => 1280, 'height' => 720, 'position' => 0]);
                    }
                }

                foreach (collect($u)->shuffle()->take(random_int(3, 12)) as $liker) {
                    Like::query()->firstOrCreate(['user_id' => $liker->id, 'likeable_type' => 'post', 'likeable_id' => $post->id]);
                }

                $post->forceFill(['likes_count' => $post->likes()->count()])->saveQuietly();
            }
        }
    }

    /**
     * Демо-бесіди для Марка: особисті, групові, з фото, відповідями та непрочитаними.
     *
     * @param  list<User>  $u
     */
    private function seedMessages(array $u): void
    {
        [$mark, $olena, $andriy, $sofia, $dmytro, $nastia, $maksym, $vika, $ivan, $katia, $oleksandr] = $u;
        $daryna = $u[13];

        $olenaChat = $this->conversation([$mark, $olena]);
        $this->chat($olenaChat, [
            [$olena, 'Привіт! Бачила твій пост про Elden Ring 🔥', 190],
            [$mark, 'Привіт! Так, нарешті закрив на 100%. Malenia — це біль 😅', 186],
            [$olena, 'Я її з 47 спроби пройшла на стрімі, чат кричав 😂', 185],
            [$mark, 'Легенда. Скинь запис, гляну ввечері', 180],
            [$olena, 'Сьогодні о 21:00 стрімлю Hades II, заходь!', 6, 'reply' => 3],
            [$mark, null, 170, 'sticker' => '😂'],
            [$olena, null, 7, 'voice' => 9],
            [$olena, 'І ще: ми з командою шукаємо тестерів для нашої інді-гри. Хочеш спробувати?', 4],
            [$olena, null, 3, 'sticker' => '🥰'],
        ], readBy: [$mark->id => 5]);

        $cup = $this->conversation([$mark, $andriy, $dmytro, $ivan, $oleksandr], 'GameCon Cup · CS2');
        $this->chat($cup, [
            [null, 'Марк Шевченко створив бесіду «GameCon Cup · CS2»', 300],
            [$mark, 'Всім привіт! Збираємо склад на турнір. Реєстрація до п’ятниці', 299],
            [$andriy, 'Я в ділі. Беру AWP, як завжди 😎', 290],
            [$ivan, 'Можу на entry. Мій ранг — 18к Premier', 288],
            [$dmytro, 'Я на підтримці, флешки поставлю як в кіно', 287],
            [$oleksandr, 'А тренування коли? Пропоную середу та четвер о 20:00', 120],
            [$mark, 'Середа ок. Сервер організую 👍', 118, 'reply' => 6],
            [$andriy, 'Скинув нову розкидку гранат на Mirage, гляньте', 25, 'images' => 1],
            [$ivan, 'Топ! Тоді в середу відпрацюємо', 20],
            [$dmytro, 'Регламент турніру, гляньте до середи', 18, 'file' => 'Регламент GameCon Cup 2026.pdf'],
            [$andriy, 'Додамо п’ятого в запас? Ось контакт', 15],
            [$andriy, null, 15, 'contact' => $u[10]],
            [$mark, null, 14, 'sticker' => 'GG'],
            [$oleksandr, 'Я буду трохи пізніше, на 15 хв', 12],
            [$ivan, null, 11, 'voice' => 4],
        ], readBy: [$mark->id => 7]);

        $sofiaChat = $this->conversation([$mark, $sofia]);
        $this->chat($sofiaChat, [
            [$sofia, 'Марк, а коли модуль кіно запустите? Хочу дивитися аніме прямо тут 🥺', 1500],
            [$mark, 'Вже скоро! Наступним етапом після повідомлень', 1490],
            [$sofia, 'Ура! Тоді я першою зроблю добірку «Фрірен» і «Магічна битва»', 1480],
            [$mark, 'Домовились. Зробимо тобі значок кураторки 😉', 50],
            [$sofia, null, 48, 'sticker' => '🎉'],
        ], readBy: [$sofia->id => 5, $mark->id => 5]);

        $club = $this->conversation([$mark, $nastia, $katia, $daryna], 'Кіноклуб 🎬');
        $this->chat($club, [
            [null, 'Анастасія Кравченко створила бесіду «Кіноклуб 🎬»', 4000],
            [$nastia, 'Кіно-вечір у суботу: голосуємо! «Дюна 2» чи «Інтерстеллар»?', 300],
            [$katia, 'Дюна! Звук там неймовірний', 295],
            [$daryna, 'А я б щось корейське запропонувала 🙈', 290],
            [$nastia, 'Даринко, наступного разу — обіцяю 😄', 40],
        ], readBy: [$mark->id => 2], mutedFor: [$mark->id], ownerIndex: 1);

        $vikaChat = $this->conversation([$mark, $vika]);
        $this->chat($vikaChat, [
            [$vika, 'Привіт! Намалювала концепт для заставки GameCon', 3000],
            [$vika, null, 2999, 'images' => 2],
            [$mark, 'Вау, це неймовірно! Можна використати на головній?', 2990],
            [$vika, 'Звісно, буду рада 💜', 2980],
        ], readBy: [$mark->id => 4, $vika->id => 3]);

        $maksymChat = $this->conversation([$mark, $maksym]);
        $this->chat($maksymChat, [
            [$maksym, 'Знайшов на OLX Sega Saturn у ідеальному стані', 9000],
            [$mark, 'Бери не думаючи! Panzer Dragoon того вартий', 8990],
        ], readBy: [$mark->id => 2, $maksym->id => 2]);
    }

    /**
     * @param  list<User>  $members
     */
    private function conversation(array $members, ?string $title = null): Conversation
    {
        $owner = $members[0];

        $conversation = Conversation::query()->create([
            'type' => $title ? Conversation::TYPE_GROUP : Conversation::TYPE_DIRECT,
            'title' => $title,
            'owner_id' => $title ? $owner->id : null,
            'direct_key' => $title ? null : Conversation::directKey($members[0]->id, $members[1]->id),
        ]);

        foreach ($members as $member) {
            $conversation->participants()->create([
                'user_id' => $member->id,
                'role' => $title && $member->is($owner) ? ConversationParticipant::ROLE_OWNER : ConversationParticipant::ROLE_MEMBER,
                'joined_at' => now()->subDays(10),
            ]);
        }

        return $conversation;
    }

    /**
     * Рядки: [автор|null (системне), текст|null, хвилин тому, 'reply' => № рядка (з 1), 'images' => к-сть].
     *
     * @param  list<array<int|string, mixed>>  $lines
     * @param  array<int, int>  $readBy  user_id => № останнього прочитаного рядка
     * @param  list<int>  $mutedFor
     */
    private function chat(Conversation $conversation, array $lines, array $readBy = [], array $mutedFor = [], int $ownerIndex = 0): void
    {
        $ids = [];

        foreach ($lines as $n => $line) {
            [$author, $body, $minutesAgo] = $line;
            $at = now()->subMinutes($minutesAgo);

            $sticker = isset($line['sticker'])
                ? Sticker::query()->where('path', ($code = array_search($line['sticker'], self::NOTO_STICKERS, true)) ? "stickers/noto/{$code}.webp" : '')->first()
                    ?? Sticker::query()->where('path', 'like', 'stickers/gamecon/'.Str::slug($line['sticker'], '_').'-%')->first()
                : null;

            $message = Message::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => $author?->id,
                'type' => match (true) {
                    ! $author => Message::TYPE_SYSTEM,
                    $sticker !== null => Message::TYPE_STICKER,
                    isset($line['voice']) => Message::TYPE_VOICE,
                    isset($line['contact']) => Message::TYPE_CONTACT,
                    default => Message::TYPE_TEXT,
                },
                'body' => $body,
                'meta' => match (true) {
                    $sticker !== null => ['sticker' => ['id' => $sticker->id, 'path' => $sticker->path, 'emoji' => $sticker->emoji]],
                    isset($line['contact']) => ['contact_id' => $line['contact']->id],
                    default => null,
                },
                'reply_to_id' => isset($line['reply']) ? $ids[$line['reply'] - 1] : null,
                'created_at' => $at,
                'updated_at' => $at,
            ]);
            $ids[] = $message->id;

            if (isset($line['voice'])) {
                $path = $this->voiceSample((int) $line['voice'], $n);
                if ($path) {
                    $message->attachments()->create([
                        'type' => MessageAttachment::TYPE_VOICE,
                        'path' => $path,
                        'mime' => 'audio/webm',
                        'size' => Storage::disk('public')->size($path),
                        'duration' => $line['voice'],
                        'meta' => ['waveform' => $this->waveform($n)],
                    ]);
                }
            }

            if (isset($line['file'])) {
                $path = 'message-files/demo/'.Str::random(16).'.txt';
                Storage::disk(MessageAttachment::PRIVATE_DISK)->put($path, "GameCon Cup 2026\n\nФормат: 5×5, BO3, плей-оф BO5.\nРеєстрація до п'ятниці.\n");
                $message->attachments()->create([
                    'type' => MessageAttachment::TYPE_FILE,
                    'disk' => MessageAttachment::PRIVATE_DISK,
                    'path' => $path,
                    'name' => $line['file'],
                    'mime' => 'application/pdf',
                    'size' => 248_331,
                ]);
            }

            for ($k = 0; $k < ($line['images'] ?? 0); $k++) {
                $path = $this->download("https://picsum.photos/seed/gc-chat-{$conversation->id}-{$n}-{$k}/1200/800", "demo/messages/{$conversation->id}-{$n}-{$k}.jpg");
                if ($path) {
                    $message->attachments()->create([
                        'type' => MessageAttachment::TYPE_IMAGE,
                        'path' => $path,
                        'mime' => 'image/jpeg',
                        'width' => 1200,
                        'height' => 800,
                        'position' => $k,
                    ]);
                }
            }

            if ($author) {
                $readBy[$author->id] = max($readBy[$author->id] ?? 0, $n + 1);
            }
        }

        $last = Message::query()->find(end($ids));
        $conversation->forceFill(['last_message_id' => $last->id, 'last_message_at' => $last->created_at])->save();

        if ($conversation->isGroup() && $ownerIndex > 0) {
            $members = $conversation->participants()->orderBy('id')->get();
            $members->each->update(['role' => ConversationParticipant::ROLE_MEMBER]);
            $members[$ownerIndex]->update(['role' => ConversationParticipant::ROLE_OWNER]);
            $conversation->update(['owner_id' => $members[$ownerIndex]->user_id]);
        }

        foreach ($readBy as $userId => $line) {
            $conversation->participants()->where('user_id', $userId)->update(['last_read_message_id' => $ids[$line - 1]]);
        }

        if ($mutedFor) {
            $conversation->participants()->whereIn('user_id', $mutedFor)->update(['is_muted' => true]);
        }
    }

    /**
     * Синтетичний «голос» через ffmpeg, щоб у демо було що програвати.
     */
    private function voiceSample(int $seconds, int $seed): ?string
    {
        $path = "demo/voice/sample-{$seconds}-{$seed}.webm";
        $disk = Storage::disk('public');

        if ($disk->exists($path)) {
            return $path;
        }

        $disk->makeDirectory('demo/voice');
        $base = 150 + ($seed % 5) * 25;
        $filter = sprintf(
            'sine=f=%d:d=%d,vibrato=f=5.5:d=0.6,tremolo=f=3.2:d=0.85,volume=0.6[a];anoisesrc=d=%d:c=pink:a=0.04[n];[a][n]amix=inputs=2,afade=t=in:d=0.15,afade=t=out:st=%s:d=0.3',
            $base, $seconds, $seconds, max(0, $seconds - 0.3),
        );

        $result = Process::run(['ffmpeg', '-y', '-loglevel', 'error', '-filter_complex', $filter, '-c:a', 'libopus', '-b:a', '32k', $disk->path($path)]);

        return $result->successful() && $disk->exists($path) ? $path : null;
    }

    /**
     * @return list<int>
     */
    private function waveform(int $seed): array
    {
        mt_srand($seed + 7);

        return array_map(fn (int $i) => (int) round(18 + 70 * abs(sin($i / 3.1 + $seed)) * (0.55 + mt_rand(0, 45) / 100)), range(0, 47));
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

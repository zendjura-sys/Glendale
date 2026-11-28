<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** GameCast: каталог подарунків, паки з адмінськими назвами, інвентар, лайки й дарування в шоу. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gc_gifts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('emoji', 16);
            $table->string('rarity', 16); // trash…unique
            $table->string('flavor', 200)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('stock')->nullable(); // null = безліміт; 1 для unique
            $table->timestamps();
            $table->index(['rarity', 'is_active']);
        });

        Schema::create('gc_gift_packs', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80); // назву задає адмін
            $table->string('slug', 80)->unique();
            $table->string('description', 280)->nullable();
            $table->string('emoji', 16)->default('🎁');
            $table->unsignedInteger('price'); // копійки балансу
            $table->unsignedTinyInteger('gifts_count')->default(5); // скільки випадає з пака
            $table->json('odds'); // rarity => weight
            $table->unsignedTinyInteger('pity_after')->default(12); // гарантія rare+ після N «порожніх»
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('user_gc_gifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gc_gift_id')->constrained('gc_gifts')->cascadeOnDelete();
            $table->foreignId('gc_gift_pack_id')->nullable()->constrained('gc_gift_packs')->nullOnDelete();
            $table->string('status', 16)->default('ready'); // ready | gifted
            $table->timestamp('opened_at');
            $table->timestamp('gifted_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('live_show_gifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_show_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('gc_gift_id')->constrained('gc_gifts')->cascadeOnDelete();
            $table->foreignId('user_gc_gift_id')->nullable()->constrained('user_gc_gifts')->nullOnDelete();
            $table->timestamps();
            $table->index(['live_show_id', 'id']);
        });

        Schema::create('live_show_likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('live_show_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['live_show_id', 'from_user_id', 'to_user_id']);
        });

        Schema::create('user_gc_pack_pity', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gc_gift_pack_id')->constrained('gc_gift_packs')->cascadeOnDelete();
            $table->unsignedInteger('misses')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'gc_gift_pack_id']);
        });

        $now = now();
        $gifts = [
            ['Мусорний пакет', '🗑️', 'trash', 'Пахне як вчорашній рейд.', null],
            ['Зім’ята серветка', '🧻', 'trash', 'Хоч руки витерти.', null],
            ['Пластикова троянда', '🌹', 'common', 'Класика чату.', null],
            ['Оплески', '👏', 'common', 'Заслужено.', null],
            ['Свіжий мем', '🆕', 'fresh', 'Ще теплий з трендів.', null],
            ['Неоновий стікер', '✨', 'fresh', 'Блищить на сцені.', null],
            ['Буст мікрофона', '🎙️', 'advanced', '+3 до харизми.', null],
            ['Коронка гостя', '👑', 'advanced', 'На хвилину слави.', null],
            ['Кришталевий келих', '🥂', 'rare', 'За тост ведучому.', null],
            ['Золотий квиток', '🎫', 'rare', 'У перший ряд.', null],
            ['Епічний феєрверк', '🎆', 'epic', 'Зал ахнув.', null],
            ['Дракон ефіру', '🐉', 'epic', 'Рев у навушниках.', null],
            ['Легенда подкасту', '🏆', 'legendary', 'Ім’я в титрах.', null],
            ['Міфічний голос', '🌌', 'mythical', 'Чути крізь виміри.', null],
            ['Божественне сяйво', '👼', 'divine', 'Сцена спалахнула.', null],
            ['Серце GameCast', '💜', 'unique', 'Лише одне на весь світ.', 1],
            ['Ключ від студії', '🔑', 'unique', 'Унікальний артефакт ефіру.', 1],
        ];
        foreach ($gifts as [$name, $emoji, $rarity, $flavor, $stock]) {
            DB::table('gc_gifts')->insert([
                'name' => $name,
                'emoji' => $emoji,
                'rarity' => $rarity,
                'flavor' => $flavor,
                'is_active' => true,
                'stock' => $stock,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $odds = json_encode([
            'trash' => 2200,
            'common' => 2600,
            'fresh' => 1800,
            'advanced' => 1400,
            'rare' => 900,
            'epic' => 500,
            'legendary' => 220,
            'mythical' => 90,
            'divine' => 30,
            'unique' => 10,
        ], JSON_UNESCAPED_UNICODE);

        DB::table('gc_gift_packs')->insert([
            [
                'name' => 'Стартовий ефір',
                'slug' => 'starter-air',
                'description' => '5 випадкових подарунків для першого шоу.',
                'emoji' => '🎁',
                'price' => 4900,
                'gifts_count' => 5,
                'odds' => $odds,
                'pity_after' => 12,
                'is_active' => true,
                'position' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Глядацький аншлаг',
                'slug' => 'crowd-cheer',
                'description' => '10 подарунків із підвищеним шансом rare+.',
                'emoji' => '🎉',
                'price' => 14900,
                'gifts_count' => 10,
                'odds' => json_encode([
                    'trash' => 1200,
                    'common' => 2000,
                    'fresh' => 1800,
                    'advanced' => 1600,
                    'rare' => 1400,
                    'epic' => 900,
                    'legendary' => 500,
                    'mythical' => 250,
                    'divine' => 100,
                    'unique' => 50,
                ], JSON_UNESCAPED_UNICODE),
                'pity_after' => 8,
                'is_active' => true,
                'position' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('user_gc_pack_pity');
        Schema::dropIfExists('live_show_likes');
        Schema::dropIfExists('live_show_gifts');
        Schema::dropIfExists('user_gc_gifts');
        Schema::dropIfExists('gc_gift_packs');
        Schema::dropIfExists('gc_gifts');
    }
};

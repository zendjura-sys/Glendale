<?php

use App\Support\I18n\LanguageGuess;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('lang', 5)->nullable()->index();
        });

        // Мова вже опублікованих записів — за тим самим правилом, що й для нових.
        DB::table('posts')->whereNotNull('body')->orderBy('id')->select(['id', 'body'])->chunkById(500, function ($rows) {
            foreach ($rows as $row) {
                $lang = LanguageGuess::guess((string) $row->body);
                if ($lang !== null) {
                    DB::table('posts')->where('id', $row->id)->update(['lang' => $lang]);
                }
            }
        });

        Schema::create('feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->text('body');
            $table->string('url', 255)->nullable();
            $table->string('status', 16)->default('new');
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback');
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['lang']);
            $table->dropColumn('lang');
        });
    }
};

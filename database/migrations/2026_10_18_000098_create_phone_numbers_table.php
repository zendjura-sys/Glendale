<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Внутрішні номери GameCon (не пов’язані зі справжніми): +555 — випадкові безкоштовні, +777 — куплені.
 * Номер: код мережі + код оператора (01–99) + 7 цифр. Рівень (звичайний → діамантовий) рахується з цифр,
 * адміністратор може його змінити чи зарезервувати номер (phone_number_rules).
 * Дублікатів немає: код оператора + 7 цифр унікальні в усій мережі (незалежно від +555 / +777), тож
 * номер можна набрати й без коду мережі. Унікальність тримає індекс у базі — і від одночасних покупок.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('phone_numbers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('country', 4);
            $table->char('operator', 2);
            $table->char('digits', 7);
            $table->string('tier', 10)->default('regular');
            // random — безкоштовний випадковий; purchased — куплений.
            $table->string('kind', 10);
            // active — номер людини; pending — тримається, поки йде оплата (до hold_until).
            $table->string('status', 10)->default('active');
            $table->timestamp('hold_until')->nullable();
            $table->unsignedBigInteger('payment_id')->nullable()->index();
            $table->timestamps();
            $table->unique(['operator', 'digits']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('phone_number_rules', function (Blueprint $table) {
            $table->id();
            $table->char('operator', 2);
            $table->char('digits', 7);
            // Рівень замість автоматичного (null — рахувати з цифр).
            $table->string('tier', 10)->nullable();
            // Зарезервований: ні купити, ні отримати випадково.
            $table->boolean('reserved')->default(false);
            $table->string('note', 120)->nullable();
            $table->timestamps();
            $table->unique(['operator', 'digits']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phone_number_rules');
        Schema::dropIfExists('phone_numbers');
    }
};

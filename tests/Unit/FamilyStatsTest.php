<?php

namespace Tests\Unit;

use App\Models\User;
use App\Support\FamilyStats;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Реєстр реальних метрик з БД. Модулі родини тепер частина ядра, тож їхні
 * таблиці є й у тестовій базі; де перевіряється Schema::hasTable()-охорона
 * (метрика без таблиці просто зникає, а не падає "no such table"), таблиці
 * прибираються явно — withoutModuleTables().
 */
class FamilyStatsTest extends TestCase
{
    use RefreshDatabase;

    private function withoutModuleTables(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (['report_attachments', 'ai_report_reviews', 'reports', 'bonus_payouts', 'family_goals'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::enableForeignKeyConstraints();
    }

    public function test_members_metric_counts_only_non_union_users(): void
    {
        User::factory()->count(3)->create();
        User::factory()->create(['union_family_name' => 'Family Corvo']);

        $available = collect(FamilyStats::available())->keyBy('key');

        $this->assertSame(3, $available->get('members')['value']);
    }

    public function test_module_dependent_metrics_are_absent_without_their_table(): void
    {
        $this->withoutModuleTables();
        $keys = array_column(FamilyStats::available(), 'key');

        $this->assertNotContains('reports_total', $keys);
        $this->assertNotContains('bonuses_paid', $keys);
        $this->assertNotContains('goals_completed', $keys);
    }

    public function test_union_metrics_are_always_available_and_correct(): void
    {
        User::factory()->create(['union_family_name' => 'Family Corvo']);
        User::factory()->create(['union_family_name' => 'Family Corvo']);
        User::factory()->create(['union_family_name' => 'Family Del Rio']);

        $available = collect(FamilyStats::available())->keyBy('key');

        $this->assertSame(2, $available->get('union_families')['value']);
        $this->assertSame(3, $available->get('union_members')['value']);
    }

    public function test_selected_keys_default_to_available_defaults(): void
    {
        $this->withoutModuleTables();
        $this->assertSame(['members'], FamilyStats::selectedKeys());
    }

    public function test_admin_can_save_a_custom_selection(): void
    {
        FamilyStats::save(['union_members', 'union_families', 'members']);

        $this->assertSame(['union_members', 'union_families', 'members'], FamilyStats::selectedKeys());
    }

    public function test_save_silently_drops_unavailable_keys(): void
    {
        $this->withoutModuleTables();
        FamilyStats::save(['members', 'bonuses_paid', 'not_a_real_key']);

        $this->assertSame(['members'], FamilyStats::selectedKeys());
    }

    public function test_selected_returns_labeled_values_in_saved_order(): void
    {
        User::factory()->count(2)->create();
        FamilyStats::save(['union_members', 'members']);

        $selected = FamilyStats::selected();

        $this->assertSame(['union_members', 'members'], array_column($selected, 'key'));
        $this->assertSame(2, $selected[1]['value']);
    }
}

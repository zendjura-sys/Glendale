<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LegalPagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_documents_are_public_and_rendered_in_every_base_language(): void
    {
        foreach (['/terms' => 'terms', '/privacy' => 'privacy', '/refund-policy' => 'refund', '/contacts' => 'contacts'] as $url => $doc) {
            foreach ((array) config('legal.languages') as $lang) {
                $this->get("{$url}?lang={$lang}")->assertOk()->assertInertia(fn (Assert $page) => $page
                    ->component('legal/show')
                    ->where('document', $doc)
                    ->where('locale', $lang)
                    ->where('is_master', $lang === 'uk')
                    ->where('html', fn (string $html) => str_contains($html, (string) config('legal.email')))
                    ->has('translations', count((array) config('legal.languages')))
                );
            }
        }
    }

    public function test_missing_translation_falls_back_to_the_ukrainian_master(): void
    {
        // Перекладу fr немає → мова інтерфейсу (за замовчуванням uk) — це й майстер-версія.
        $this->get('/terms?lang=fr')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'uk')
            ->where('is_master', true)
            ->where('master', 'uk')
            ->where('labels.prevail_en', fn (string $text) => str_contains($text, 'українська версія'))
        );
        $this->get('/terms?lang=../../etc')->assertOk()->assertInertia(fn (Assert $page) => $page->where('locale', 'uk'));

        // Мова інтерфейсу без перекладу документа → український оригінал.
        $this->withSession(['locale' => 'fr'])->get('/terms')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'uk')
            ->where('is_master', true)
        );

        // Англійський переклад — не майстер, із застереженням українською.
        $this->get('/terms?lang=en')->assertInertia(fn (Assert $page) => $page
            ->where('is_master', false)
            ->where('labels.prevail', fn (string $text) => str_contains($text, 'Ukrainian version shall prevail'))
        );
    }

    public function test_documents_follow_ukrainian_law_for_card_payments(): void
    {
        $this->get('/terms?lang=uk')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, 'публічною офертою') && str_contains($html, 'monobank')
                && str_contains($html, 'Автопродовження') && ! str_contains($html, 'Donatello'))
        );
        $this->get('/refund-policy?lang=uk')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, '14 днів') && str_contains($html, 'на ту саму картку') && ! str_contains($html, 'Donatello'))
        );
        $this->get('/refund-policy?lang=en')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, '14 days') && str_contains($html, 'same card') && ! str_contains($html, 'Paddle'))
        );
        $this->get('/privacy?lang=uk')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, 'Про захист персональних даних') && str_contains($html, 'замаскований номер картки'))
        );
    }

    public function test_pricing_lists_only_products_on_sale(): void
    {
        $all = count((array) config('plus.products'));
        $this->get('/pricing')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('legal/pricing')
            ->has('products', $all)
        );

        app(SiteSettings::class)->put(['plus_disabled' => ['gift_year', 'promo_banner_30']]);

        $this->get('/pricing')->assertInertia(fn (Assert $page) => $page
            ->has('products', $all - 2)
            ->where('products', fn ($products) => ! collect($products)->pluck('key')->contains('gift_year'))
        );
    }

    public function test_footer_is_shared_with_every_page(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('footer.year', (int) now()->year)
            ->missing('footer.paddle')
            ->has('footer.terms')
            ->has('footer.refund')
            ->has('footer.contacts')
        );
    }

    public function test_seller_details_are_managed_in_admin_settings_with_env_fallback(): void
    {
        $this->get('/terms?lang=en')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, (string) config('legal.operator')))
        );

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin/settings')->assertInertia(fn (Assert $page) => $page
            ->where('legal_defaults.legal_email', (string) config('legal.email'))
        );

        $payload = app(SiteSettings::class)->public();
        $this->actingAs($admin)->put('/admin/settings', [
            ...array_intersect_key($payload, array_flip(['site_name', 'max_post_length', 'max_attachments', 'max_upload_mb', 'max_message_file_mb', 'music_max_track_mb'])),
            'legal_operator' => 'ФОП Коваленко Олена',
            'legal_email' => 'billing@example.com',
            'legal_country' => 'Ukraine',
            'legal_updated' => '2026-11-01',
            'legal_tax_id' => '1234567890',
            'legal_registry' => '2010350000000123456 від 01.10.2026',
            'legal_phone' => '+380 67 123 45 67',
            'legal_address' => 'м. Київ, вул. Хрещатик, 1',
            'legal_tax_status' => 'платник єдиного податку 3 групи, не є платником ПДВ',
        ])->assertSessionHasNoErrors();

        $this->get('/refund-policy?lang=uk')->assertInertia(fn (Assert $page) => $page
            ->where('updated', '2026-11-01')
            ->where('html', fn (string $html) => str_contains($html, 'ФОП Коваленко Олена') && str_contains($html, 'billing@example.com')
                && str_contains($html, 'РНОКПП: 1234567890') && str_contains($html, '2010350000000123456')
                // Телефон зберігається, але на сайті не показується.
                && ! str_contains($html, '123 45 67') && ! str_contains($html, 'tel:')
                && str_contains($html, 'єдиного податку 3 групи'))
        );
        $this->get('/terms?lang=en')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, 'Taxpayer ID (RNOKPP): 1234567890'))
        );
        $this->assertSame('+380 67 123 45 67', app(SiteSettings::class)->get('legal_phone'));
        $this->get('/contacts')->assertInertia(fn (Assert $page) => $page->where('html', fn (string $html) => ! str_contains($html, '123 45 67')));

        $this->actingAs($admin)->put('/admin/settings', [...$payload, 'legal_tax_id' => '12ab'])
            ->assertSessionHasErrors('legal_tax_id');

        $this->actingAs($admin)->put('/admin/settings', [...$payload, 'legal_email' => 'not-an-email'])
            ->assertSessionHasErrors('legal_email');
    }

    public function test_contacts_page_and_offer_show_email_for_customers(): void
    {
        app(SiteSettings::class)->put(['legal_email' => 'help@gamecon.test']);

        $this->get('/contacts')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('document', 'contacts')
            ->where('title', 'Контакти')
            ->where('html', fn (string $html) => str_contains($html, 'mailto:help@gamecon.test') && ! str_contains($html, 'tel:'))
        );
        // У оферті контакти — на самому початку, до розділу 1.
        $this->get('/terms?lang=uk')->assertInertia(fn (Assert $page) => $page->where('html', function (string $html) {
            $contacts = strpos($html, 'Контактні дані для зв’язку');

            return $contacts !== false && $contacts < strpos($html, '1. Акцепт оферти') && str_contains($html, 'mailto:help@gamecon.test');
        }));
    }
}

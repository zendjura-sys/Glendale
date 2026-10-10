<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Plus\Paddle;
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
        foreach (['/terms' => 'terms', '/privacy' => 'privacy', '/refund-policy' => 'refund'] as $url => $doc) {
            foreach ((array) config('legal.languages') as $lang) {
                $this->get("{$url}?lang={$lang}")->assertOk()->assertInertia(fn (Assert $page) => $page
                    ->component('legal/show')
                    ->where('document', $doc)
                    ->where('locale', $lang)
                    ->where('is_master', $lang === 'en')
                    ->where('html', fn (string $html) => str_contains($html, (string) config('legal.email')))
                    ->has('translations', count((array) config('legal.languages')))
                );
            }
        }
    }

    public function test_missing_translation_falls_back_to_interface_language_then_english(): void
    {
        // Перекладу fr немає → мова інтерфейсу (за замовчуванням uk).
        $this->get('/terms?lang=fr')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'uk')
            ->where('is_master', false)
            ->where('labels.prevail_en', fn (string $text) => str_contains($text, 'English'))
        );
        $this->get('/terms?lang=../../etc')->assertOk()->assertInertia(fn (Assert $page) => $page->where('locale', 'uk'));

        // Мова інтерфейсу без перекладу документа → англійський оригінал.
        $this->withSession(['locale' => 'fr'])->get('/terms')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('locale', 'en')
            ->where('is_master', true)
        );
    }

    public function test_refund_policy_names_paddle_and_the_14_day_window(): void
    {
        $this->get('/refund-policy?lang=en')->assertInertia(fn (Assert $page) => $page
            ->where('html', fn (string $html) => str_contains($html, 'Merchant of Record') && str_contains($html, '14 days'))
        );
    }

    public function test_pricing_lists_only_products_with_paddle_prices(): void
    {
        $this->get('/pricing')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('legal/pricing')
            ->has('products', count((array) config('plus.products')))
        );

        $settings = app(SiteSettings::class);
        $settings->putSecret('paddle_api_key', 'pdl_sdbx_apikey_0123456789abcdef');
        $settings->put([
            'paddle_seller_id' => '12345',
            'paddle_client_token' => 'test_0123456789abcdef',
            'paddle_price_plus_month' => 'pri_plusmonth0001',
            'paddle_price_family_year' => 'pri_familyyear001',
        ]);
        app(Paddle::class)->applyConfig();

        $this->get('/pricing')->assertInertia(fn (Assert $page) => $page
            ->has('products', 2)
            ->where('products.0.key', 'plus_month')
            ->where('products.1.key', 'family_year')
        );
    }

    public function test_footer_is_shared_with_every_page(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('footer.year', (int) now()->year)
            ->where('footer.paddle', fn (string $text) => str_contains($text, 'Paddle'))
            ->has('footer.terms')
            ->has('footer.refund')
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
        ])->assertSessionHasNoErrors();

        $this->get('/refund-policy?lang=uk')->assertInertia(fn (Assert $page) => $page
            ->where('updated', '2026-11-01')
            ->where('html', fn (string $html) => str_contains($html, 'ФОП Коваленко Олена') && str_contains($html, 'billing@example.com'))
        );

        $this->actingAs($admin)->put('/admin/settings', [...$payload, 'legal_email' => 'not-an-email'])
            ->assertSessionHasErrors('legal_email');
    }
}

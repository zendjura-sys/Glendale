<?php

use App\Http\Controllers\Admin\AddonController;
use App\Http\Controllers\Admin\ChangelogController as AdminChangelogController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DeployController;
use App\Http\Controllers\Admin\DesignController;
use App\Http\Controllers\Admin\FailedJobController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\UnionAddonController;
use App\Http\Controllers\Admin\UnionAnnouncementController;
use App\Http\Controllers\Admin\UnionBlacklistController as AdminUnionBlacklistController;
use App\Http\Controllers\Admin\UnionComplaintController as AdminUnionComplaintController;
use App\Http\Controllers\Admin\UnionController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\ChangelogController;
use App\Http\Controllers\GuideController;
use App\Http\Controllers\RulesController;
use App\Http\Controllers\MobileDownloadController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\TwoFactorAuthenticationController;
use App\Http\Controllers\UnionBlacklistController;
use App\Http\Controllers\UnionCabinetController;
use App\Http\Controllers\UnionComplaintController;
use App\Http\Controllers\UnionFamilyController;
use App\Models\GalleryPhoto;
use App\Models\Setting;
use App\Models\User;
use App\Support\DesignSettings;
use App\Support\FamilyContent;
use App\Support\FamilyStats;
use App\Support\MemberCard;
use App\Support\TelegramLink;
use App\Support\UnionDomain;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// union.monsory.net — окремий публічний вхід для союзників родини. Той
// самий застосунок, база, логін і адмінка, що й на основному домені;
// різниться лише ЦЯ головна сторінка (до логіну). Зареєстровано ДО
// загального '/' нижче — інакше той матчив би будь-який хост першим, і
// union-версія ніколи не спрацювала б. UNION_DOMAIN порожній за
// замовчуванням — тоді цей блок просто не реєструється.
if ($unionDomain = config('app.union_domain')) {
    Route::domain($unionDomain)->group(function () {
        Route::get('/', function () {
            return Inertia::render('Union/Home', [
                'canLogin' => Route::has('login'),
                'canRegister' => Route::has('register'),
                'title' => DesignSettings::unionTitle(),
                'tagline' => DesignSettings::unionTagline(),
                'about' => FamilyContent::unionAbout(),
                'rules' => FamilyContent::unionRules(),
                'terms' => FamilyContent::unionTerms(),
                'socialLinks' => DesignSettings::socialLinks(),
            ]);
        })->name('union.home');
    });
}

// Проксі GitHub Release для самооновлення мобільного застосунку — див.
// докблок MobileDownloadController. Публічно, без авторизації: саме так
// незалогінений телефон і скачує оновлення.
Route::get('/downloads/mobile-apk', [MobileDownloadController::class, 'apk'])->name('mobile.download.apk');
Route::get('/downloads/mobile-build.txt', [MobileDownloadController::class, 'build'])->name('mobile.download.build');

Route::get('/', function () {
    // Только реальные цифры — модулей Reports/Progression ещё нет,
    // поэтому XP/рейтинги/звіти на главной пока не показываем вообще,
    // а не подставляем нули или выдуманные значения.
    return Inertia::render('Home', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'memberCount' => User::query()->count(),
        'telegramBotUrl' => TelegramLink::url(),
        // Обране в адмінці (Панель CMS → Статистика родини) — реальні
        // числа з бази, не текст, вписаний уручну.
        'stats' => FamilyStats::selected(),
        // Содержание идёт через FamilyContent: правки из админки, а при их
        // отсутствии — значения из config/family.php. Тот же источник читает
        // бот в Telegram. Пока список жил во Vue, правка должностей означала
        // расхождение: на сайте одно, в боте другое.
        'positions' => FamilyContent::positions(),
        'baseCount' => FamilyContent::baseCount(),
        'directions' => FamilyContent::directions(),
        'promotionCriteria' => FamilyContent::promotionCriteria(),
        'leadership' => FamilyContent::leadership(),
        // Каруселі: аватарки учасників, які самі завантажили фото в
        // профілі, і галерея знімків подій, яку веде адмін. Обидва
        // масиви порожні, поки нема реального контенту чи вимкнено в
        // Дизайні — сторінка сама ховає секцію, якщо масив порожній.
        'memberPhotos' => DesignSettings::showMemberCarousel()
            ? User::query()
                ->whereNotNull('avatar_path')
                ->where('avatar_approved', true)
                ->orderBy('name')
                ->get()
                ->map(fn (User $u) => ['name' => $u->name, 'position' => $u->position_title, 'url' => $u->avatar_url])
                ->filter(fn (array $p) => $p['url'] !== null)
                ->values()
            : [],
        'galleryPhotos' => DesignSettings::showGalleryCarousel()
            ? GalleryPhoto::query()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(fn (GalleryPhoto $p) => ['url' => $p->url(), 'caption' => $p->caption])
                ->filter(fn (array $p) => $p['url'] !== null)
                ->values()
            : [],
        'socialLinks' => DesignSettings::socialLinks(),
    ]);
})->name('home');

// Особистий кабінет — та сама адреса й авторизація для обох аудиторій,
// різниться лише те, ЩО рендериться. Вирішує ПОТОЧНИЙ ДОМЕН (той самий
// принцип, що й для головної та реєстрації): зайшов на union.monsory.net —
// бачиш кабінет союзу, навіть якщо акаунт зареєстрований на monsory.net
// (union_family_name тоді просто порожнє — кабінет це враховує).
Route::get('/dashboard', function (Request $request) {
    if (UnionDomain::matches($request)) {
        return app(UnionCabinetController::class)->index($request);
    }

    // Банк — модуль Bonuses, ядро про нього знати не мусить: та сама
    // "опційна залежність" через class_exists(), що й у самих модулях
    // одне до одного (наприклад Bonuses -> Notifications). Немає модуля —
    // просто немає картки, без помилки.
    $bankCard = null;
    if (class_exists(\Addons\Bonuses\Services\BalanceCalculator::class)) {
        $bankCard = [
            'number' => MemberCard::masked($request->user()),
            'numberFull' => MemberCard::number($request->user()),
            'name' => $request->user()->name,
            'balance' => \Addons\Bonuses\Services\BalanceCalculator::balanceFor($request->user()->id),
        ];
    }

    return Inertia::render('Dashboard', [
        'memberCount' => User::query()->count(),
        'telegramBotUrl' => TelegramLink::url(),
        'bankCard' => $bankCard,
        'mobileAppDownloadUrl' => Setting::get('mobile_app_download_url'),
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    // Heartbeat онлайн-статусу — саму мітку ставить TrackLastSeen.
    Route::post('/presence/ping', fn () => response()->noContent())->name('presence.ping');
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::patch('/profile/position', [ProfileController::class, 'updatePosition'])->name('profile.position');
    Route::patch('/profile/birthday', [ProfileController::class, 'updateBirthday'])->name('profile.birthday');
    Route::patch('/profile/gender', [ProfileController::class, 'updateGender'])->name('profile.gender');
    Route::post('/profile/avatar', [ProfileController::class, 'updateAvatar'])->name('profile.avatar');
    Route::delete('/profile/other-sessions', [ProfileController::class, 'destroyOtherSessions'])->name('profile.other-sessions.destroy');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::prefix('user/two-factor-authentication')->name('two-factor.')->group(function () {
        Route::post('/', [TwoFactorAuthenticationController::class, 'store'])->name('enable');
        Route::get('/qr-code', [TwoFactorAuthenticationController::class, 'qrCode'])->name('qr-code');
        Route::post('/confirm', [TwoFactorAuthenticationController::class, 'confirm'])->name('confirm');
        Route::delete('/cancel', [TwoFactorAuthenticationController::class, 'cancel'])->name('cancel');
        Route::post('/recovery-codes', [TwoFactorAuthenticationController::class, 'regenerateRecoveryCodes'])->name('recovery-codes');
        Route::get('/trusted-devices', [TwoFactorAuthenticationController::class, 'trustedDevices'])->name('trusted-devices');
        Route::delete('/trusted-devices', [TwoFactorAuthenticationController::class, 'forgetTrustedDevices'])->name('forget-trusted-devices');
        Route::delete('/', [TwoFactorAuthenticationController::class, 'destroy'])->name('disable');
    });

    // Доступна одразу після реєстрації, ще до підтвердження email — саме
    // тоді в людини найбільше питань «що тут де», а лист підтвердження
    // може прийти не миттєво.
    Route::get('/guide', [GuideController::class, 'index'])->name('guide');
    Route::get('/rules', [RulesController::class, 'index'])->name('rules');
    Route::get('/changelog', [ChangelogController::class, 'index'])->name('changelog');

    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->name('push-subscriptions.store');
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->name('push-subscriptions.destroy');
});

require __DIR__.'/auth.php';

// Нова платформа (React SPA). Вхід/реєстрація — на сторінках сайту:
// /social/enter вимагає сесії, тож гостя Laravel відправить на /login і
// поверне сюди (intended), а SPA обміняє сесію на токен API.
Route::prefix(\App\Http\Controllers\Platform\SpaController::BASE)->group(function () {
    Route::get('/enter', [\App\Http\Controllers\Platform\SpaController::class, 'enter'])->middleware('auth');
    Route::post('/session-token', [\App\Http\Controllers\Platform\SpaController::class, 'sessionToken'])->middleware('throttle:20,1');
    Route::post('/logout', [\App\Http\Controllers\Platform\SpaController::class, 'logout']);
    Route::get('/{any?}', [\App\Http\Controllers\Platform\SpaController::class, 'show'])->where('any', '.*');
});

Route::middleware(['auth', 'verified', 'permission:addons.manage|reports.manage|progression.manage|settings.manage|roles.manage|users.manage|members.manage|goals.manage|broadcasts.manage|telegram.manage|bonuses.manage|events.manage|union.manage'])
    ->get('/admin', [DashboardController::class, 'index'])
    ->name('admin.dashboard');

Route::middleware(['auth', 'verified', 'permission:settings.manage'])
    ->put('/admin/stats', [DashboardController::class, 'updateFamilyStats'])
    ->name('admin.stats.update');

Route::middleware(['auth', 'verified', 'permission:addons.manage'])
    ->prefix('admin/addons')
    ->name('admin.addons.')
    ->group(function () {
        Route::get('/', [AddonController::class, 'index'])->name('index');
        Route::post('/{type}/upload', [AddonController::class, 'upload'])
            ->where('type', 'core|module|plugin')
            ->name('upload');
        Route::post('/{addon}/activate', [AddonController::class, 'activate'])->name('activate');
        Route::post('/{addon}/deactivate', [AddonController::class, 'deactivate'])->name('deactivate');
        Route::post('/{addon}/migrate', [AddonController::class, 'migrate'])->name('migrate');
        Route::delete('/{addon}', [AddonController::class, 'destroy'])->name('destroy');
    });

Route::middleware(['auth', 'verified', 'permission:addons.manage'])
    ->prefix('admin/deploy')
    ->name('admin.deploy.')
    ->group(function () {
        Route::post('/trigger', [DeployController::class, 'trigger'])->name('trigger');
        Route::get('/status', [DeployController::class, 'status'])->name('status');
    });

// Дизайн — обычный раздел настроек, а не аддон: см. DesignController.
Route::middleware(['auth', 'verified', 'permission:settings.manage'])
    ->prefix('admin/design')
    ->name('admin.design.')
    ->group(function () {
        Route::get('/', [DesignController::class, 'index'])->name('index');
        Route::post('/brand', [DesignController::class, 'updateBrand'])->name('brand');
        Route::put('/theme', [DesignController::class, 'updateTheme'])->name('theme');
        Route::put('/content', [DesignController::class, 'updateContent'])->name('content');
        Route::post('/content/reset', [DesignController::class, 'resetContent'])->name('content.reset');
        Route::put('/carousels', [DesignController::class, 'updateCarousels'])->name('carousels');
        Route::put('/social-links', [DesignController::class, 'updateSocialLinks'])->name('social-links');
        Route::post('/gallery', [DesignController::class, 'storeGalleryPhoto'])->name('gallery.store');
        Route::put('/gallery/reorder', [DesignController::class, 'reorderGalleryPhotos'])->name('gallery.reorder');
        Route::put('/gallery/{galleryPhoto}', [DesignController::class, 'updateGalleryPhoto'])->name('gallery.update');
        Route::delete('/gallery/{galleryPhoto}', [DesignController::class, 'destroyGalleryPhoto'])->name('gallery.destroy');
        Route::post('/avatars/{user}/approve', [DesignController::class, 'approveAvatar'])->name('avatars.approve');
        Route::delete('/avatars/{user}', [DesignController::class, 'rejectAvatar'])->name('avatars.reject');
    });

// Союз (union.monsory.net) — окреме право union.manage, а не settings.manage:
// цим розділом можуть опікуватись інші люди, ніж дизайном основного сайту.
Route::middleware(['auth', 'verified', 'permission:union.manage'])
    ->prefix('admin/union')
    ->name('admin.union.')
    ->group(function () {
        Route::get('/', [UnionController::class, 'index'])->name('index');
        Route::put('/content', [UnionController::class, 'updateContent'])->name('content');

        Route::get('/complaints', [AdminUnionComplaintController::class, 'index'])->name('complaints.index');
        Route::put('/complaints/{unionComplaint}', [AdminUnionComplaintController::class, 'update'])->name('complaints.update');

        Route::get('/announcements', [UnionAnnouncementController::class, 'index'])->name('announcements.index');
        Route::post('/announcements', [UnionAnnouncementController::class, 'store'])->name('announcements.store');
        Route::put('/announcements/{unionAnnouncement}', [UnionAnnouncementController::class, 'update'])->name('announcements.update');
        Route::delete('/announcements/{unionAnnouncement}', [UnionAnnouncementController::class, 'destroy'])->name('announcements.destroy');

        Route::get('/blacklist', [AdminUnionBlacklistController::class, 'index'])->name('blacklist.index');
        Route::post('/blacklist/families', [AdminUnionBlacklistController::class, 'storeFamily'])->name('blacklist.families.store');
        Route::put('/blacklist/families/{unionBlacklistedFamily}', [AdminUnionBlacklistController::class, 'updateFamily'])->name('blacklist.families.update');
        Route::delete('/blacklist/families/{unionBlacklistedFamily}', [AdminUnionBlacklistController::class, 'destroyFamily'])->name('blacklist.families.destroy');
        Route::delete('/blacklist/players/{unionBlacklistedPlayer}', [AdminUnionBlacklistController::class, 'destroyPlayer'])->name('blacklist.players.destroy');

        // Незалежна від "Аддони" (addons.manage) гілка — власний тип
        // пакета ('union') і власне право, дивись UnionAddonController.
        Route::get('/addons', [UnionAddonController::class, 'index'])->name('addons.index');
        Route::post('/addons/upload', [UnionAddonController::class, 'upload'])->name('addons.upload');
        Route::post('/addons/{addon}/activate', [UnionAddonController::class, 'activate'])->name('addons.activate');
        Route::post('/addons/{addon}/deactivate', [UnionAddonController::class, 'deactivate'])->name('addons.deactivate');
        Route::post('/addons/{addon}/migrate', [UnionAddonController::class, 'migrate'])->name('addons.migrate');
        Route::delete('/addons/{addon}', [UnionAddonController::class, 'destroy'])->name('addons.destroy');
    });

// ЧС гравців та автодоповнення родини — доступні будь-якому зареєстрованому
// союзнику (не лише адміну), на відміну від адмінського блоку вище.
Route::middleware(['auth', 'verified'])
    ->group(function () {
        Route::get('/union/families/search', [UnionFamilyController::class, 'search'])->name('union.families.search');

        Route::prefix('union/blacklist')->name('union.blacklist.')->group(function () {
            Route::get('/', [UnionBlacklistController::class, 'index'])->name('index');
            Route::post('/players', [UnionBlacklistController::class, 'storePlayer'])->name('players.store');
        });

        Route::prefix('union/complaints')->name('union.complaints.')->group(function () {
            Route::get('/', [UnionComplaintController::class, 'index'])->name('index');
            Route::post('/', [UnionComplaintController::class, 'store'])->name('store');
            Route::put('/{unionComplaint}', [UnionComplaintController::class, 'update'])->name('update');
        });
    });

Route::middleware(['auth', 'verified', 'permission:settings.manage'])
    ->prefix('admin/changelog')
    ->name('admin.changelog.')
    ->group(function () {
        Route::get('/', [AdminChangelogController::class, 'index'])->name('index');
        Route::post('/', [AdminChangelogController::class, 'store'])->name('store');
        Route::put('/{changelogEntry}', [AdminChangelogController::class, 'update'])->name('update');
        Route::delete('/{changelogEntry}', [AdminChangelogController::class, 'destroy'])->name('destroy');
    });

Route::middleware(['auth', 'verified', 'permission:settings.manage'])
    ->prefix('admin/failed-jobs')
    ->name('admin.failed-jobs.')
    ->group(function () {
        Route::get('/', [FailedJobController::class, 'index'])->name('index');
        Route::post('/retry-all', [FailedJobController::class, 'retryAll'])->name('retry-all');
        Route::post('/{failedJob}/retry', [FailedJobController::class, 'retry'])->name('retry');
        Route::delete('/clear', [FailedJobController::class, 'clear'])->name('clear');
        Route::delete('/{failedJob}', [FailedJobController::class, 'destroy'])->name('destroy');
    });

Route::middleware(['auth', 'verified', 'permission:settings.manage'])
    ->prefix('admin/settings')
    ->name('admin.settings.')
    ->group(function () {
        Route::get('/', [SettingsController::class, 'index'])->name('index');
        Route::put('/{group}', [SettingsController::class, 'update'])
            ->where('group', 'general|telegram|discord|api_keys|ai|ai_prompts|report_guides|mobile_app')
            ->name('update');
        Route::post('/mobile-app/apk', [SettingsController::class, 'uploadMobileApk'])->name('mobile-app.apk');
    });

Route::middleware(['auth', 'verified', 'permission:roles.manage'])
    ->prefix('admin/roles')
    ->name('admin.roles.')
    ->group(function () {
        Route::get('/', [RoleController::class, 'index'])->name('index');
        Route::post('/', [RoleController::class, 'store'])->name('store');
        Route::put('/{role}', [RoleController::class, 'update'])->name('update');
        Route::delete('/{role}', [RoleController::class, 'destroy'])->name('destroy');
    });

Route::middleware(['auth', 'verified', 'permission:users.manage'])
    ->prefix('admin/users')
    ->name('admin.users.')
    ->group(function () {
        Route::get('/', [UserController::class, 'index'])->name('index');
        Route::put('/{user}/roles', [UserController::class, 'updateRoles'])->name('roles');
        Route::put('/{user}/position', [UserController::class, 'updatePosition'])->name('position');
        Route::put('/{user}', [UserController::class, 'update'])->name('update');
        Route::post('/{user}/reset-password', [UserController::class, 'resetPassword'])->name('reset-password');
        Route::delete('/{user}', [UserController::class, 'destroy'])->name('destroy');
    });

/*
 * Rota que o Base44 vai acessar.
 *
 * ВЫКЛЮЧЕНА ПО УМОЛЧАНИЮ. Маршрут остался от другого проекта в этом же
 * репозитории: он без авторизации и без CSRF принимает base64 PFX-
 * сертификат, пароль к нему и произвольный XML, подписывает и отправляет
 * в SEFAZ. На домене Monsory он открыт всему интернету и ничем здесь не
 * используется, поэтому висит за флагом.
 *
 * Код не удалён, чтобы не сломать тот проект: чтобы вернуть маршрут,
 * достаточно NFE_ENDPOINT_ENABLED=true в .env. Но прежде чем включать,
 * его стоит закрыть авторизацией — в нынешнем виде подписывать документы
 * через него может кто угодно.
 */
if (config('services.nfe.enabled')) {
Route::any('/api/nfe/emitir', function (Request $request) {
    try {
        $autoload = base_path('vendor/autoload.php');
        if (file_exists($autoload)) {
            require_once $autoload;
        }

        if (!class_exists('NFePHP\NFe\Tools')) {
            return response()->json([
                'status' => 'erro',
                'mensagem' => 'A biblioteca sped-nfe nao foi instalada no servidor.'
            ], 200);
        }

        $certificadoBase64 = $request->input('certificado_base64');
        $senhaCertificado = $request->input('senha_certificado');
        $xmlRecebido = $request->input('xml_nota');

        if (!$certificadoBase64 || !$senhaCertificado || !$xmlRecebido) {
            return response()->json([
                'status' => 'erro',
                'mensagem' => 'Aguardando dados do Base44. Teste de rota OK!'
            ], 200);
        }

        $configJson = json_encode([
            "atualizacao" => date('Y-m-d H:i:s'),
            "tpAmb" => 2,
            "razaosocial" => $request->input('razao_social', 'EMITENTE'),
            "siglaUF" => $request->input('uf', 'SP'),
            "cnpj" => preg_replace('/[^0-9]/', '', $request->input('cnpj_emitente')),
            "schemes" => "PL_009_V4",
            "versao" => "4.00",
        ]);

        $certificado = \NFePHP\Common\Certificate::readPfx(base64_decode($certificadoBase64), $senhaCertificado);
        $tools = new \NFePHP\NFe\Tools($configJson, $certificado);

        $xmlAssinado = $tools->signNFe($xmlRecebido);
        $respostaSefaz = $tools->sefazEnviaLote([$xmlAssinado], 1);

        return response()->json(['status' => 'sucesso', 'retorno' => $respostaSefaz], 200);

    } catch (\Throwable $e) {
        // Текст исключения и номер строки наружу не отдаём: маршрут
        // публичный, а это готовая карта внутренностей приложения.
        report($e);

        return response()->json([
            'status' => 'erro',
            'mensagem' => 'Erro interno ao processar a requisicao.'
        ], 200);
    }
})->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class]);
}

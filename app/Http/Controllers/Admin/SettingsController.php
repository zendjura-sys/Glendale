<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    /** @var array<string, array<int, string>> */
    private const FIELDS = [
        'general' => ['site_name', 'site_tagline', 'support_contact'],
        // Самі токени/ключі (секрети) звідси винесено в окрему вкладку
        // 'api_keys' нижче — тут лишається тільки не-секретна конфігурація
        // кожної інтеграції.
        'discord' => ['discord_client_id', 'discord_redirect_uri', 'discord_guild_id'],
        // Усі токени й ключі сайту в одному місці — замість того, щоб
        // шукати кожен у своїй тематичній вкладці.
        'api_keys' => [
            'discord_client_secret',
            'discord_bot_token',
            'mistral_api_key',
            'mistral_proxy_url',
            'giphy_api_key',
        ],
        'ai' => [
            'ai_reports_analysis_enabled',
            'ai_rejection_advice_enabled',
            'ai_grade_advice_enabled',
            'ai_broadcast_assist_enabled',
            'ai_event_draft_enabled',
        ],
        'ai_prompts' => [
            'ai_reports_analysis_instructions',
            'ai_rejection_advice_instructions',
            'ai_grade_advice_instructions',
            'ai_broadcast_assist_instructions',
            'ai_event_draft_instructions',
        ],
        // Пам'ятки "як правильно оформити звіт" — учасник бачить їх
        // кнопкою "Як оформити?" у формі подачі звіту, за типом. Не має
        // нічого спільного з AI-інструкціями вище: це готовий текст для
        // людини, а не промпт для моделі.
        'report_guides' => [
            'report_guide_bizwar',
            'report_guide_contract',
            'report_guide_investment',
            'report_guide_other',
        ],
        // Мобільний застосунок (Flutter): та сама Setting::get()/set(), без
        // окремої моделі чи таблиці — читається публічним GET /api/app-config
        // (без авторизації, застосунок має побачити maintenance-режим ще ДО
        // логіну) і кешується так само, як решта Setting-значень.
        'mobile_app' => [
            'mobile_app_enabled',
            'mobile_app_maintenance_message',
            'mobile_app_min_build',
            'mobile_app_latest_build',
            'mobile_app_update_message',
            'mobile_app_bank_enabled',
            'mobile_app_leaderboard_enabled',
            'mobile_app_reports_enabled',
            'mobile_app_download_url',
        ],
    ];

    /**
     * Довільні інструкції адміна для AI-промптів — на відміну від решти
     * текстових полів (назва сайту, URL тощо), тут очікується кілька речень
     * чи навіть абзаців, тому ліміт довжини значно ширший.
     *
     * @var array<int, string>
     */
    private const LONG_TEXT_FIELDS = [
        'ai_reports_analysis_instructions', 'ai_rejection_advice_instructions', 'ai_grade_advice_instructions',
        'ai_broadcast_assist_instructions', 'ai_event_draft_instructions',
        'report_guide_bizwar', 'report_guide_contract', 'report_guide_investment', 'report_guide_other',
    ];

    /**
     * Тумблери зберігаються як '1'/null через ту саму Setting::set(), що й
     * усе інше, — без окремої таблиці чи типу. На фронті це checkbox
     * (boolean), тому окремо конвертуємо в update().
     *
     * @var array<int, string>
     */
    private const BOOLEAN_FIELDS = [
        'ai_reports_analysis_enabled', 'ai_rejection_advice_enabled', 'ai_grade_advice_enabled',
        'ai_broadcast_assist_enabled', 'ai_event_draft_enabled',
        'mobile_app_enabled', 'mobile_app_bank_enabled', 'mobile_app_leaderboard_enabled', 'mobile_app_reports_enabled',
    ];

    /**
     * Підмножина BOOLEAN_FIELDS, де незаданий стан (адмін ще жодного разу
     * не зберігав цю вкладку) означає "увімкнено", а не "вимкнено" — на
     * відміну від решти тумблерів (AI-фічі, опційні за задумом). Інакше
     * свіжий деплой без жодного дотику до цих налаштувань одразу вимкнув
     * би застосунок і його вкладки всім. Зберігаються явним '1'/'0'
     * (ніколи null), щоб відрізнити "не займали" від "явно вимкнули".
     *
     * @var array<int, string>
     */
    private const DEFAULT_ENABLED_BOOLEAN_FIELDS = [
        'mobile_app_enabled', 'mobile_app_bank_enabled', 'mobile_app_leaderboard_enabled', 'mobile_app_reports_enabled',
    ];

    /**
     * Поля, куда можно положить только http(s)-адрес.
     *
     * Vue в :href ничего не санитайзит, поэтому значение вида javascript:…
     * выполнялось бы в origin сайта у каждого, кто нажмёт ссылку.
     *
     * mobile_app_download_url свідомо НЕ тут — у нього окреме правило
     * нижче в update(), яке дозволяє ще й відносний шлях (/downloads/…).
     *
     * @var array<int, string>
     */
    private const URL_FIELDS = [
        'discord_redirect_uri',
    ];

    public function index(): Response
    {
        $values = [];
        foreach (self::FIELDS as $group => $keys) {
            foreach ($keys as $key) {
                $values[$key] = match (true) {
                    in_array($key, self::DEFAULT_ENABLED_BOOLEAN_FIELDS, true) => Setting::get($key) !== '0',
                    in_array($key, self::BOOLEAN_FIELDS, true) => Setting::get($key) === '1',
                    default => Setting::get($key),
                };
            }
        }

        return Inertia::render('Admin/Settings/Index', [
            'values' => $values,
        ]);
    }

    public function update(Request $request, string $group): RedirectResponse
    {
        abort_unless(array_key_exists($group, self::FIELDS), 404);

        $rules = [];
        foreach (self::FIELDS[$group] as $key) {
            $rules[$key] = match (true) {
                in_array($key, self::BOOLEAN_FIELDS, true) => ['boolean'],
                in_array($key, ['mobile_app_min_build', 'mobile_app_latest_build'], true) => ['nullable', 'integer', 'min:1'],
                // mobile_app_download_url: deploy/setup-vps.sh і кнопка
                // "Завантажити .apk" нижче самі пишуть сюди відносний
                // шлях (/downloads/…) замість повного URL — телефон не
                // знає домену сайту заздалегідь, а плутати адміна ще
                // одним окремим полем "шлях чи URL" не хочеться. Звичайне
                // 'url:http,https' відносний шлях відхиляв би.
                $key === 'mobile_app_download_url' => ['nullable', 'string', 'max:2000', function (string $attribute, $value, $fail) {
                    if ($value !== '' && ! str_starts_with($value, '/') && ! preg_match('/^https?:\/\//', $value)) {
                        $fail('Посилання має бути повним URL (https://…) або відносним шляхом (/downloads/…).');
                    }
                }],
                in_array($key, self::URL_FIELDS, true) => ['nullable', 'string', 'max:2000', 'url:http,https'],
                in_array($key, self::LONG_TEXT_FIELDS, true) => ['nullable', 'string', 'max:5000'],
                default => ['nullable', 'string', 'max:2000'],
            };
        }

        $data = $request->validate($rules, [], [
            'discord_redirect_uri' => 'Redirect URI',
        ]);

        foreach (self::FIELDS[$group] as $key) {
            $value = match (true) {
                in_array($key, self::DEFAULT_ENABLED_BOOLEAN_FIELDS, true) => ($data[$key] ?? false) ? '1' : '0',
                in_array($key, self::BOOLEAN_FIELDS, true) => ($data[$key] ?? false) ? '1' : null,
                default => $data[$key] ?? null,
            };

            Setting::set($key, $value, $group);
        }

        return back()->with('status', 'settings-updated');
    }

    /**
     * Ручне завантаження .apk просто з адмінки — на випадок, коли
     * deploy/setup-vps.sh не може сам дотягнутись до GitHub Release
     * (мережеві обмеження на VDS) або коли зручніше просто перетягнути
     * файл, зібраний CI, замість SCP на сервер. Кладемо в public/downloads
     * (той самий шлях, яким уже користується deploy-скрипт) і одразу
     * виставляємо mobile_app_download_url на нього — окремо вручну
     * вводити посилання після цього не треба.
     */
    public function uploadMobileApk(Request $request): RedirectResponse
    {
        $request->validate([
            'apk' => ['required', 'file', 'max:122880', function (string $attribute, $value, $fail) {
                if (strtolower($value->getClientOriginalExtension()) !== 'apk') {
                    $fail('Файл має бути .apk.');
                }
            }],
        ]);

        if (! is_dir(public_path('downloads'))) {
            mkdir(public_path('downloads'), 0755, true);
        }

        $request->file('apk')->move(public_path('downloads'), 'monsory-connect.apk');

        Setting::set('mobile_app_download_url', '/downloads/monsory-connect.apk', 'mobile_app');

        return back()->with('status', 'mobile-apk-uploaded');
    }
}

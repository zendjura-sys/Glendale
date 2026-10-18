<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Services\Donations\MonobankJar;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyBot;
use App\Services\Families\FamilyChat;
use App\Services\Families\FamilyNotifier;
use App\Services\Families\WeeklyDigest;
use App\Services\ImageStorage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilySettingsController extends FamilyBaseController
{
    public function index(Request $request, Family $family, WeeklyDigest $digest): Response
    {
        $member = $this->member($request, $family, 'settings.manage');
        $preview = $digest->build($family);

        return $this->page($family, $member, 'families/settings', 'settings', [
            'settings' => $family->resolvedSettings(),
            'profile' => [
                'name' => $family->name,
                'tag' => $family->tag,
                'description' => $family->description,
                'is_recruiting' => $family->is_recruiting,
            ],
            'webhooks' => [
                'discord' => $family->webhook('discord') ? Str::mask((string) $family->webhook('discord'), '•', 40, -6) : null,
                'telegram_token' => $family->webhook('telegram_token') ? Str::mask((string) $family->webhook('telegram_token'), '•', 4, -4) : null,
                'telegram_chat' => $family->webhook('telegram_chat'),
            ],
            'jar' => ['url' => $family->donation_jar, 'note' => $family->donation_note],
            'digest' => [
                'text' => $digest->format($family, $preview),
                'members' => count($preview['lines']),
                'total' => $preview['total'],
                'last' => $family->settings['digest_last'] ?? null,
            ],
        ]);
    }

    /** Банка Monobank для донатів сім’ї (картка «Підтримати» на сторінці; лише сайт). */
    public function jar(Request $request, Family $family, FamilyAudit $audit, MonobankJar $jars): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $data = $request->validate([
            'url' => ['nullable', 'string', 'max:200'],
            'note' => ['nullable', 'string', 'max:200'],
        ]);
        $id = MonobankJar::clientId($data['url'] ?? null);
        abort_if(filled($data['url'] ?? null) && $id === null, 422, 'Вставте посилання на банку Monobank: https://send.monobank.ua/jar/…');

        $jars->forget($family->donation_jar);
        $family->forceFill([
            'donation_jar' => $id !== null ? MonobankJar::url($id) : null,
            'donation_note' => filled($data['note'] ?? null) ? trim((string) $data['note']) : null,
        ])->save();
        $audit->log($family, 'FAMILY_UPDATE', $member, null, ['jar' => $family->donation_jar !== null]);

        Inertia::flash('toast', ['type' => 'success', 'message' => $family->donation_jar ? 'Банку збережено — картка «Підтримати» з’явилася на сторінці сім’ї.' : 'Банку прибрано.']);

        return back();
    }

    public function profile(Request $request, Family $family, FamilyAudit $audit, ImageStorage $images, FamilyChat $chat): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $request->merge(['tag' => Str::upper(trim($request->string('tag')->toString()))]);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'tag' => ['required', 'string', 'min:2', 'max:8', 'regex:/^[A-Za-z0-9А-Яа-яІіЇїЄєҐґ]+$/u', Rule::unique('families', 'tag')->where('server_id', $family->server_id)->ignore($family->id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_recruiting' => ['required', 'boolean'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:15360'],
        ], ['tag.unique' => 'Сім’я з таким тегом уже є на цьому сервері.']);

        $before = $family->only(['name', 'tag', 'description', 'is_recruiting']);
        $family->fill([...Arr::except($data, ['logo', 'cover']), 'tag' => Str::upper($data['tag'])]);

        foreach (['logo' => [512, 512], 'cover' => [1920, 480]] as $field => $size) {
            if ($request->hasFile($field)) {
                $images->delete($family->{$field.'_path'});
                $family->{$field.'_path'} = $images->store($request->file($field), 'families/'.$field.'s', cover: $size)['path'];
            }
        }
        $family->save();

        $audit->log($family, 'FAMILY_UPDATE', $member, null, ['from' => $before, 'to' => $family->only(array_keys($before)), 'images' => $request->hasFile('logo') || $request->hasFile('cover')]);
        if ($family->isVerified()) {
            $chat->ensure($family);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Профіль сім’ї оновлено.']);

        return back();
    }

    public function update(Request $request, Family $family, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $money = ['required', 'numeric', 'min:0', 'max:10000000'];
        $points = ['required', 'integer', 'min:0', 'max:1000'];

        $data = $request->validate([
            'rates.bizwar_win' => $money,
            'rates.bizwar_loss' => $money,
            'rates.contract_light' => $money,
            'rates.contract_medium' => $money,
            'rates.contract_heavy' => $money,
            'rates.investment_cashback' => ['required', 'numeric', 'min:0', 'max:100'],
            'deposits.enabled' => ['required', 'boolean'],
            'deposits.daily_rate' => ['required', 'numeric', 'min:0', 'max:10'],
            'deposits.weekly_rate' => ['required', 'numeric', 'min:0', 'max:50'],
            'deposits.min_amount' => $money,
            'deposits.max_days' => ['required', 'integer', 'min:1', 'max:60'],
            'deposits.max_weeks' => ['required', 'integer', 'min:1', 'max:26'],
            'reports.deadline_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'reports.contract_daily_limit' => ['required', 'integer', 'min:1', 'max:50'],
            'reports.require_proof' => ['required', 'boolean'],
            'reports.max_proofs' => ['required', 'integer', 'min:1', 'max:10'],
            'rating.bizwar' => ['required', 'boolean'],
            'rating.contracts' => ['required', 'boolean'],
            'rating.investments' => ['required', 'boolean'],
            'rating.events' => ['required', 'boolean'],
            'rating.points_bizwar_win' => $points,
            'rating.points_bizwar_loss' => $points,
            'rating.points_contract_light' => $points,
            'rating.points_contract_medium' => $points,
            'rating.points_contract_heavy' => $points,
            'rating.points_per_1000' => $points,
            'rating.points_event' => $points,
            'discipline.warn_days' => ['required', 'integer', 'min:1', 'max:365'],
            'discipline.warn_limit' => ['required', 'integer', 'min:1', 'max:10'],
            'discipline.escalation' => ['required', Rule::in(['demote', 'kick'])],
            'cashout.min_amount' => $money,
            'digest.enabled' => ['required', 'boolean'],
            'digest.chat' => ['required', 'boolean'],
        ]);

        $before = $family->resolvedSettings();
        $next = $family->settings ?? [];
        foreach (Family::DEFAULT_SETTINGS as $group => $defaults) {
            foreach ($defaults as $key => $default) {
                $value = $data[$group][$key];
                $next[$group][$key] = match (true) {
                    is_bool($default) => (bool) $value,
                    is_string($default) => (string) $value,
                    is_int($default) && ! str_contains($key, 'rate') && $group !== 'rates' => (int) $value,
                    default => round((float) $value, 2),
                };
            }
        }
        $family->update(['settings' => $next]);

        $changes = [];
        foreach ($family->resolvedSettings() as $group => $values) {
            foreach ($values as $key => $value) {
                if (($before[$group][$key] ?? null) != $value) {
                    $changes["{$group}.{$key}"] = ['from' => $before[$group][$key] ?? null, 'to' => $value];
                }
            }
        }
        if ($changes !== []) {
            $audit->log($family, 'RATE_CHANGE', $member, null, $changes);
        }
        $notifier->refresh($family, 'settings');

        Inertia::flash('toast', ['type' => 'success', 'message' => $changes ? 'Налаштування збережено ('.count($changes).' змін).' : 'Змін немає.']);

        return back();
    }

    public function webhooks(Request $request, Family $family, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $data = $request->validate([
            'discord' => ['nullable', 'string', 'max:300', 'regex:'.FamilyBot::DISCORD_PATTERN],
            'telegram_token' => ['nullable', 'string', 'max:80', 'regex:'.FamilyBot::TELEGRAM_TOKEN_PATTERN],
            'telegram_chat' => ['nullable', 'string', 'max:40', 'regex:/^(-?\d{5,20}|@\w{4,40})$/'],
            'clear' => ['nullable', Rule::in(['discord', 'telegram'])],
        ], [
            'discord.regex' => 'Вставте адресу вебхука Discord: https://discord.com/api/webhooks/…',
            'telegram_token.regex' => 'Токен бота від @BotFather має вигляд 123456789:AA…',
            'telegram_chat.regex' => 'Chat ID — число (для груп від’ємне) або @канал.',
        ]);

        $hooks = $family->webhooks ?? [];
        if (($data['clear'] ?? null) === 'discord') {
            unset($hooks['discord']);
        } elseif (($data['clear'] ?? null) === 'telegram') {
            unset($hooks['telegram_token'], $hooks['telegram_chat']);
        } else {
            foreach (['discord', 'telegram_token'] as $key) {
                if (filled($data[$key] ?? null)) {
                    $hooks[$key] = trim((string) $data[$key]);
                }
            }
            if (array_key_exists('telegram_chat', $data)) {
                $hooks['telegram_chat'] = $data['telegram_chat'];
            }
        }

        $family->update(['webhooks' => $hooks]);
        $audit->log($family, 'WEBHOOKS_UPDATE', $member, null, [
            'discord' => isset($hooks['discord']),
            'telegram' => isset($hooks['telegram_token'], $hooks['telegram_chat']),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування бота збережено.']);

        return back();
    }

    public function test(Request $request, Family $family, FamilyBot $bot): RedirectResponse
    {
        $this->member($request, $family, 'settings.manage', write: true);
        $result = $bot->send($family, 'Тестове повідомлення від GameCon. Якщо ви це бачите — бот налаштовано ✅', "[{$family->tag}] {$family->name}");

        Inertia::flash('toast', $result === []
            ? ['type' => 'error', 'message' => 'Спершу додайте вебхук Discord або бота Telegram.']
            : ['type' => in_array(false, $result, true) ? 'error' : 'success', 'message' => collect($result)->map(fn ($ok, $k) => ($k === 'discord' ? 'Discord' : 'Telegram').': '.($ok ? 'надіслано' : 'помилка'))->implode(' · ')]);

        return back();
    }

    public function digest(Request $request, Family $family, WeeklyDigest $digest): RedirectResponse
    {
        $this->member($request, $family, 'settings.manage', write: true);
        abort_unless($family->isVerified(), 423, 'Звіт доступний після верифікації сім’ї.');

        $result = $digest->send($family, force: true) ?? [];
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Тижневий звіт надіслано: '.(collect($result)->filter()->keys()->map(fn ($k) => ['chat' => 'чат', 'discord' => 'Discord', 'telegram' => 'Telegram'][$k] ?? $k)->implode(', ') ?: 'немає каналів')]);

        return back();
    }
}

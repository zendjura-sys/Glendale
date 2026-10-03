<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Mail\UnsubscribeController;
use App\Mail\SocialActivityMail;
use App\Support\Mail\MailCategory;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class SettingsController extends Controller
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function edit(): Response
    {
        $mailer = (string) config('mail.default');

        return Inertia::render('admin/settings', [
            'settings' => $this->settings->public(),
            'mail' => [
                'mailer' => $mailer,
                'from' => MailCategory::address(MailCategory::UPDATES),
                'social' => MailCategory::address(MailCategory::SOCIAL),
                // log/array лише записують листи у файл — нікому нічого не надходить.
                'ready' => ! in_array($mailer, ['log', 'array'], true),
            ],
        ]);
    }

    /** Тестовий лист: перевіряє, що пошта сайту (sendmail/SMTP) справді відправляє. */
    public function mailTest(Request $request): RedirectResponse
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:190']]);

        $app = (string) config('app.name');

        try {
            Mail::send(
                ['html' => 'mail.account-notice', 'text' => 'mail.account-notice-text'],
                [
                    'title' => 'Пошта '.$app.' працює',
                    'intro' => 'Це службовий лист '.$app.': підтвердження пошти та скидання пароля приходять із цієї адреси.',
                    'actionText' => 'Відкрити '.$app,
                    'actionUrl' => url('/'),
                ],
                function (Message $message) use ($data, $app) {
                    $message->to($data['email'])->subject($app.': сповіщення акаунта');
                    $message->getSymfonyMessage()->getHeaders()->addTextHeader('X-GameCon-Category', MailCategory::UPDATES);
                },
            );

            Mail::to($data['email'])->sendNow(new SocialActivityMail(
                subjectLine: 'Гравець хоче додати вас у друзі',
                intro: 'Гравець хоче додати вас у друзі. Листи про друзів, коментарі та спільноти приходять із цієї адреси.',
                actionUrl: url('/notifications'),
                fromName: 'Гравець',
                unsubscribeUrl: UnsubscribeController::url($request->user()),
            ));
        } catch (Throwable $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Лист не відправлено: '.Str::limit($e->getMessage(), 200)]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => config('mail.default') === 'log'
            ? 'Пошта в режимі log: листи записано в журнал, а не відправлено. Налаштуйте sendmail.'
            : 'Надіслано два листи на '.$data['email'].': службовий (Оповіщення) і соціальний (Соцмережі).']);

        return back();
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'site_name' => ['required', 'string', 'max:60'],
            'tagline' => ['nullable', 'string', 'max:140'],
            'seo_description' => ['nullable', 'string', 'max:300'],
            'play_store_enabled' => ['boolean'],
            'play_store_url' => ['nullable', 'string', 'max:300', 'url:http,https'],
            'play_store_badge' => ['nullable', 'in:get,preregister'],
            'registration_open' => ['boolean'],
            'email_verification' => ['boolean'],
            'max_post_length' => ['required', 'integer', 'min:100', 'max:50000'],
            'max_attachments' => ['required', 'integer', 'min:1', 'max:30'],
            'max_upload_mb' => ['required', 'integer', 'min:1', 'max:200'],
            'max_message_file_mb' => ['required', 'integer', 'min:1', 'max:500'],
            'music_max_track_mb' => ['required', 'integer', 'min:1', 'max:500'],
            'maintenance_message' => ['nullable', 'string', 'max:500'],
        ]);

        $this->settings->put($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування збережено.']);

        return back();
    }
}

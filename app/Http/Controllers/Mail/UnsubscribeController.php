<?php

namespace App\Http\Controllers\Mail;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\URL;

/**
 * Відписка від листів про активність за підписаним посиланням з листа.
 * POST — «відписатися одним натисканням» з Gmail (RFC 8058), GET — посилання в підвалі листа.
 */
class UnsubscribeController extends Controller
{
    public function __invoke(Request $request, User $user): Response
    {
        if ($user->email_social) {
            $user->forceFill(['email_social' => false])->save();
        }

        if ($request->isMethod('POST')) {
            return response('', 200);
        }

        return response()->view('mail.unsubscribed', ['settingsUrl' => URL::to('/settings/profile')]);
    }

    public static function url(User $user): string
    {
        return URL::signedRoute('mail.unsubscribe', ['user' => $user->id]);
    }
}

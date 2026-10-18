<?php

namespace App\Http\Controllers\OAuth;

use App\Http\Controllers\Controller;
use App\Services\Servers\ServerOAuth;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/** Сторінка «Увійти через GameCon»: людина бачить сервер і що він просить, і дозволяє чи відмовляє. */
class AuthorizeController extends Controller
{
    public function __construct(private readonly ServerOAuth $oauth) {}

    public function show(Request $request): Response
    {
        $auth = $this->oauth->authorizeRequest($request->query());
        $server = $auth['client']->server;

        return Inertia::render('oauth/authorize', [
            'app' => ['name' => $auth['client']->name, 'host' => parse_url($auth['redirect_uri'], PHP_URL_HOST)],
            'server' => ['name' => $server->name, 'slug' => $server->slug, 'icon' => $server->icon],
            'scopes' => $auth['scopes'],
            'query' => $request->only(['client_id', 'redirect_uri', 'scope', 'state', 'response_type', 'code_challenge', 'code_challenge_method']),
        ]);
    }

    public function decide(Request $request): HttpResponse
    {
        $request->validate(['decision' => ['required', 'in:allow,deny']]);
        $auth = $this->oauth->authorizeRequest($request->input('query', []));
        if ($request->input('decision') === 'deny') {
            $url = $this->oauth->redirectWith($auth['redirect_uri'], ['error' => 'access_denied', 'state' => $auth['state']]);
        } else {
            $code = $this->oauth->issueCode($auth['client'], $request->user(), $auth['redirect_uri'], $auth['scopes'], $auth['code_challenge']);
            $url = $this->oauth->redirectWith($auth['redirect_uri'], ['code' => $code, 'state' => $auth['state']]);
        }

        return Inertia::location($url);
    }
}

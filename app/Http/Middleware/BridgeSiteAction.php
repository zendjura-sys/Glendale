<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Дає застосунку викликати ті самі контролери, що й сайт: одна логіка прав, грошей і модерації.
 *
 * - Дії сайту відповідають `back()` і тостом через `Inertia::flash`. Ми підставляємо сесію в пам’яті
 *   лише на час запиту (нічого не зберігається, кук немає), а редирект перетворюємо на JSON
 *   `{ ok, message, redirect }`.
 * - Сторінки сайту (`Inertia::render`) на GET віддаються як JSON їхніх props: запит позначаємо
 *   заголовком X-Inertia, і Inertia сама повертає об’єкт сторінки.
 * - Помилки валідації й `abort()` для `api/*` уже рендеряться в JSON.
 */
class BridgeSiteAction
{
    public function handle(Request $request, Closure $next): Response
    {
        // `session()` і `$request->session()` мають бачити одне й те саме сховище в пам’яті.
        config(['session.driver' => 'array']);
        $store = app('session')->driver();
        $request->setLaravelSession($store);

        $page = $request->isMethod('GET');
        if ($page) {
            $request->headers->set('X-Inertia', 'true');
        }

        $response = $next($request);

        if ($page && $response instanceof JsonResponse && $response->headers->has('X-Inertia')) {
            $data = $response->getData(true);
            $props = is_array($data) && isset($data['props']) && is_array($data['props']) ? $data['props'] : $data;
            unset($props['errors'], $props['auth'], $props['flash'], $props['ziggy']);

            return response()->json($props, $response->getStatusCode());
        }

        if (! $response instanceof RedirectResponse) {
            return $response;
        }

        $toast = $this->toast($store->all());
        $store->flush();
        $failed = ($toast['type'] ?? 'success') === 'error';
        $path = parse_url($response->getTargetUrl(), PHP_URL_PATH);

        return response()->json([
            'ok' => ! $failed,
            'message' => $toast['message'] ?? null,
            'redirect' => is_string($path) && $path !== '' ? $path : null,
        ], $failed ? 422 : 200);
    }

    /**
     * Шукає тост у будь-якому місці флеш-даних (формат Inertia::flash може змінюватися між версіями).
     *
     * @param  array<mixed>  $data
     * @return array{type?: string, message?: string}
     */
    private function toast(array $data): array
    {
        foreach ($data as $key => $value) {
            if ($key === 'toast' && is_array($value) && isset($value['message'])) {
                return $value;
            }
            if (is_array($value)) {
                $found = $this->toast($value);
                if ($found !== []) {
                    return $found;
                }
            }
        }

        return [];
    }
}

<?php

namespace App\Http\Controllers;

use App\Services\Quality\PageVitals;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Приймає заміри швидкості з браузера (sendBeacon). Без акаунта й IP — лише сторінка, пристрій і числа. */
class VitalsController extends Controller
{
    public function store(Request $request, PageVitals $vitals): Response
    {
        // sendBeacon надсилає text/plain — розбираємо тіло самі.
        $data = json_decode((string) $request->getContent(), true);
        if (! is_array($data)) {
            return response()->noContent();
        }
        $page = is_string($data['page'] ?? null) ? $data['page'] : '';
        $device = is_string($data['device'] ?? null) ? $data['device'] : '';
        $samples = is_array($data['samples'] ?? null) ? $data['samples'] : [];
        if (preg_match('/^[a-z0-9\/_-]{1,80}$/', $page) !== 1 || ! in_array($device, PageVitals::DEVICES, true)) {
            return response()->noContent();
        }
        $clean = [];
        foreach (array_slice($samples, 0, 8) as $s) {
            if (is_array($s) && is_string($s['metric'] ?? null) && is_numeric($s['value'] ?? null)) {
                $clean[] = ['metric' => $s['metric'], 'value' => (float) $s['value']];
            }
        }
        $vitals->record($page, $device, $clean);

        return response()->noContent();
    }
}

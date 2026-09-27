<?php

namespace App\Http\Controllers\Admin;

use App\Addons\AddonInstaller;
use App\Addons\CoreModules;
use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\AddonAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class AddonController extends Controller
{
    private const TYPES = ['core', 'module', 'plugin'];

    public function __construct(private readonly AddonInstaller $installer)
    {
    }

    public function index(): InertiaResponse
    {
        // Модулі системи родин вбудовані в ядро (modules/src) — у списку
        // завантажених аддонів їх немає: вимкнути чи видалити їх не можна.
        $addons = Addon::query()
            ->whereNotIn('slug', CoreModules::slugs())
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('type');

        return Inertia::render('Admin/Addons/Index', [
            'addons' => collect(self::TYPES)->mapWithKeys(
                fn ($type) => [$type => ($addons[$type] ?? collect())->values()]
            ),
            'coreModules' => array_values(array_map(fn ($m) => [
                'slug' => $m['slug'],
                'name' => $m['manifest']['name'] ?? $m['slug'],
                'version' => $m['manifest']['version'] ?? '',
                'summary' => $m['manifest']['summary'] ?? '',
            ], CoreModules::all())),
            'recentAudit' => AddonAuditLog::query()
                ->with(['addon:id,name,type,slug', 'user:id,name'])
                ->latest()
                ->limit(30)
                ->get(),
        ]);
    }

    public function upload(Request $request, string $type): JsonResponse
    {
        if (! in_array($type, self::TYPES, true)) {
            return $this->fail('Неизвестный тип пакета', 404);
        }

        try {
            $request->validate([
                'package' => ['required', 'file', 'max:102400'], // 100 МБ
            ]);
        } catch (ValidationException $e) {
            return $this->fail('Файл не прошёл проверку', 422, $e->errors());
        }

        try {
            $addon = $this->installer->install($request->file('package'), $type, $request->user());
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (Throwable $e) {
            Log::error('addon.install.failed', ['error' => $e->getMessage()]);

            return $this->fail('Внутренняя ошибка при установке пакета', 500);
        }

        $from = $addon->getAttribute('previous_version');

        return $this->ok(
            $from
                ? "Оновлено з {$from} до {$addon->version}. Натисніть «Міграції», якщо у версії є нові."
                : 'Пакет завантажено. Активуйте його, щоб увімкнути.',
            ['addon' => $addon],
        );
    }

    public function activate(Request $request, Addon $addon): JsonResponse
    {
        try {
            $this->installer->activate($addon, $request->user());
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok('Пакет активирован.', ['addon' => $addon->fresh()]);
    }

    public function deactivate(Request $request, Addon $addon): JsonResponse
    {
        try {
            $this->installer->deactivate($addon, $request->user());
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok('Пакет деактивирован.', ['addon' => $addon->fresh()]);
    }

    public function migrate(Request $request, Addon $addon): JsonResponse
    {
        try {
            $result = $this->installer->applyMigrations($addon, $request->user());
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (RuntimeException $e) {
            return $this->fail($e->getMessage(), 500);
        }

        return $this->ok('Миграции применены.', [
            'addon' => $addon->fresh(),
            'output' => $result['output'],
        ]);
    }

    public function destroy(Request $request, Addon $addon): JsonResponse
    {
        try {
            $this->installer->uninstall($addon, $request->user());
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok('Пакет удалён.');
    }

    /** Единый JSON-контракт: { ok, message, data, errors, redirect } */
    private function ok(string $message, array $data = []): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'message' => $message,
            'data' => $data,
            'errors' => null,
            'redirect' => null,
        ]);
    }

    private function fail(string $message, int $status, array $errors = []): JsonResponse
    {
        return response()->json([
            'ok' => false,
            'message' => $message,
            'data' => null,
            'errors' => $errors,
            'redirect' => null,
        ], $status);
    }
}

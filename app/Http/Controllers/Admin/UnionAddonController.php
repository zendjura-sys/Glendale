<?php

namespace App\Http\Controllers\Admin;

use App\Addons\AddonInstaller;
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

/**
 * Аддони union.gamecon.online — окрема гілка від "Аддони" (Admin\AddonController,
 * addons.manage): той самий перевірений AddonInstaller і формат ZIP/маніфесту,
 * але власний тип ('union'), власне право (union.manage) і власна сторінка.
 * Адмін союзу не отримує доступу до core/module/plugin, і навпаки — тому
 * activate/deactivate/migrate/destroy тут СВОЇ, з явною перевіркою типу,
 * а не переиспользують Admin\AddonController (там немає такої перевірки,
 * бо той контролер довіряє власним, addons.manage-only маршрутам).
 */
class UnionAddonController extends Controller
{
    private const TYPE = 'union';

    public function __construct(private readonly AddonInstaller $installer)
    {
    }

    public function index(): InertiaResponse
    {
        $addons = Addon::query()
            ->where('type', self::TYPE)
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('Admin/Union/Addons', [
            'addons' => $addons,
            'recentAudit' => AddonAuditLog::query()
                ->whereHas('addon', fn ($q) => $q->where('type', self::TYPE))
                ->with(['addon:id,name,type,slug', 'user:id,name'])
                ->latest()
                ->limit(30)
                ->get(),
        ]);
    }

    public function upload(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'package' => ['required', 'file', 'max:102400'], // 100 МБ
            ]);
        } catch (ValidationException $e) {
            return $this->fail('Файл не прошёл проверку', 422, $e->errors());
        }

        try {
            $addon = $this->installer->install($request->file('package'), self::TYPE, $request->user());
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (Throwable $e) {
            Log::error('union.addon.install.failed', ['error' => $e->getMessage()]);

            return $this->fail('Внутрішня помилка при встановленні пакета', 500);
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
        $this->guardType($addon);

        try {
            $this->installer->activate($addon, $request->user());
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok('Пакет активовано.', ['addon' => $addon->fresh()]);
    }

    public function deactivate(Request $request, Addon $addon): JsonResponse
    {
        $this->guardType($addon);

        try {
            $this->installer->deactivate($addon, $request->user());
        } catch (Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok('Пакет деактивовано.', ['addon' => $addon->fresh()]);
    }

    public function migrate(Request $request, Addon $addon): JsonResponse
    {
        $this->guardType($addon);

        try {
            $result = $this->installer->applyMigrations($addon, $request->user());
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 422);
        } catch (RuntimeException $e) {
            return $this->fail($e->getMessage(), 500);
        }

        return $this->ok('Міграції застосовано.', [
            'addon' => $addon->fresh(),
            'output' => $result['output'],
        ]);
    }

    public function destroy(Request $request, Addon $addon): JsonResponse
    {
        $this->guardType($addon);

        try {
            $this->installer->uninstall($addon, $request->user());
        } catch (InvalidArgumentException $e) {
            return $this->fail($e->getMessage(), 422);
        }

        return $this->ok('Пакет видалено.');
    }

    /** 404, а не 403 — з погляду цього розділу такого пакета просто не існує. */
    private function guardType(Addon $addon): void
    {
        abort_unless($addon->type === self::TYPE, 404);
    }

    /** Єдиний JSON-контракт: { ok, message, data, errors, redirect } */
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

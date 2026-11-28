<?php

namespace App\Http\Controllers;

use App\Models\CrosspostTarget;
use App\Services\Crosspost\Crossposting;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/** Налаштування автопостингу людини чи сервера (Discord-вебхуки й Telegram-канали). */
class CrosspostController extends Controller
{
    public function __construct(private readonly Crossposting $crossposting) {}

    public function index(Request $request, string $type, int $id): JsonResponse
    {
        $this->guard($request, $type, $id);

        return response()->json(['targets' => $this->crossposting->list($type, $id), 'events' => CrosspostTarget::EVENTS[$type]]);
    }

    public function store(Request $request, string $type, int $id): JsonResponse
    {
        $this->guard($request, $type, $id);
        $data = $request->validate([
            'platform' => ['required', Rule::in(CrosspostTarget::PLATFORMS)],
            'target' => ['required', 'string', 'max:300'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => [Rule::in(CrosspostTarget::EVENTS[$type])],
        ]);
        $row = $this->crossposting->add($type, $id, $data['platform'], $data['target'], $data['events']);
        Log::info('crosspost: added', ['owner' => "{$type}:{$id}", 'target' => $row->id, 'platform' => $row->platform, 'by' => $request->user()->id]);

        return response()->json(['targets' => $this->crossposting->list($type, $id)], 201);
    }

    public function update(Request $request, string $type, int $id, CrosspostTarget $target): JsonResponse
    {
        $this->guard($request, $type, $id, $target);
        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'events' => ['sometimes', 'array', 'min:1'],
            'events.*' => [Rule::in(CrosspostTarget::EVENTS[$type])],
        ]);
        $target->update($data);

        return response()->json(['targets' => $this->crossposting->list($type, $id)]);
    }

    public function destroy(Request $request, string $type, int $id, CrosspostTarget $target): JsonResponse
    {
        $this->guard($request, $type, $id, $target);
        $target->delete();
        Log::info('crosspost: removed', ['owner' => "{$type}:{$id}", 'target' => $target->id, 'by' => $request->user()->id]);

        return response()->json(['targets' => $this->crossposting->list($type, $id)]);
    }

    private function guard(Request $request, string $type, int $id, ?CrosspostTarget $target = null): void
    {
        app(Plugins::class)->ensure('crossposting');
        abort_unless(in_array($type, CrosspostTarget::OWNERS, true), 404);
        abort_unless(Crossposting::canManage($request->user(), $type, $id), 403);
        abort_if($target !== null && ($target->owner_type !== $type || $target->owner_id !== $id), 404);
    }
}

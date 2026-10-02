<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyItem;
use App\Models\FamilyItemLog;
use App\Services\Families\FamilyAudit;
use App\Services\Families\Warehouse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FamilyWarehouseController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        $tab = in_array($request->string('tab')->toString(), ['log', 'alerts'], true) && $can['warehouse.logs'] ? $request->string('tab')->toString() : 'stock';

        $items = FamilyItem::query()->where('family_id', $family->id)
            ->when(! $can['warehouse.manage'], fn ($q) => $q->where('is_archived', false))
            ->orderBy('is_archived')->orderBy('category')->orderBy('position')->orderBy('name')
            ->get();

        $logs = $tab === 'stock'
            ? FamilyItemLog::query()->with('item')->where('member_id', $member->id)->latest('id')->limit(15)->get()
            : FamilyItemLog::query()->with(['item', 'member'])->where('family_id', $family->id)
                ->when($tab === 'alerts', fn ($q) => $q->where('is_suspicious', true))
                ->latest('id')->limit(200)->get();

        $leaders = $can['warehouse.logs']
            ? FamilyItemLog::query()
                ->selectRaw('member_id, sum(quantity) as total, count(*) as times')
                ->where('family_id', $family->id)->where('action', 'take')
                ->where('created_at', '>=', now()->subDay())
                ->groupBy('member_id')->orderByDesc('total')->limit(5)
                ->with('member')->get()
                ->map(fn (FamilyItemLog $l) => ['display' => $l->member?->displayName(), 'total' => (int) $l->getAttribute('total'), 'times' => (int) $l->getAttribute('times')])
            : [];

        return $this->page($family, $member, 'families/warehouse', 'warehouse', [
            'tab' => $tab,
            'items' => $items->map(fn (FamilyItem $i) => $i->toCard()),
            'categories' => FamilyItem::CATEGORIES,
            'logs' => $logs->map(fn (FamilyItemLog $l) => [
                'id' => $l->id,
                'item' => $l->item->name,
                'unit' => $l->item->unit,
                'action' => $l->action,
                'action_label' => FamilyItemLog::ACTIONS[$l->action],
                'quantity' => $l->quantity,
                'quantity_after' => $l->quantity_after,
                'comment' => $l->comment,
                'is_suspicious' => $l->is_suspicious,
                'member' => $l->relationLoaded('member') ? $l->member?->displayName() : null,
                'proof_url' => $l->proof_path ? route('families.warehouse.proof', [$family, $l->id], absolute: false) : null,
                'created_at' => $l->created_at->toIso8601String(),
            ]),
            'top_takers' => $leaders,
        ]);
    }

    public function move(Request $request, Family $family, Warehouse $warehouse): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $data = $request->validate([
            'item_id' => ['required', 'integer'],
            'action' => ['required', Rule::in(['take', 'put'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:100000'],
            'comment' => ['nullable', 'string', 'max:300'],
            'proof' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $item = FamilyItem::query()->where('family_id', $family->id)->findOrFail($request->integer('item_id'));
        $log = $warehouse->move($family, $member, $item, $data['action'], (int) $data['quantity'], $data['comment'] ?? null, $request->file('proof'));

        Inertia::flash('toast', [
            'type' => $log->is_suspicious ? 'error' : 'success',
            'message' => $log->is_suspicious
                ? "Записано, але перевищено квоту {$item->hourly_quota}/год — офіцерів сповіщено."
                : ($data['action'] === 'take' ? 'Узято' : 'Покладено')." {$data['quantity']} × {$item->name}. Залишок: {$log->quantity_after}.",
        ]);

        return back();
    }

    public function storeItem(Request $request, Family $family, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, 'warehouse.manage', write: true);
        $data = $request->validate($this->itemRules());

        $item = $family->items()->create([...$data, 'quantity' => (int) ($data['quantity'] ?? 0)]);
        $audit->log($family, 'WAREHOUSE_ITEM', $member, null, ['created' => $item->name, 'quota' => $item->hourly_quota]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Позицію «{$item->name}» додано."]);

        return back();
    }

    public function updateItem(Request $request, Family $family, FamilyItem $item, FamilyAudit $audit, Warehouse $warehouse): RedirectResponse
    {
        $member = $this->member($request, $family, 'warehouse.manage', write: true);
        $data = $request->validate([...$this->itemRules(), 'is_archived' => ['sometimes', 'boolean'], 'comment' => ['nullable', 'string', 'max:300']]);

        $quantity = $data['quantity'] ?? null;
        $comment = $data['comment'] ?? null;
        unset($data['quantity'], $data['comment']);

        $before = $item->only(['name', 'hourly_quota', 'min_stock', 'is_archived']);
        $item->update($data);
        $audit->log($family, 'WAREHOUSE_ITEM', $member, null, ['item' => $item->name, 'from' => $before, 'to' => $item->only(array_keys($before))]);

        if ($quantity !== null && (int) $quantity !== $item->quantity) {
            $warehouse->adjust($family, $member, $item, (int) $quantity, $comment ?: 'Інвентаризація');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Позицію оновлено.']);

        return back();
    }

    public function proof(Request $request, Family $family, int $log): StreamedResponse
    {
        $member = $this->member($request, $family);
        $entry = FamilyItemLog::query()->where('family_id', $family->id)->findOrFail($log);
        abort_unless($entry->member_id === $member->id || $this->gate->can($member, $family, 'warehouse.logs'), 403);
        abort_if($entry->proof_path === null || $entry->proof_path === '', 404);

        return Storage::disk('local')->response($entry->proof_path);
    }

    /**
     * @return array<string, mixed>
     */
    private function itemRules(): array
    {
        return [
            'category' => ['required', Rule::in(array_keys(FamilyItem::CATEGORIES))],
            'name' => ['required', 'string', 'max:60'],
            'unit' => ['nullable', 'string', 'max:12'],
            'quantity' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'hourly_quota' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'min_stock' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }
}

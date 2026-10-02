<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyItem;
use App\Models\FamilyItemLog;
use App\Models\FamilyMember;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Общак: облік спорядження з квотами на годину й сигналами про підозрілі зняття.
 */
class Warehouse
{
    public function __construct(
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
    ) {}

    public function move(Family $family, FamilyMember $member, FamilyItem $item, string $action, int $quantity, ?string $comment, ?UploadedFile $proof = null): FamilyItemLog
    {
        if ($item->is_archived) {
            throw ValidationException::withMessages(['item_id' => 'Позиція в архіві.']);
        }

        $log = DB::transaction(function () use ($family, $member, $item, $action, $quantity, $comment, $proof) {
            $locked = FamilyItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail();
            if ($action === 'take' && $locked->quantity < $quantity) {
                throw ValidationException::withMessages(['quantity' => "На складі лише {$locked->quantity} {$locked->unit}."]);
            }

            $after = $locked->quantity + ($action === 'take' ? -$quantity : $quantity);
            $suspicious = false;
            if ($action === 'take' && $locked->hourly_quota) {
                $taken = (int) FamilyItemLog::query()
                    ->where('item_id', $locked->id)
                    ->where('member_id', $member->id)
                    ->where('action', 'take')
                    ->where('created_at', '>=', now()->subHour())
                    ->sum('quantity');
                $suspicious = $taken + $quantity > $locked->hourly_quota;
            }

            $locked->update(['quantity' => $after]);
            $item->quantity = $after;

            return FamilyItemLog::query()->create([
                'family_id' => $family->id,
                'item_id' => $locked->id,
                'member_id' => $member->id,
                'action' => $action,
                'quantity' => $quantity,
                'quantity_after' => $after,
                'proof_path' => $proof?->store('family-warehouse/'.$family->id, 'local'),
                'comment' => $comment,
                'is_suspicious' => $suspicious,
                'created_at' => now(),
            ]);
        });

        if ($log->is_suspicious) {
            $this->audit->log($family, 'WAREHOUSE_ALERT', $member, $member, [
                'item' => $item->name,
                'quantity' => $quantity,
                'quota' => $item->hourly_quota,
            ]);
            $this->notifier->holders($family, 'warehouse.manage', 'warehouse', "⚠️ {$member->displayName()} узяв {$quantity} × {$item->name} — понад квоту {$item->hourly_quota}/год", route('families.warehouse', [$family, 'tab' => 'alerts'], absolute: false), $member);
        } elseif ($item->min_stock !== null && $log->quantity_after <= $item->min_stock && $action === 'take') {
            $this->notifier->holders($family, 'warehouse.manage', 'warehouse', "На складі закінчується «{$item->name}»: {$log->quantity_after} {$item->unit}", route('families.warehouse', $family, absolute: false));
        }

        $this->notifier->refresh($family, 'warehouse');

        return $log;
    }

    public function adjust(Family $family, FamilyMember $actor, FamilyItem $item, int $quantity, ?string $comment): FamilyItemLog
    {
        $log = DB::transaction(function () use ($family, $actor, $item, $quantity, $comment) {
            $locked = FamilyItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail();
            $delta = $quantity - $locked->quantity;
            $locked->update(['quantity' => $quantity]);

            $this->audit->log($family, 'WAREHOUSE_ADJUST', $actor, null, [
                'item' => $locked->name,
                'before' => $quantity - $delta,
                'after' => $quantity,
                'comment' => $comment,
            ]);

            return FamilyItemLog::query()->create([
                'family_id' => $family->id,
                'item_id' => $locked->id,
                'member_id' => $actor->id,
                'action' => 'adjust',
                'quantity' => $delta,
                'quantity_after' => $quantity,
                'comment' => $comment,
                'created_at' => now(),
            ]);
        });

        $this->notifier->refresh($family, 'warehouse');

        return $log;
    }

    public function seedStarter(Family $family): void
    {
        foreach (FamilyItem::STARTER as $i => [$category, $name, $unit, $quota]) {
            $family->items()->create([
                'category' => $category,
                'name' => $name,
                'unit' => $unit,
                'quantity' => 0,
                'hourly_quota' => $quota,
                'position' => $i,
            ]);
        }
    }
}

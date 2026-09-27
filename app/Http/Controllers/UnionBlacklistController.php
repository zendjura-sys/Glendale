<?php

namespace App\Http\Controllers;

use App\Models\UnionBlacklistedPlayer;
use App\Models\UnionComplaint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * ЧС гравців з боку союзників: додати може будь-який зареєстрований
 * союзник (union_family_name заповнене реєстрацією через union.gamecon.online),
 * а не лише лідер чи адмін — на відміну від ЧСС родин (Admin\UnionBlacklistController).
 */
class UnionBlacklistController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorizeUnionMember($request);

        return Inertia::render('Union/Blacklist', [
            'players' => UnionBlacklistedPlayer::query()
                ->with('addedBy:id,name')
                ->latest()
                ->get(),
            'reasons' => UnionComplaint::REASONS,
        ]);
    }

    public function storePlayer(Request $request): RedirectResponse
    {
        $this->authorizeUnionMember($request);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'family_name' => ['nullable', 'string', 'max:150'],
            'reasons' => ['required', 'array', 'min:1'],
            'reasons.*' => ['string', 'in:'.implode(',', array_keys(UnionComplaint::REASONS))],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        UnionBlacklistedPlayer::create([
            ...$data,
            'added_by' => $request->user()->id,
        ]);

        return back()->with('status', 'Гравця додано до чорного списку.');
    }

    /** ЧС гравців — фіча лише для союзників, не для учасників самої Monsory. */
    private function authorizeUnionMember(Request $request): void
    {
        abort_unless($request->user()->union_family_name !== null, 403);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;

abstract class ApiController extends Controller
{
    protected function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401, 'Потрібна авторизація.');

        return $user;
    }

    /**
     * @param  LengthAwarePaginator<int, mixed>  $paginator
     * @param  array<mixed>  $data
     * @return array{data: list<mixed>, current_page: int, last_page: int, total: int}
     */
    protected function page(LengthAwarePaginator $paginator, array $data): array
    {
        return [
            'data' => array_values($data),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
        ];
    }
}

<?php

namespace App\Support;

use App\Models\User;
use App\Services\Phones\PhoneNumbers;
use App\Support\Modules\ModuleManager;

/**
 * Перші кроки новачка (сайт і застосунок однаково): номер → режим соцмережі → ігри й сервери.
 * step() каже, який крок зараз, або null — онбординг пройдено.
 */
class Onboarding
{
    public function __construct(private readonly PhoneNumbers $phones, private readonly NetworkModes $modes) {}

    /** 'phone' | 'mode' | 'interests' | null */
    public function step(User $user): ?string
    {
        if ($user->pref('onboarded') !== false) {
            return null;
        }
        if ($this->phoneStepPending($user)) {
            return 'phone';
        }
        if ($user->pref('network_mode') === null) {
            return 'mode';
        }
        $visible = $this->modes->modulesFor($user);

        return in_array('games', $visible, true) || in_array('servers', $visible, true) ? 'interests' : null;
    }

    /** Новачок ще не пройшов крок номера (і модуль «Телефон» увімкнено). */
    public function phoneStepPending(User $user): bool
    {
        return $user->pref('onboarded') === false && $user->pref('phone_step') !== 'done'
            && app(ModuleManager::class)->enabled('phone') && $this->phones->current($user) === null;
    }
}

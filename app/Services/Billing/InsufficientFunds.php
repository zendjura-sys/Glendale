<?php

namespace App\Services\Billing;

use RuntimeException;

/** На рахунку не вистачає коштів. shortfall — скільки бракує, копійок. */
class InsufficientFunds extends RuntimeException
{
    public function __construct(public readonly int $shortfall)
    {
        parent::__construct('Недостатньо коштів на рахунку.');
    }
}

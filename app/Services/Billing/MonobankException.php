<?php

namespace App\Services\Billing;

use RuntimeException;

/** Помилка еквайрингу monobank: повідомлення можна показати людині (без секретів і технічних деталей). */
class MonobankException extends RuntimeException {}

<?php

namespace App\Services\Billing;

use RuntimeException;

/** Помилка перевірки покупки Google Play; code — HTTP-статус для відповіді застосунку. */
class GooglePlayException extends RuntimeException {}

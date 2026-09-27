<?php

namespace Tests;

use App\Models\Setting;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // RefreshDatabase откатывает данные, но статику процесса — нет, и
        // настройка, записанная в предыдущем тесте, протекала в следующий.
        Setting::flushMemo();
        \App\Families\FamilyContext::flush();
    }
}

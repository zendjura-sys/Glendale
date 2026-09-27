<script setup>
import { Link } from '@inertiajs/vue3';

// Вхід, реєстрація, відновлення пароля — у тому самому оформленні, що й
// увесь сайт: той самий фон-аврора, скляна картка й логотип, що в шапці.
const year = new Date().getFullYear();
</script>

<template>
    <div class="gc-guest">
        <div class="gc-aurora" aria-hidden="true"><i /><i /><i /><i /></div>

        <Link href="/" class="gc-guest-logo" aria-label="GameConnect">
            <span class="gc-logo-mark">G</span>
            <span class="gc-logo-text">
                <span class="gc-logo-main">GAME</span>
                <span class="gc-logo-sub">CONNECT</span>
            </span>
        </Link>

        <div class="gc-guest-card">
            <slot />
        </div>

        <p class="gc-guest-foot">GameConnect © {{ year }} · соцмережа, родини й союзи всіх RP-проєктів</p>
    </div>
</template>

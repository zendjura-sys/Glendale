<script setup>
import { onBeforeUnmount, onMounted } from 'vue';

// Навігація (шапка, бокове меню, нижня панель) — спільна оболонка сайту
// (resources/app/shell.tsx), та сама, що в соцмережі. Тут лише вміст сторінки.

// Heartbeat онлайн-статусу (🟢 у месенджері): поки вкладка відкрита й
// видима, раз на 45с — щоб учасник, який просто читає сторінку без
// переходів, не ставав 🔴. Мітку ставить серверний TrackLastSeen.
let presenceTimer = null;
function pingPresence() {
    if (document.visibilityState !== 'visible' || !route().has('presence.ping')) return;
    window.axios.post(route('presence.ping')).catch(() => {});
}
onMounted(() => {
    presenceTimer = setInterval(pingPresence, 45000);
    document.addEventListener('visibilitychange', pingPresence);
});
onBeforeUnmount(() => {
    clearInterval(presenceTimer);
    document.removeEventListener('visibilitychange', pingPresence);
});
</script>

<template>
    <div class="gc-page">
        <header v-if="$slots.header" class="gc-page-head">
            <slot name="header" />
        </header>
        <slot />
    </div>
</template>

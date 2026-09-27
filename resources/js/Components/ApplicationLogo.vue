<script setup>
import { usePage } from '@inertiajs/vue3';
import { computed } from 'vue';

defineProps({
    mark: { type: Boolean, default: false },
});

// Логотип, загруженный в админке (Дизайн → Бренд), вытесняет встроенный
// знак. Пока его нет — рисуем ромб с буквой M, как и раньше.
const uploaded = computed(() => usePage().props.design?.logoUrl || null);
</script>

<template>
    <!-- Фірмовий знак Monsory: ромб з літерою M — та сама форма, що вже
         використовується у навігації Home.vue, тепер єдиний компонент
         замість дефолтного лого Laravel. -->
    <img
        v-if="uploaded"
        :src="uploaded"
        alt=""
        class="object-contain"
    />
    <span v-else-if="mark" class="inline-flex rotate-45 items-center justify-center rounded-md border border-gold-400/40 bg-gradient-to-br from-gold-400/20 to-transparent">
        <span class="-rotate-45 font-display text-gold-300"><slot>G</slot></span>
    </span>
    <svg v-else viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="monsory-logo-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <!-- Через переменные палитры: иначе при смене акцента в
                     админке весь сайт перекрашивается, а логотип остаётся
                     золотым. -->
                <stop offset="0%" stop-color="rgb(var(--gold-200))" />
                <stop offset="45%" stop-color="rgb(var(--gold-400))" />
                <stop offset="100%" stop-color="rgb(var(--gold-600))" />
            </linearGradient>
        </defs>
        <rect x="18" y="18" width="64" height="64" rx="10" transform="rotate(45 50 50)" fill="none" stroke="url(#monsory-logo-gold)" stroke-width="3" />
        <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="Montserrat, sans-serif" font-size="40" font-weight="700" fill="url(#monsory-logo-gold)">G</text>
    </svg>
</template>

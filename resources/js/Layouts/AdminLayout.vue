<script setup>
// Меню адмінки — у спільній оболонці сайту (resources/app/shell.tsx):
// групи розділів у боковому меню, на телефоні — чіпи над сторінкою,
// як в адмінці соцмережі. Тут лише заголовок і вміст розділу.
defineProps({
    title: { type: String, default: '' },
});
</script>

<template>
    <div class="gc-page gc-admin">
        <header v-if="title" class="gc-page-head">
            <h1>{{ title }}</h1>
        </header>
        <slot />
    </div>
</template>

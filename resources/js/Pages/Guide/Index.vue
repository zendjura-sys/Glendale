<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import { Head } from '@inertiajs/vue3';

defineProps({
    categories: {
        type: Array,
        default: () => [],
    },
});
</script>

<template>
    <Head title="Довідка" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">
                Довідка
            </h2>
        </template>

        <div class="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            <p class="text-sm text-white/50">
                Що робити і куди тиснути — за категоріями. Той самий довідник, скорочено,
                є й у мобільному застосунку.
            </p>

            <!-- Швидка навігація по категоріях -->
            <nav class="glass-panel flex flex-wrap gap-2 p-4">
                <a
                    v-for="category in categories"
                    :key="'nav-'+category.slug"
                    :href="'#'+category.slug"
                    class="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-gold-400/50 hover:text-gold-300"
                >
                    {{ category.icon }} {{ category.title }}
                </a>
            </nav>

            <div
                v-for="category in categories"
                :key="category.slug"
                :id="category.slug"
                v-reveal
                class="glass-panel scroll-mt-24 p-6 sm:p-8"
            >
                <h3 class="font-display flex items-center gap-2 text-lg font-normal text-white">
                    <span>{{ category.icon }}</span>
                    <span>{{ category.title }}</span>
                </h3>

                <div class="mt-5 space-y-3">
                    <details
                        v-for="item in category.items"
                        :key="item.q"
                        class="group rounded-xl border border-white/10 bg-obsidian-900/40 px-4 py-3 open:bg-obsidian-900/60"
                    >
                        <summary
                            class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-white/80 marker:content-none group-open:text-gold-300"
                        >
                            {{ item.q }}
                            <span class="text-white/30 transition-transform group-open:rotate-45">＋</span>
                        </summary>
                        <p class="mt-3 text-sm leading-relaxed text-white/50">
                            {{ item.a }}
                        </p>
                    </details>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>

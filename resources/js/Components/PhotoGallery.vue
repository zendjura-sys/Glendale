<script setup>
import { onUnmounted, ref, watch } from 'vue';

const props = defineProps({
    photos: { type: Array, default: () => [] },
    // Скільки міні-прев'ю показати в стрічці до того, як решта згорнеться в "+N".
    visible: { type: Number, default: 4 },
});

const openIndex = ref(null);

function open(i) {
    openIndex.value = i;
}
function close() {
    openIndex.value = null;
}
function prev() {
    if (openIndex.value === null) return;
    openIndex.value = (openIndex.value - 1 + props.photos.length) % props.photos.length;
}
function next() {
    if (openIndex.value === null) return;
    openIndex.value = (openIndex.value + 1) % props.photos.length;
}
function onKeydown(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
}

// window, а не tabindex+focus на самому оверлеї: на дотику (телефон) фокус
// на div ніхто не ставить, а клавіатура на десктопі мусить працювати
// одразу після відкриття, без додаткового кліку "щоб взяти фокус".
watch(openIndex, (value) => {
    if (value !== null) {
        window.addEventListener('keydown', onKeydown);
    } else {
        window.removeEventListener('keydown', onKeydown);
    }
});

onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <div v-if="photos.length" class="flex flex-wrap gap-2">
        <button
            v-for="(photo, i) in photos.slice(0, visible)"
            :key="photo.id"
            type="button"
            class="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10"
            @click="open(i)"
        >
            <img :src="photo.url" :alt="photo.original_name || 'Фото'" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
            <span
                v-if="i === visible - 1 && photos.length > visible"
                class="absolute inset-0 flex items-center justify-center bg-obsidian-950/70 text-sm font-medium text-white"
            >
                +{{ photos.length - visible }}
            </span>
        </button>
    </div>

    <Teleport to="body">
        <div
            v-if="openIndex !== null"
            class="fixed inset-0 z-[200] flex items-center justify-center bg-obsidian-950/95 backdrop-blur-sm"
            @click.self="close"
        >
            <button
                class="absolute right-4 top-4 rounded-full border border-white/15 p-2 text-white/70 hover:border-white/30 hover:text-white"
                aria-label="Закрити"
                @click="close"
            >
                ✕
            </button>

            <button
                v-if="photos.length > 1"
                class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/15 p-3 text-white/70 hover:border-gold-400/40 hover:text-white sm:left-6"
                aria-label="Попереднє фото"
                @click.stop="prev"
            >
                ‹
            </button>
            <button
                v-if="photos.length > 1"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/15 p-3 text-white/70 hover:border-gold-400/40 hover:text-white sm:right-6"
                aria-label="Наступне фото"
                @click.stop="next"
            >
                ›
            </button>

            <img
                :src="photos[openIndex].url"
                :alt="photos[openIndex].original_name || 'Фото'"
                class="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
                @click.stop
            />

            <span v-if="photos.length > 1" class="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-obsidian-950/70 px-3 py-1 text-xs text-white/60">
                {{ openIndex + 1 }} / {{ photos.length }}
            </span>
        </div>
    </Teleport>
</template>

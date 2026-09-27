<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, Link, router, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    jobs: { type: Object, required: true },
});

const status = computed(() => usePage().props.flash?.status);
const expanded = ref(null);

function toggle(id) {
    expanded.value = expanded.value === id ? null : id;
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function retry(job) {
    router.post(route('admin.failed-jobs.retry', job.id), {}, { preserveScroll: true });
}

function retryAll() {
    if (!confirm(`Повторити всі ${props.jobs.total} провалені джоби?`)) return;
    router.post(route('admin.failed-jobs.retry-all'), {}, { preserveScroll: true });
}

function destroy(job) {
    if (!confirm('Видалити цей запис без повторної спроби?')) return;
    router.delete(route('admin.failed-jobs.destroy', job.id), { preserveScroll: true });
}

function clearAll() {
    if (!confirm('Видалити ВЕСЬ список провалених джоб без повторних спроб?')) return;
    router.delete(route('admin.failed-jobs.clear'), { preserveScroll: true });
}
</script>

<template>
    <Head title="Провалені джоби" />

    <AdminLayout title="Провалені джоби">
        <p
            v-if="status"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
            {{ status }}
        </p>

        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-white/40">
                Джоби в черзі, які впали з винятком — розсилки, тижневі премії тощо. Без цього списку вони зникали б непомітно.
            </p>
            <div v-if="jobs.data.length > 0" class="flex gap-2">
                <button
                    type="button"
                    class="glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                    @click="retryAll"
                >
                    Повторити всі
                </button>
                <button
                    type="button"
                    class="rounded-xl border border-ember-500/25 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ember-500/80 hover:bg-ember-600/10"
                    @click="clearAll"
                >
                    Очистити все
                </button>
            </div>
        </div>

        <div v-if="jobs.data.length === 0" class="glass-panel p-12 text-center text-white/30">
            Провалених джоб немає — черга в порядку.
        </div>

        <div v-else class="space-y-3">
            <div
                v-for="job in jobs.data"
                :key="job.id"
                class="glass-panel p-5"
            >
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="font-display text-sm text-white">{{ job.job_name }}</p>
                        <p class="mt-1 text-xs text-white/30">
                            {{ fmtDate(job.failed_at) }} · черга «{{ job.queue }}» · зʼєднання «{{ job.connection }}»
                        </p>
                    </div>
                    <div class="flex shrink-0 gap-2">
                        <button
                            type="button"
                            class="rounded-xl border border-emerald-400/30 px-3 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-400/10"
                            @click="retry(job)"
                        >
                            Повторити
                        </button>
                        <button
                            type="button"
                            class="rounded-xl border border-ember-500/25 px-3 py-1.5 text-[11px] text-ember-500/80 hover:bg-ember-600/10"
                            @click="destroy(job)"
                        >
                            Видалити
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    class="mt-3 text-left text-xs text-white/40 hover:text-white/70"
                    @click="toggle(job.id)"
                >
                    <span class="font-mono">{{ job.exception_summary }}</span>
                    <span class="ml-1 text-gold-300/70">{{ expanded === job.id ? '(згорнути)' : '(повний текст)' }}</span>
                </button>
                <pre
                    v-if="expanded === job.id"
                    class="mt-2 max-h-96 overflow-auto rounded-xl border border-white/10 bg-obsidian-950/60 p-4 text-[11px] leading-relaxed text-white/50"
                >{{ job.exception }}</pre>
            </div>
        </div>

        <div v-if="jobs.links?.length > 3" class="mt-6 flex flex-wrap gap-2">
            <Link
                v-for="link in jobs.links"
                :key="link.label"
                :href="link.url || ''"
                v-html="link.label"
                class="rounded-xl border px-3 py-1.5 text-xs"
                :class="[
                    link.active ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white',
                    !link.url && 'pointer-events-none opacity-30',
                ]"
            />
        </div>
    </AdminLayout>
</template>

<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    profiles: { type: Object, required: true },
});

const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 4000);
}

const adjustingUserId = ref(null);
const amount = ref(0);
const reason = ref('');
const busy = ref(false);

function openAdjust(userId) {
    adjustingUserId.value = adjustingUserId.value === userId ? null : userId;
    amount.value = 0;
    reason.value = '';
}

async function submitAdjust(userId) {
    busy.value = true;
    try {
        const { data } = await window.axios.post('/admin/progression/adjust', {
            user_id: userId,
            amount: amount.value,
            reason: reason.value,
        });
        pushToast(data.ok, data.message);
        if (data.ok) {
            adjustingUserId.value = null;
            window.location.reload();
        }
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <Head title="Прогресія — адміністрування" />

    <AdminLayout title="Прогресія — адміністрування">
        <div class="pointer-events-none fixed inset-x-4 top-6 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-sm">
            <TransitionGroup name="toast">
                <div
                    v-for="t in toasts"
                    :key="t.id"
                    class="pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md"
                    :class="t.ok ? 'border-emerald-400/30 bg-emerald-950/80 text-emerald-200' : 'border-ember-500/30 bg-ember-600/20 text-ember-500'"
                >
                    {{ t.message }}
                </div>
            </TransitionGroup>
        </div>

        <div class="max-w-5xl">
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div v-for="p in profiles.data" :key="p.id" class="border-b border-white/5 px-6 py-4 last:border-0">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div class="font-medium text-white">{{ p.user?.name }}</div>
                            <div class="text-xs text-white/40">{{ p.user?.email }}</div>
                        </div>
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="whitespace-nowrap font-display text-lg text-gold-300">{{ p.xp }} очок досвіду</span>
                            <button
                                class="shrink-0 rounded-xl border border-white/15 px-4 py-1.5 text-xs text-white/60 hover:border-white/30"
                                @click="openAdjust(p.id)"
                            >
                                {{ adjustingUserId === p.id ? 'Скасувати' : 'Скоригувати' }}
                            </button>
                        </div>
                    </div>

                    <div v-if="adjustingUserId === p.id" class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-obsidian-900/60 p-4">
                        <div>
                            <label class="mb-1 block text-[11px] uppercase tracking-widest text-white/40">Досвід (може бути від'ємним)</label>
                            <input v-model.number="amount" type="number" class="w-32 rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                        </div>
                        <div class="flex-1">
                            <label class="mb-1 block text-[11px] uppercase tracking-widest text-white/40">Причина</label>
                            <input v-model="reason" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" placeholder="Ручна корекція..." />
                        </div>
                        <button
                            :disabled="busy || !reason"
                            class="rounded-xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-obsidian-950 disabled:opacity-40"
                            @click="submitAdjust(p.user_id)"
                        >
                            Застосувати
                        </button>
                    </div>
                </div>
                <div v-if="profiles.data.length === 0" class="px-6 py-12 text-center text-white/30">
                    Учасників з профілем прогресу поки немає
                </div>
            </div>
        </div>
    </AdminLayout>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
    opacity: 0;
    transform: translateX(30px);
}
.toast-leave-to {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
}
</style>

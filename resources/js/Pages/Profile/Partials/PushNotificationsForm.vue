<script setup>
import { computed, onMounted, ref } from 'vue';
import { usePage } from '@inertiajs/vue3';
import { getExistingSubscription, isWebPushSupported, pushPermission, subscribeToPush, unsubscribeFromPush } from '@/lib/webPush';

const page = usePage();
const publicKey = computed(() => page.props.webPushPublicKey);

const supported = isWebPushSupported();
const subscribed = ref(false);
const loading = ref(true);
const busy = ref(false);
const error = ref(null);

async function refresh() {
    if (supported) {
        subscribed.value = Boolean(await getExistingSubscription());
    }
    loading.value = false;
}

async function enable() {
    error.value = null;
    busy.value = true;
    try {
        await subscribeToPush(publicKey.value);
        subscribed.value = true;
    } catch (e) {
        error.value = e.message === 'permission-denied'
            ? 'Дозвіл на сповіщення відхилено — увімкніть його в налаштуваннях браузера.'
            : 'Не вдалося увімкнути push-сповіщення.';
    } finally {
        busy.value = false;
    }
}

async function disable() {
    busy.value = true;
    try {
        await unsubscribeFromPush();
        subscribed.value = false;
    } finally {
        busy.value = false;
    }
}

onMounted(refresh);
</script>

<template>
    <section v-if="supported && publicKey">
        <header>
            <h2 class="font-display text-lg font-normal text-white">Push-сповіщення</h2>
            <p class="mt-1 text-sm text-white/40">
                Отримуйте сповіщення прямо в браузер чи на телефон — навіть коли вкладка сайту закрита.
            </p>
        </header>

        <div v-if="!loading" class="mt-6">
            <div
                v-if="subscribed"
                class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3"
            >
                <p class="text-sm text-emerald-200">Увімкнено на цьому пристрої</p>
                <button
                    :disabled="busy"
                    class="text-xs uppercase tracking-widest text-white/40 transition-colors hover:text-white disabled:opacity-40"
                    @click="disable"
                >
                    Вимкнути
                </button>
            </div>

            <div v-else>
                <button
                    :disabled="busy || pushPermission() === 'denied'"
                    class="rounded-xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03] disabled:opacity-40"
                    @click="enable"
                >
                    {{ busy ? 'Вмикаємо…' : 'Увімкнути push-сповіщення' }}
                </button>
                <p v-if="pushPermission() === 'denied'" class="mt-3 text-xs text-white/30">
                    Дозвіл відхилено раніше — щоб увімкнути, дозвольте сповіщення для сайту в налаштуваннях браузера.
                </p>
                <p v-if="error" class="mt-2 text-xs text-ember-500">{{ error }}</p>
            </div>
        </div>
    </section>
</template>

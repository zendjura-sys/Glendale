<script setup>
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';

const page = usePage();
const enabled = computed(() => page.props.auth.user.two_factor_enabled);

// setting=true між "Увімкнути" і успішним підтвердженням коду — секрет уже
// записано на сервері (ще не підтверджений), тут показуємо QR і форму коду.
const setting = ref(false);
const qrSvg = ref(null);
const recoveryCodes = ref(page.props.flash?.recoveryCodes ?? null);

const confirmForm = useForm({ code: '' });
const disableForm = useForm({ password: '' });
const regenerateForm = useForm({ password: '' });
const showDisable = ref(false);
const showRegenerate = ref(false);

const trustedDeviceCount = ref(null);

async function refreshTrustedDevices() {
    if (!enabled.value) return;
    const { data } = await window.axios.get(route('two-factor.trusted-devices'));
    trustedDeviceCount.value = data.data.count;
}

function forgetTrustedDevices() {
    if (!confirm('Забути всі довірені пристрої? Наступний вхід усюди знову попросить код.')) return;
    router.delete(route('two-factor.forget-trusted-devices'), {
        preserveScroll: true,
        onSuccess: refreshTrustedDevices,
    });
}

watch(enabled, refreshTrustedDevices, { immediate: true });

function enable() {
    router.post(route('two-factor.enable'), {}, {
        preserveScroll: true,
        onSuccess: async () => {
            setting.value = true;
            const { data } = await window.axios.get(route('two-factor.qr-code'));
            qrSvg.value = data.svg;
        },
    });
}

function confirm() {
    confirmForm.post(route('two-factor.confirm'), {
        preserveScroll: true,
        onSuccess: () => {
            setting.value = false;
            qrSvg.value = null;
            confirmForm.reset();
        },
    });
}

function cancelSetup() {
    router.delete(route('two-factor.cancel'), {
        preserveScroll: true,
        onSuccess: () => {
            setting.value = false;
            qrSvg.value = null;
        },
    });
}

function disable() {
    disableForm.delete(route('two-factor.disable'), {
        preserveScroll: true,
        onSuccess: () => {
            showDisable.value = false;
            disableForm.reset();
            recoveryCodes.value = null;
        },
    });
}

function regenerate() {
    regenerateForm.post(route('two-factor.recovery-codes'), {
        preserveScroll: true,
        onSuccess: () => {
            showRegenerate.value = false;
            regenerateForm.reset();
        },
    });
}

// Флеш після confirm()/regenerate() прилітає через звичайний Inertia-редірект.
watch(() => page.props.flash?.recoveryCodes, (v) => {
    if (v) recoveryCodes.value = v;
});
</script>

<template>
    <section>
        <header>
            <h2 class="font-display text-lg font-normal text-white">
                Двофакторна автентифікація
            </h2>

            <p class="mt-1 text-sm text-white/40">
                Додатковий код із застосунку-аутентифікатора (Google Authenticator, Authy тощо) при вході — навіть якщо хтось дізнається пароль, без коду не зайде.
            </p>
        </header>

        <div class="mt-6">
            <!-- ================= УВІМКНЕНО ================= -->
            <div v-if="enabled && !setting" class="space-y-4">
                <p class="flex items-center gap-2 text-sm text-emerald-300">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Увімкнено
                </p>

                <div v-if="recoveryCodes" class="rounded-xl border border-gold-400/30 bg-gold-400/5 p-4">
                    <p class="mb-2 text-xs text-gold-200">
                        Резервні коди — збережіть їх у надійному місці. Кожен спрацює лише один раз, якщо втратите доступ до застосунку.
                    </p>
                    <div class="grid grid-cols-2 gap-1 font-mono text-xs text-white/70 sm:grid-cols-4">
                        <span v-for="code in recoveryCodes" :key="code" class="select-all">{{ code }}</span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-3">
                    <button
                        type="button"
                        class="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/30"
                        @click="showRegenerate = !showRegenerate"
                    >
                        Оновити резервні коди
                    </button>
                    <button
                        v-if="trustedDeviceCount > 0"
                        type="button"
                        class="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/30"
                        @click="forgetTrustedDevices"
                    >
                        Забути довірені пристрої ({{ trustedDeviceCount }})
                    </button>
                    <button
                        type="button"
                        class="rounded-xl border border-ember-500/25 px-4 py-2 text-xs text-ember-500/80 hover:bg-ember-600/10"
                        @click="showDisable = !showDisable"
                    >
                        Вимкнути
                    </button>
                </div>

                <form v-if="showRegenerate" @submit.prevent="regenerate" class="max-w-xs space-y-2">
                    <InputLabel for="regen_password" value="Пароль для підтвердження" />
                    <TextInput id="regen_password" v-model="regenerateForm.password" type="password" autocomplete="current-password" />
                    <InputError :message="regenerateForm.errors.password" />
                    <PrimaryButton :disabled="regenerateForm.processing">Оновити коди</PrimaryButton>
                </form>

                <form v-if="showDisable" @submit.prevent="disable" class="max-w-xs space-y-2">
                    <InputLabel for="disable_password" value="Пароль для підтвердження" />
                    <TextInput id="disable_password" v-model="disableForm.password" type="password" autocomplete="current-password" />
                    <InputError :message="disableForm.errors.password" />
                    <PrimaryButton :disabled="disableForm.processing">Вимкнути 2FA</PrimaryButton>
                </form>
            </div>

            <!-- ================= НАЛАШТУВАННЯ (QR + код) ================= -->
            <div v-else-if="setting" class="space-y-4">
                <p class="text-sm text-white/60">
                    Відскануйте QR-код застосунком-аутентифікатором, тоді введіть код, який він показує.
                </p>
                <div v-if="qrSvg" class="w-fit rounded-xl bg-white p-3" v-html="qrSvg"></div>
                <p v-else class="text-sm text-white/30">Завантаження QR-коду…</p>

                <form @submit.prevent="confirm" class="max-w-xs space-y-2">
                    <InputLabel for="two_factor_code" value="Код із застосунку" />
                    <TextInput id="two_factor_code" v-model="confirmForm.code" type="text" inputmode="numeric" autocomplete="one-time-code" class="tracking-[0.3em]" placeholder="000000" />
                    <InputError :message="confirmForm.errors.code" />
                    <div class="flex gap-3 pt-1">
                        <PrimaryButton :disabled="confirmForm.processing">Підтвердити</PrimaryButton>
                        <button type="button" class="text-xs text-white/40 hover:text-white" @click="cancelSetup">Скасувати</button>
                    </div>
                </form>
            </div>

            <!-- ================= ВИМКНЕНО ================= -->
            <div v-else>
                <p class="mb-4 flex items-center gap-2 text-sm text-white/40">
                    <span class="h-1.5 w-1.5 rounded-full bg-white/20"></span> Вимкнено
                </p>
                <PrimaryButton @click="enable">Увімкнути</PrimaryButton>
            </div>
        </div>
    </section>
</template>

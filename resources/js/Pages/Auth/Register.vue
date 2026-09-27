<script setup>
import GuestLayout from '@/Layouts/GuestLayout.vue';
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { Head, Link, useForm } from '@inertiajs/vue3';

const props = defineProps({
    shadowMatch: { type: Object, default: null },
    previousInput: { type: Object, default: null },
    isUnion: { type: Boolean, default: false },
    unionRoles: { type: Object, default: () => ({}) },
});

const form = useForm({
    first_name: props.previousInput?.first_name ?? '',
    last_name: props.previousInput?.last_name ?? '',
    email: props.previousInput?.email ?? '',
    password: '',
    password_confirmation: '',
    claim_shadow_id: null,
    skip_shadow_check: false,
    ...(props.isUnion ? { union_family_name: '', union_role: '' } : {}),
});

const submit = () => {
    form.post(route('register'), {
        onFinish: () => form.reset('password', 'password_confirmation'),
    });
};

function chooseClaim(claim) {
    form.claim_shadow_id = claim ? props.shadowMatch.id : null;
    form.skip_shadow_check = !claim;
}
</script>

<template>
    <GuestLayout>
        <Head title="Реєстрація" />

        <h1 class="font-display mb-6 text-2xl font-light text-white">Створення акаунту</h1>

        <div v-if="shadowMatch" class="mb-6 rounded-lg border border-gold-400/30 bg-gold-400/[0.06] p-4">
            <p class="text-sm text-white">
                Знайдено профіль <b>«{{ shadowMatch.name }}»</b> — за нього вже подавали звіти. Це ви?
            </p>
            <div class="mt-3 flex gap-2">
                <button
                    type="button"
                    class="rounded-xl border px-4 py-1.5 text-xs uppercase tracking-widest transition-colors"
                    :class="form.claim_shadow_id ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/15 text-white/50 hover:border-white/30'"
                    @click="chooseClaim(true)"
                >
                    Так, це я — забрати профіль
                </button>
                <button
                    type="button"
                    class="rounded-xl border px-4 py-1.5 text-xs uppercase tracking-widest transition-colors"
                    :class="form.skip_shadow_check ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/15 text-white/50 hover:border-white/30'"
                    @click="chooseClaim(false)"
                >
                    Ні, це новий акаунт
                </button>
            </div>
            <p v-if="form.claim_shadow_id" class="mt-2 text-xs text-white/40">
                Уся статистика й звіти, подані за «{{ shadowMatch.name }}», стануть вашими після реєстрації.
            </p>
        </div>

        <form @submit.prevent="submit">
            <div>
                <p class="mb-3 text-xs text-white/40">
                    Вкажіть ігрові ім'я та прізвище персонажа (те, що в грі) — за ними подаються звіти й ведеться статистика, а не за реальним іменем.
                </p>
                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <InputLabel for="first_name" value="Ім'я" />

                        <TextInput
                            id="first_name"
                            type="text"
                            v-model="form.first_name"
                            required
                            autofocus
                            autocomplete="given-name"
                        />

                        <InputError :message="form.errors.first_name" />
                    </div>

                    <div>
                        <InputLabel for="last_name" value="Прізвище" />

                        <TextInput
                            id="last_name"
                            type="text"
                            v-model="form.last_name"
                            autocomplete="family-name"
                        />

                        <InputError :message="form.errors.last_name" />
                    </div>
                </div>
            </div>

            <div v-if="isUnion" class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                    <InputLabel for="union_family_name" value="Назва родини/спільноти" />

                    <TextInput
                        id="union_family_name"
                        type="text"
                        v-model="form.union_family_name"
                        required
                    />

                    <InputError :message="form.errors.union_family_name" />
                </div>

                <div>
                    <InputLabel for="union_role" value="Ваша позиція" />

                    <select
                        id="union_role"
                        v-model="form.union_role"
                        required
                        class="w-full rounded-lg border border-white/10 bg-obsidian-900/60 px-3 py-2 text-white focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/40"
                    >
                        <option value="" disabled>Оберіть...</option>
                        <option v-for="(label, key) in unionRoles" :key="key" :value="key">{{ label }}</option>
                    </select>

                    <InputError :message="form.errors.union_role" />
                </div>
            </div>

            <div class="mt-4">
                <InputLabel for="email" value="Пошта" />

                <TextInput
                    id="email"
                    type="email"
                    v-model="form.email"
                    required
                    autocomplete="username"
                />

                <InputError :message="form.errors.email" />
            </div>

            <div class="mt-4">
                <InputLabel for="password" value="Пароль" />

                <TextInput
                    id="password"
                    type="password"
                    v-model="form.password"
                    required
                    autocomplete="new-password"
                />

                <InputError :message="form.errors.password" />
            </div>

            <div class="mt-4">
                <InputLabel
                    for="password_confirmation"
                    value="Підтвердження пароля"
                />

                <TextInput
                    id="password_confirmation"
                    type="password"
                    v-model="form.password_confirmation"
                    required
                    autocomplete="new-password"
                />

                <InputError
                    :message="form.errors.password_confirmation"
                />
            </div>

            <div class="mt-6 flex items-center justify-between">
                <Link
                    :href="route('login')"
                    class="text-sm text-white/40 underline hover:text-white"
                >
                    Вже є акаунт?
                </Link>

                <PrimaryButton
                    class="ms-4"
                    :disabled="form.processing || (shadowMatch && !form.claim_shadow_id && !form.skip_shadow_check)"
                >
                    Зареєструватися
                </PrimaryButton>
            </div>
        </form>
    </GuestLayout>
</template>

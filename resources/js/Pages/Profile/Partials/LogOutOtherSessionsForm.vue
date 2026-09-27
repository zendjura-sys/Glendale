<script setup>
import InputError from '@/Components/InputError.vue';
import InputLabel from '@/Components/InputLabel.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import { useForm } from '@inertiajs/vue3';
import { ref } from 'vue';

defineProps({
    otherActiveSessions: { type: Number, default: 0 },
});

const showForm = ref(false);
const form = useForm({ password: '' });

function submit() {
    form.delete(route('profile.other-sessions.destroy'), {
        preserveScroll: true,
        onSuccess: () => { showForm.value = false; },
        onFinish: () => form.reset(),
    });
}
</script>

<template>
    <section v-if="otherActiveSessions > 0">
        <header>
            <h2 class="font-display text-lg font-normal text-white">Інші сесії</h2>
            <p class="mt-1 text-sm text-white/40">
                Зараз ще {{ otherActiveSessions }} {{ otherActiveSessions === 1 ? 'активна сесія' : 'активних сесій' }}
                на інших пристроях. Якщо це не ви — вийдіть з них звідси.
            </p>
        </header>

        <div class="mt-6">
            <button
                v-if="!showForm"
                type="button"
                class="rounded-xl border border-ember-500/25 px-4 py-2 text-xs text-ember-500/80 hover:bg-ember-600/10"
                @click="showForm = true"
            >
                Вийти з інших пристроїв
            </button>

            <form v-else class="max-w-xs space-y-2" @submit.prevent="submit">
                <InputLabel for="other_sessions_password" value="Пароль для підтвердження" />
                <TextInput id="other_sessions_password" v-model="form.password" type="password" autocomplete="current-password" autofocus />
                <InputError :message="form.errors.password" />
                <div class="flex items-center gap-3 pt-1">
                    <PrimaryButton :disabled="form.processing">Вийти звідусіль</PrimaryButton>
                    <button type="button" class="text-xs text-white/40 hover:text-white" @click="showForm = false">Скасувати</button>
                </div>
                <p v-if="form.recentlySuccessful" class="text-xs text-emerald-300">Готово.</p>
            </form>
        </div>
    </section>
</template>

<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';

const props = defineProps({
    family: { type: Object, required: true },
    unionStats: { type: Object, required: true },
    announcements: { type: Array, default: () => [] },
});

const ROLE_LABELS = {
    leader: 'Лідер',
    deputy: 'Заступник лідера',
    member: 'Учасник',
};

// На union.gamecon.online кабінет бачить БУДЬ-ХТО (навіть учасник родини
// Monsory, який сюди зайшов) — розділи "своя родина" й дії (скарги/ЧС),
// доступні лише зареєстрованим союзникам, показуємо тільки якщо родина
// союзу справді вказана.
const isUnionMember = computed(() => Boolean(props.family.name));

const cards = [
    { name: 'union.complaints.index', title: 'Скарги союзу', text: 'Подайте скаргу на союзника або перегляньте статус своїх звернень.' },
    { name: 'union.blacklist.index', title: 'Чорний список союзу', text: 'Гравці, з якими союзники родин не радять мати справу.' },
];

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
}
</script>

<template>
    <Head title="Кабінет союзу" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">Кабінет союзу</h2>
        </template>

        <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div v-reveal class="mb-8">
                <p class="text-white/50">
                    Вітаємо, <span class="text-gold-300">{{ $page.props.auth.user.name }}</span> —
                    {{ isUnionMember ? 'це кабінет союзника Monsory.' : 'ви переглядаєте кабінет союзу union.gamecon.online.' }}
                </p>
            </div>

            <!-- ================= ОБЛІКОВИЙ ЗАПИС ================= -->
            <div v-reveal v-glow class="glass-panel mb-8 grid gap-6 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">Ім'я</p>
                    <p class="mt-1 font-medium text-white">{{ $page.props.auth.user.name }}</p>
                </div>
                <template v-if="isUnionMember">
                    <div>
                        <p class="text-xs uppercase tracking-widest text-white/40">Родина</p>
                        <p class="mt-1 font-medium text-gold-300">{{ family.name }}</p>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-widest text-white/40">Позиція в родині</p>
                        <p class="mt-1 font-medium text-white">{{ ROLE_LABELS[$page.props.auth.user.union_role] ?? $page.props.auth.user.union_role }}</p>
                    </div>
                </template>
                <div v-else-if="$page.props.auth.user.position_title">
                    <p class="text-xs uppercase tracking-widest text-white/40">Посада в Monsory</p>
                    <p class="mt-1 font-medium text-gold-300">{{ $page.props.auth.user.position_title }}</p>
                </div>
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">У {{ isUnionMember ? 'союзі' : 'родині' }} з</p>
                    <p class="mt-1 font-medium text-white">{{ fmtDate($page.props.auth.user.created_at) }}</p>
                </div>
                <div class="sm:col-span-2 lg:col-span-4">
                    <Link :href="route('profile.edit')" class="text-xs uppercase tracking-widest text-gold-300/80 hover:text-gold-200">
                        Редагувати профіль →
                    </Link>
                </div>
            </div>

            <div class="grid gap-8 lg:grid-cols-3">
                <!-- ================= ГОЛОВНЕ ================= -->
                <div class="space-y-8 lg:col-span-2">
                    <div v-if="isUnionMember" class="grid gap-5 sm:grid-cols-2">
                        <template v-for="(card, i) in cards" :key="card.name">
                            <Link
                                v-if="route().has(card.name)"
                                :href="route(card.name)"
                                v-reveal="'scale'"
                                :style="{ transitionDelay: `${i * 80}ms` }"
                                v-glow class="group glass-panel relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
                            >
                                <div class="glass-sheen"></div>
                                <h3 class="relative font-semibold text-white">{{ card.title }}</h3>
                                <p class="relative mt-2 text-sm leading-relaxed text-white/50">{{ card.text }}</p>
                                <span class="relative mt-4 inline-block text-xs uppercase tracking-widest text-gold-300/80">Відкрити →</span>
                            </Link>
                        </template>
                    </div>

                    <!-- ================= ОГОЛОШЕННЯ ================= -->
                    <div v-reveal v-glow class="glass-panel overflow-hidden">
                        <h3 class="p-6 pb-4 font-display text-lg text-white">Новини союзу</h3>
                        <div v-for="a in announcements" :key="a.id" class="border-b border-white/5 px-6 py-4 last:border-0">
                            <p class="text-[11px] uppercase tracking-widest text-gold-300/60">{{ fmtDate(a.published_at) }}</p>
                            <p class="mt-1 font-medium text-white">{{ a.title }}</p>
                            <p class="mt-1 whitespace-pre-line text-sm text-white/50">{{ a.body }}</p>
                        </div>
                        <div v-if="announcements.length === 0" class="px-6 py-12 text-center text-white/30">Оголошень поки немає</div>
                    </div>
                </div>

                <!-- ================= РОДИНА / СОЮЗ ================= -->
                <div class="space-y-8">
                    <div v-if="isUnionMember" v-reveal v-glow class="glass-panel p-6">
                        <h3 class="font-display mb-4 text-lg text-white">Родина «{{ family.name }}»</h3>
                        <ul class="space-y-2">
                            <li v-for="m in family.members" :key="m.id" class="flex items-center justify-between text-sm">
                                <span class="text-white/70">{{ m.name }}</span>
                                <span class="text-xs uppercase tracking-widest text-white/30">{{ ROLE_LABELS[m.union_role] ?? m.union_role }}</span>
                            </li>
                        </ul>
                        <p v-if="family.members.length === 0" class="text-sm text-white/30">Ви поки єдиний представник родини</p>
                    </div>

                    <div v-reveal v-glow class="glass-panel p-6">
                        <h3 class="font-display mb-4 text-lg text-white">Союз загалом</h3>
                        <div class="flex items-baseline gap-3">
                            <span class="font-display text-3xl text-gold-300">{{ unionStats.families }}</span>
                            <span class="text-xs uppercase tracking-widest text-white/40">родин</span>
                        </div>
                        <div class="mt-2 flex items-baseline gap-3">
                            <span class="font-display text-3xl text-gold-300">{{ unionStats.members }}</span>
                            <span class="text-xs uppercase tracking-widest text-white/40">союзників</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>

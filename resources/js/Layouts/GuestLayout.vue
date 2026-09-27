<script setup>
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
import AmbientBackground from '@/Components/AmbientBackground.vue';
import { Link } from '@inertiajs/vue3';
</script>

<template>
    <div class="relative flex min-h-[100svh] flex-col items-center justify-center px-4 py-10 font-sans text-white/80">
        <!-- Вход — первый экран, который видит приглашённый в родину. Пустая
             тёмная страница с формой посередине выглядит как служебный
             интерфейс; кинематографический кадр под плотным затемнением
             держит ту же атмосферу, что и главная. -->
        <div class="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
            <div
                class="absolute inset-0 scale-105 bg-cover bg-center"
                style="background-image: url('/images/hero/cta-sunset.jpg')"
            ></div>
        </div>
        <div class="pointer-events-none fixed inset-0 -z-10 bg-obsidian-950/85"></div>
        <div class="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-t from-obsidian-950 via-transparent to-obsidian-950/70"></div>
        <div class="cine-veil pointer-events-none fixed inset-0 -z-10"></div>
        <div class="bg-noise pointer-events-none fixed inset-0 -z-10 opacity-60"></div>

        <AmbientBackground mobile intensity="normal" />

        <Link href="/" class="group mb-8 flex items-center gap-3">
            <ApplicationLogo mark class="h-11 w-11 text-xl transition-transform duration-700 group-hover:rotate-[55deg]" />
            <div class="leading-tight">
                <div class="font-display text-lg tracking-[0.25em] text-white">GAME</div>
                <div class="text-[10px] tracking-[0.35em] text-gold-300/70">CONNECT</div>
            </div>
        </Link>

        <div v-reveal v-glow class="glass-panel w-full max-w-md px-6 py-8 sm:px-8 sm:py-9">
            <slot />
        </div>

        <Link href="/" class="link-underline mt-8 text-[11px] uppercase tracking-[0.25em] text-white/35 transition-colors hover:text-gold-300">
            На головну
        </Link>
    </div>
</template>

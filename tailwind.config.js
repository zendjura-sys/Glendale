import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.vue',
        // .js обязателен: классы, которые навешиваются из скриптов
        // (.aurora-shader, .cursor-dot, .cursor-ring), Tailwind иначе не
        // находит и вырезает их правила из @layer components. Канвас
        // шейдера тогда остаётся без position: fixed и, будучи блоком в
        // натуральный размер, расталкивает всю страницу вниз.
        './resources/js/**/*.js',
    ],

    theme: {
        extend: {
            // Плоскіший дизайн: стандартна шкала Tailwind (xl:12px, 2xl:16px,
            // 3xl:24px) робила картки й кнопки в адмінці занадто "мильними" —
            // м'якими блобами замість чітких країв. `full` не чіпаємо: це
            // єдине правильне значення для реальних кіл (аватарки, крапки
            // онлайну, круглі іконки-кнопки).
            borderRadius: {
                md: '5px',
                lg: '6px',
                xl: '8px',
                '2xl': '10px',
                '3xl': '12px',
            },
            screens: {
                // Узкие телефоны (iPhone SE, 360px-андроиды) — на них шапка и
                // кнопки уже не помещаются в один ряд, а до sm (640px) ещё
                // далеко: без этой ступени пришлось бы либо ломать вёрстку на
                // 360px, либо резать всё подряд уже с 400px.
                xs: '400px',
            },
            fontFamily: {
                sans: ['Montserrat Variable', 'Montserrat', ...defaultTheme.fontFamily.sans],
                display: ['Montserrat', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                // Через CSS-змінні: у світлій темі «обсидіан» стає кремовими
                // поверхнями соцмережі (див. «ЄДИНЕ ОФОРМЛЕННЯ» в app.css).
                obsidian: {
                    950: 'rgb(var(--obsidian-950) / <alpha-value>)',
                    900: 'rgb(var(--obsidian-900) / <alpha-value>)',
                    800: 'rgb(var(--obsidian-800) / <alpha-value>)',
                    700: 'rgb(var(--obsidian-700) / <alpha-value>)',
                },
                // Через CSS-переменные, а не хексом: акцентный цвет
                // задаётся в админке (Дизайн → Оформлення) и подставляется
                // на лету. Значения по умолчанию лежат в :root в app.css и
                // совпадают с прежними хексами до пикселя, так что, пока
                // цвет не меняли, оформление то же самое.
                gold: {
                    200: 'rgb(var(--gold-200) / <alpha-value>)',
                    300: 'rgb(var(--gold-300) / <alpha-value>)',
                    400: 'rgb(var(--gold-400) / <alpha-value>)',
                    500: 'rgb(var(--gold-500) / <alpha-value>)',
                    600: 'rgb(var(--gold-600) / <alpha-value>)',
                },
                ember: {
                    500: '#c4381f',
                    600: '#9c2a17',
                },
                // Холодный контраст к золоту — без него "aurora" эффект не
                // читается, стекло выглядит просто тёмным, а не преломляющим свет.
                aurora: {
                    400: '#5b6ee8',
                    500: '#3f4fc9',
                    600: '#2c3a9e',
                },
            },
            boxShadow: {
                gold: '0 0 40px -10px rgb(var(--gold-400) / 0.35)',
                aurora: '0 0 50px -12px rgba(63, 79, 201, 0.4)',
            },
        },
    },

    plugins: [forms],
};

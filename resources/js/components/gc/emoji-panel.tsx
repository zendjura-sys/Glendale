import { m, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { tr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Набори емодзі за категоріями (Unicode, без зовнішніх бібліотек). */
const GROUPS: {
    key: string;
    label: () => string;
    icon: string;
    list: string;
}[] = [
    {
        key: 'smileys',
        label: () => tr('Смайли'),
        icon: '😀',
        list: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖',
    },
    {
        key: 'gestures',
        label: () => tr('Жести'),
        icon: '👍',
        list: '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✌️ 🤞 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙 💪 🦾 🖕 ✍️ 🤳 💅 👀 👁️ 🧠 🫶 ❤️‍🔥',
    },
    {
        key: 'hearts',
        label: () => tr('Серця'),
        icon: '❤️',
        list: '❤️ 🧡 💛 💚 💙 🩵 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡',
    },
    {
        key: 'games',
        label: () => tr('Ігри'),
        icon: '🎮',
        list: '🎮 🕹️ 👾 🎯 🎲 ♟️ 🧩 🏆 🥇 🥈 🥉 🏅 🎖️ ⚔️ 🗡️ 🛡️ 🏹 🔫 💣 🧨 🪖 🚀 🛸 🏎️ 🏁 ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏓 🥊 🥋 🎳 ⛳ 🎣 🛹 🎰 🃏 🀄 🎴',
    },
    {
        key: 'animals',
        label: () => tr('Тварини'),
        icon: '🐱',
        list: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🐘 🦒 🐈 🐕',
    },
    {
        key: 'food',
        label: () => tr('Їжа'),
        icon: '🍕',
        list: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥦 🍞 🧀 🥚 🍳 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍣 🍱 🍤 🍩 🍪 🎂 🍰 🍫 🍬 🍭 🍿 ☕ 🍵 🧃 🥤 🍺 🍻 🥂 🍷 🥃 🍸',
    },
    {
        key: 'travel',
        label: () => tr('Подорожі'),
        icon: '🚗',
        list: '🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🏍️ 🛵 🚲 🛴 ✈️ 🚁 🛩️ ⛵ 🚤 🛥️ 🚢 🚂 🚇 🗺️ 🏙️ 🌆 🌇 🌃 🏠 🏢 🏰 🗼 🗽 🌋 🏔️ 🏕️ 🏖️ 🌅 🌄 🌌 🌙 ☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ ☃️ 🌈 🌊',
    },
    {
        key: 'objects',
        label: () => tr('Предмети'),
        icon: '💡',
        list: '⌚ 📱 💻 ⌨️ 🖥️ 🖱️ 🎧 🎤 🎬 📷 📸 📹 🎥 📺 📻 🎙️ 💡 🔦 🕯️ 💰 💵 💸 💳 💎 🔑 🗝️ 🔨 🔧 🔩 ⚙️ 🧲 🧪 💊 🎁 🎈 🎉 🎊 📦 📌 📎 ✏️ 📝 📚 📖 🔔 🔕 🎵 🎶 🎼 🎸 🥁 🎹 🎺 🎷',
    },
    {
        key: 'symbols',
        label: () => tr('Символи'),
        icon: '✅',
        list: '✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ❓ ❔ ❗ ❕ ‼️ ⁉️ ⚠️ 🚫 ⛔ 📛 🔞 ♻️ 🆗 🆕 🆒 🆓 🆙 🔝 🔜 🔛 ▶️ ⏸️ ⏹️ ⏺️ ⏭️ ⏮️ 🔁 🔂 🔀 🔊 🔇 💤 💬 💭 🗯️ ♠️ ♣️ ♥️ ♦️ 🔴 🟠 🟡 🟢 🔵 ⚫ ⚪',
    },
    {
        key: 'flags',
        label: () => tr('Прапори'),
        icon: '🇺🇦',
        list: '🇺🇦 🏁 🚩 🏴 🏳️ 🏳️‍🌈 🇵🇱 🇩🇪 🇫🇷 🇬🇧 🇺🇸 🇨🇦 🇮🇹 🇪🇸 🇵🇹 🇳🇱 🇧🇪 🇨🇿 🇸🇰 🇲🇩 🇷🇴 🇱🇹 🇱🇻 🇪🇪 🇬🇪 🇯🇵 🇰🇷 🇨🇳 🇹🇷 🇮🇱',
    },
];

/**
 * Компактна панель емодзі для композера: вкладки категорій і сітка; вибір вставляє емодзі в курсор.
 * Суцільна поверхня рівня 2 без рамок і тіней; поява — м'яко (без руху — миттєво).
 */
export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
    const [group, setGroup] = useState(GROUPS[0].key);
    const reduce = useReducedMotion();
    const current = GROUPS.find((g) => g.key === group) ?? GROUPS[0];

    return (
        <m.div
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            className="gc-solid-2 mt-2 rounded-2xl p-2"
            role="dialog"
            aria-label={tr('Емодзі')}
        >
            <div className="scrollbar-none flex gap-1 overflow-x-auto pb-1">
                {GROUPS.map((g) => (
                    <button
                        key={g.key}
                        type="button"
                        title={g.label()}
                        aria-label={g.label()}
                        aria-pressed={g.key === group}
                        onClick={() => setGroup(g.key)}
                        className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-xl text-lg transition',
                            g.key === group
                                ? 'bg-[var(--gc-active)]'
                                : 'hover:bg-[var(--gc-l3)]',
                        )}
                    >
                        {g.icon}
                    </button>
                ))}
            </div>
            <p className="px-1 pt-1 pb-1.5 text-[11px] font-semibold text-white/60">
                {current.label()}
            </p>
            <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto sm:grid-cols-10">
                {current.list.split(' ').map((emoji, i) => (
                    <button
                        key={`${emoji}-${i}`}
                        type="button"
                        onClick={() => onPick(emoji)}
                        className="flex aspect-square items-center justify-center rounded-lg text-xl transition hover:bg-[var(--gc-l3)]"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </m.div>
    );
}

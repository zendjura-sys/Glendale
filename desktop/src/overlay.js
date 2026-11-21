'use strict';

// Оверлей тривоги: картка в куті екрана. Кнопки клікабельні лише під курсором — решта
// вікна пропускає кліки в гру (див. main.js: setIgnoreMouseEvents з forward).
(function () {
    const card = document.getElementById('card');
    const title = document.getElementById('title');
    const meta = document.getElementById('meta');
    const shelterButton = document.getElementById('shelter');
    let shelter = false;

    function beep() {
        try {
            const ctx = new AudioContext();
            [0, 0.45, 0.9].forEach((at) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
                gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.32);
                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + at);
                osc.stop(ctx.currentTime + at + 0.35);
            });
        } catch {
            // Без звуку — картка й системне сповіщення все одно є.
        }
    }

    window.gamecon.onAlert((alert) => {
        if (!alert) {
            card.classList.remove('on');
            return;
        }
        document.documentElement.style.setProperty('--accent', alert.color);
        title.textContent = alert.title;
        meta.textContent = [alert.place, alert.duration].filter(Boolean).join(' · ');
        shelter = alert.shelter === true;
        shelterButton.textContent = shelter ? 'Я вже не в укритті' : 'Я в укритті';
        card.classList.add('on');
        if (alert.sound) beep();
    });

    for (const button of document.querySelectorAll('button')) {
        button.addEventListener('mouseenter', () => window.gamecon.interactive(true));
        button.addEventListener('mouseleave', () => window.gamecon.interactive(false));
    }
    shelterButton.addEventListener('click', async () => {
        shelterButton.disabled = true;
        await window.gamecon.shelter(!shelter);
        shelterButton.disabled = false;
    });
    document.getElementById('map').addEventListener('click', () => window.gamecon.openAlerts());
})();

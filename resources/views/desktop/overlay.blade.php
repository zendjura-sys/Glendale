{{-- Оверлей тривог для застосунку GameCon для Windows (№261). Тримається застосунком у прозорому
     вікні «завжди згори»; сама опитує /alerts/state (cookie входу) і повідомляє застосунку стан. --}}
<!doctype html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="utf-8">
<meta name="csrf-token" content="{{ csrf_token() }}">
<title>GameCon — тривога</title>
<style>
  html, body { margin: 0; background: transparent; font: 14px/1.35 'Segoe UI', system-ui, sans-serif; color: #f4f5f8; overflow: hidden; user-select: none; }
  .card { margin: 6px; padding: 12px 14px; border-radius: 16px; background: rgba(19, 19, 19, 0.9); border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: none; grid-template-columns: 6px 1fr; gap: 12px; }
  .card.on { display: grid; }
  .bar { border-radius: 4px; background: var(--accent, #ef4444); animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .45; } }
  @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
  .title { font-weight: 700; font-size: 15px; }
  .meta { color: rgba(244,245,248,0.65); font-size: 12.5px; margin-top: 2px; }
  .row { display: flex; gap: 8px; margin-top: 8px; }
  button { font: inherit; font-size: 12.5px; font-weight: 600; color: #f4f5f8; background: rgba(255,255,255,0.1); border: 0; border-radius: 999px; padding: 6px 12px; cursor: pointer; }
  button:hover { background: rgba(255,255,255,0.18); }
  button.primary { background: #6b8afd; color: #0b0d14; }
</style>
</head>
<body>
<div class="card" id="card" role="alert" aria-live="assertive">
  <div class="bar"></div>
  <div>
    <div class="title" id="title"></div>
    <div class="meta" id="meta"></div>
    <div class="row">
      <button class="primary" id="shelter" type="button">{{ __('Я в укритті') }}</button>
      <button id="map" type="button">{{ __('Мапа') }}</button>
    </div>
  </div>
</div>
<script>
(() => {
  const available = @json($available);
  const invoke = (cmd, args) => window.__TAURI__?.core?.invoke(cmd, args) ?? Promise.resolve(false);
  const card = document.getElementById('card');
  const title = document.getElementById('title');
  const meta = document.getElementById('meta');
  const shelterButton = document.getElementById('shelter');
  const csrf = document.querySelector('meta[name=csrf-token]').content;
  let shelter = false;

  function beep() {
    try {
      const ctx = new AudioContext();
      [0, 0.45, 0.9].forEach((at) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.32);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at); osc.stop(ctx.currentTime + at + 0.35);
      });
    } catch (e) {}
  }

  // Ті самі рядки, що у віджеті «Тривога» застосунку для телефона.
  function view(prefs) {
    const status = Array.isArray(prefs?.status) ? prefs.status : [];
    if (!status.length) return null;
    const main = status[0];
    const since = main.since ? new Date(main.since) : null;
    const minutes = since && !isNaN(since) ? Math.max(0, Math.round((Date.now() - since) / 60000)) : null;
    const level = main.level === 'red' ? @json(__('червоний рівень')) : main.level === 'yellow' ? @json(__('жовтий рівень')) : null;
    return {
      key: status.map((s) => `${s.name}|${s.since || ''}`).join(';'),
      title: [main.name, level].filter(Boolean).join(' · ') + (status.length > 1 ? ` +${status.length - 1}` : ''),
      place: prefs?.unit?.name || (prefs?.region ? @json(__('Уся область')) : ''),
      duration: minutes === null ? '' : minutes >= 60 ? `${Math.floor(minutes / 60)} год ${String(minutes % 60).padStart(2, '0')} хв` : `${minutes} хв`,
      color: /^#[0-9a-f]{6}$/i.test(main.accent || '') ? main.accent : '#EF4444',
      shelter: prefs?.shelter === true,
    };
  }

  async function poll() {
    let next = null;
    if (available) {
      try {
        const res = await fetch('/alerts/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok) return;
        next = view((await res.json()).prefs);
      } catch (e) { return; }
    }
    if (next) {
      document.documentElement.style.setProperty('--accent', next.color);
      title.textContent = next.title;
      meta.textContent = [next.place, next.duration].filter(Boolean).join(' · ');
      shelter = next.shelter;
      shelterButton.textContent = shelter ? @json(__('Я вже не в укритті')) : @json(__('Я в укритті'));
      card.classList.add('on');
    } else {
      card.classList.remove('on');
    }
    const sound = await invoke('alert_changed', { alert: next ? { key: next.key, title: next.title, place: next.place, duration: next.duration } : { key: null, title: '', place: '', duration: '' } });
    if (sound === true) beep();
  }

  shelterButton.addEventListener('click', async () => {
    shelterButton.disabled = true;
    try {
      await fetch('/alerts/preferences', { method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf }, body: JSON.stringify({ shelter: !shelter }) });
    } finally {
      shelterButton.disabled = false;
      poll();
    }
  });
  document.getElementById('map').addEventListener('click', () => invoke('open_main'));

  poll();
  setInterval(poll, 20000);
  // Ще не увійшли — перечитати сторінку, коли людина увійде в головному вікні.
  if (@json($guest)) setTimeout(() => location.reload(), 60000);
})();
</script>
</body>
</html>

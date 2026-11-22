{{-- Міні-вікно (віджет) застосунку GameCon для Windows (№261): маленьке вікно «завжди згори», що саме є
     оверлеєм у грі. Опитує /me/rail (cookie входу) і повідомляє застосунку, чи є що показати
     (`widget_state`): порожній віджет застосунок ховає. Натиск — відкрити розділ у головному вікні. --}}
<!doctype html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="utf-8">
<title>GameCon — {{ $kind === 'chats' ? __('Чати') : __('Друзі') }}</title>
<style>
  html, body { margin: 0; background: transparent; font: 13px/1.35 'Segoe UI', system-ui, sans-serif; color: #f4f5f8; overflow: hidden; user-select: none; }
  .card { margin: 6px; padding: 10px 10px 8px; border-radius: 16px; background: rgba(19, 19, 19, 0.9); border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 10px 30px rgba(0,0,0,0.45); }
  .head { display: flex; align-items: center; gap: 6px; padding: 0 4px 6px; font-weight: 700; font-size: 12.5px; color: rgba(244,245,248,0.7); -webkit-app-region: drag; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #3ee0a8; }
  .head .count { margin-left: auto; color: #6b8afd; }
  .row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 4px; border: 0; border-radius: 10px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .row:hover { background: rgba(255,255,255,0.07); }
  .row img, .row .ph { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex: none; background: #2e333d; }
  .name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { color: rgba(244,245,248,0.6); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txt { min-width: 0; flex: 1; }
  .badge { flex: none; min-width: 18px; padding: 0 6px; border-radius: 999px; background: #6b8afd; color: #0b0d14; font-size: 11px; font-weight: 700; text-align: center; line-height: 18px; }
  .empty { padding: 4px; color: rgba(244,245,248,0.55); }
</style>
</head>
<body>
<div class="card">
  <div class="head"><span class="dot"></span><span id="title">{{ $kind === 'chats' ? __('Непрочитані чати') : __('Друзі онлайн') }}</span><span class="count" id="count"></span></div>
  <div id="list"></div>
</div>
<script>
(() => {
  const kind = @json($kind);
  const available = @json($available);
  const guest = @json($guest);
  const invoke = (cmd, args) => window.__TAURI__?.core?.invoke(cmd, args) ?? Promise.resolve(null);
  const list = document.getElementById('list');
  const count = document.getElementById('count');
  const text = {
    login: @json(__('Увійдіть у GameCon у головному вікні.')),
    playing: @json(__('грає')),
    online: @json(__('онлайн')),
  };

  function row(item) {
    const button = document.createElement('button');
    button.className = 'row';
    button.type = 'button';
    const avatar = item.avatar ? Object.assign(document.createElement('img'), { src: item.avatar, alt: '' }) : Object.assign(document.createElement('span'), { className: 'ph' });
    const box = Object.assign(document.createElement('span'), { className: 'txt' });
    box.append(Object.assign(document.createElement('div'), { className: 'name', textContent: item.name }));
    if (item.sub) box.append(Object.assign(document.createElement('div'), { className: 'sub', textContent: item.sub }));
    button.append(avatar, box);
    if (item.badge) button.append(Object.assign(document.createElement('span'), { className: 'badge', textContent: String(item.badge) }));
    button.addEventListener('click', () => invoke('open_main', { route: item.route }));
    return button;
  }

  function items(rail) {
    if (kind === 'chats') {
      return (rail.chats || []).filter((c) => c.unread > 0).slice(0, 5).map((c) => ({
        name: c.title || c.peer?.name || 'GameCon', avatar: c.avatar_url || c.peer?.avatar_url, badge: c.unread, route: `/messages/${c.id}`,
      }));
    }
    const playing = (rail.in_game || []).map((u) => ({ name: u.name, avatar: u.avatar_url, sub: `${text.playing}: ${u.playing?.name || u.playing?.label || ''}`, route: `/u/${u.username}`, id: u.id }));
    const ids = new Set(playing.map((p) => p.id));
    const online = (rail.online || []).filter((u) => !ids.has(u.id)).map((u) => ({ name: u.name, avatar: u.avatar_url, sub: text.online, route: `/u/${u.username}` }));
    return [...playing, ...online].slice(0, 6);
  }

  async function poll() {
    let shown = [];
    if (available) {
      try {
        const res = await fetch('/me/rail', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (!res.ok) return;
        shown = items(await res.json());
      } catch (e) { return; }
    }
    list.replaceChildren(...shown.map(row));
    if (guest) list.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: text.login }));
    count.textContent = shown.length ? String(shown.length) : '';
    // Застосунок ховає порожній віджет і підганяє висоту вікна під вміст.
    await invoke('widget_state', { kind, items: guest ? 1 : shown.length, height: Math.ceil(document.querySelector('.card').getBoundingClientRect().height + 12) });
  }

  poll();
  setInterval(poll, 30000);
  if (guest) setTimeout(() => location.reload(), 60000);
})();
</script>
</body>
</html>

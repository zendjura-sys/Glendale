/*!
 * GameCon Embed Kit — вставте один раз:
 *   <script src="__BASE__/embed.js" async></script>
 * і додайте атрибути до елементів:
 *   data-gamecon-card="нік"            картка профілю GameCon
 *   data-gamecon-badge="нік"           значок «GameCon» біля імені
 *   data-gamecon-share                 кнопка «Поділитися в GameCon» (поточна сторінка;
 *                                      data-url / data-title — інша адреса чи назва)
 *   data-gamecon-widget="server:slug"  віджет сервера з онлайном
 *   data-gamecon-bell="токен"          дзвіночок непрочитаних (токен видає плагін після входу)
 */
(function () {
  'use strict';
  var BASE = '__BASE__';
  var INDIGO = '#4f46e5';
  var ICON = {
    gamepad: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>',
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  function enc(v) { return encodeURIComponent(v); }
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function done(el) { if (el.getAttribute('data-gamecon-ready')) return true; el.setAttribute('data-gamecon-ready', '1'); return false; }
  function frame(el, src, height, title) {
    var f = document.createElement('iframe');
    f.src = src; f.title = title; f.loading = 'lazy';
    f.style.cssText = 'width:100%;max-width:420px;height:' + height + 'px;border:0;border-radius:16px;display:block';
    el.appendChild(f);
  }

  function card(el) {
    if (done(el)) return;
    frame(el, BASE + '/widget/u/' + enc(el.getAttribute('data-gamecon-card')), 160, 'GameCon');
  }

  function badge(el) {
    if (done(el)) return;
    var nick = el.getAttribute('data-gamecon-badge');
    el.innerHTML = '<a href="' + BASE + '/u/' + enc(nick) + '" target="_blank" rel="noopener" title="GameCon: @' + esc(nick) + '" '
      + 'style="display:inline-flex;align-items:center;gap:3px;margin-left:4px;padding:1px 6px;border-radius:999px;background:' + INDIGO + ';color:#fff;font:600 11px/16px system-ui,sans-serif;text-decoration:none;vertical-align:middle">'
      + ICON.check + 'GameCon</a>';
  }

  function share(el) {
    if (done(el)) return;
    var url = el.getAttribute('data-url') || location.href;
    var title = el.getAttribute('data-title') || document.title;
    var a = document.createElement('a');
    a.href = BASE + '/share?url=' + enc(url) + '&title=' + enc(title);
    a.target = '_blank'; a.rel = 'noopener';
    a.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;background:' + INDIGO + ';color:#fff;font:600 13px/18px system-ui,sans-serif;text-decoration:none';
    a.innerHTML = ICON.share + '<span>' + (el.getAttribute('data-label') || 'Поділитися в GameCon') + '</span>';
    el.appendChild(a);
  }

  function widget(el) {
    if (done(el)) return;
    var spec = (el.getAttribute('data-gamecon-widget') || '').split(':');
    if (spec[0] === 'server' && spec[1]) frame(el, BASE + '/widget/s/' + enc(spec[1]), 220, 'GameCon');
  }

  function bell(el) {
    if (done(el)) return;
    var token = el.getAttribute('data-gamecon-bell');
    if (!token) return;
    var a = document.createElement('a');
    a.href = BASE + '/notifications'; a.target = '_blank'; a.rel = 'noopener'; a.title = 'Сповіщення GameCon';
    a.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;color:inherit;text-decoration:none';
    a.innerHTML = ICON.bell + '<span style="display:none;position:absolute;top:2px;right:0;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:' + INDIGO + ';color:#fff;font:700 10px/16px system-ui,sans-serif;text-align:center"></span>';
    el.appendChild(a);
    var dot = a.lastChild;
    var load = function () {
      fetch(BASE + '/api/developer/v1/bell?t=' + enc(token)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || typeof d.count !== 'number') return;
        dot.textContent = d.count > 99 ? '99+' : String(d.count);
        dot.style.display = d.count > 0 ? 'block' : 'none';
      }).catch(function () {});
    };
    load();
    setInterval(load, 60000);
  }

  function scan(root) {
    var map = [['data-gamecon-card', card], ['data-gamecon-badge', badge], ['data-gamecon-share', share], ['data-gamecon-widget', widget], ['data-gamecon-bell', bell]];
    map.forEach(function (pair) {
      var nodes = (root || document).querySelectorAll('[' + pair[0] + ']');
      for (var i = 0; i < nodes.length; i++) pair[1](nodes[i]);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); });
  else scan();
  // Форуми з динамічним завантаженням (Flarum, Discourse, NodeBB) — дорисовуємо нові елементи.
  var queued = false;
  if (window.MutationObserver) new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.GameCon = { scan: scan };
})();

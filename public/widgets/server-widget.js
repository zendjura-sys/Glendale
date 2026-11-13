/*
 * Віджет сервера GameCon для сайту сервера: онлайн наживо, топ сімей, голосування, Discord.
 * Вставка: <script src="https://gamecon.online/widget/s/{slug}/widget.js" data-theme="dark" data-show="online,families,vote,discord" async></script>
 * Малюється в Shadow DOM — стилі сайту не ламають віджет, а віджет — сайт. Оновлюється кожні 2 хвилини.
 */
(function () {
    var current = document.currentScript;
    if (!current || !current.parentNode) return;
    var endpoint = current.getAttribute('data-endpoint');
    if (!endpoint) return;
    var theme =
        current.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var accent = /^#[0-9a-f]{6}$/i.test(
        current.getAttribute('data-accent') || '',
    )
        ? current.getAttribute('data-accent')
        : '#6366f1';
    var show = (
        current.getAttribute('data-show') || 'online,families,vote,discord'
    ).split(',');
    var host = document.createElement('div');
    current.parentNode.insertBefore(host, current);
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var dark = theme === 'dark';
    var css =
        ':host{all:initial}' +
        '.w{box-sizing:border-box;max-width:380px;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;border-radius:20px;padding:16px;' +
        (dark
            ? 'background:#0b1220;color:#f4f6ff;border:1px solid rgba(255,255,255,.08)'
            : 'background:#fff;color:#0b1220;border:1px solid rgba(11,18,32,.1)') +
        ';box-shadow:0 10px 30px rgba(0,0,0,' +
        (dark ? '.4' : '.08') +
        ')}' +
        '.h{display:flex;gap:12px;align-items:center}.i{width:52px;height:52px;border-radius:14px;object-fit:cover;flex-shrink:0;background:' +
        accent +
        '}' +
        '.n{font-weight:800;font-size:16px;display:flex;align-items:center;gap:6px}.v{color:#38bdf8;font-size:14px}' +
        '.s{opacity:.6;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.sec{margin-top:12px}.row{display:flex;justify-content:space-between;font-size:13px}.m{opacity:.6}' +
        '.bar{height:6px;border-radius:9px;margin-top:6px;background:' +
        (dark ? 'rgba(255,255,255,.1)' : 'rgba(11,18,32,.08)') +
        ';overflow:hidden}' +
        '.bar b{display:block;height:100%;border-radius:9px;background:' +
        accent +
        ';transition:width .6s}' +
        '.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:6px}' +
        '.fam{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}.fam span:first-child{font-weight:600}' +
        '.btns{display:flex;gap:8px;margin-top:12px}.btn{flex:1;text-align:center;padding:9px 10px;border-radius:12px;font-weight:700;font-size:13px;text-decoration:none}' +
        '.p{background:' +
        accent +
        ';color:#fff}.g{background:' +
        (dark ? 'rgba(255,255,255,.08)' : 'rgba(11,18,32,.06)') +
        ';color:inherit}' +
        '.f{margin-top:10px;font-size:11px;opacity:.5;text-align:right}.f a{color:inherit}';

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined && text !== null) e.textContent = text;
        return e;
    }

    function render(d) {
        root.innerHTML = '';
        var style = document.createElement('style');
        style.textContent = css;
        root.appendChild(style);
        var w = el('div', 'w');
        var h = el('div', 'h');
        if (d.icon) {
            var img = el('img', 'i');
            img.src = d.icon;
            img.alt = '';
            h.appendChild(img);
        } else {
            h.appendChild(el('div', 'i'));
        }
        var t = el('div');
        t.style.minWidth = '0';
        var n = el('div', 'n', d.name);
        if (d.verified) n.appendChild(el('span', 'v', '✔'));
        t.appendChild(n);
        if (d.tagline) t.appendChild(el('div', 's', d.tagline));
        h.appendChild(t);
        w.appendChild(h);

        if (show.indexOf('online') >= 0 && d.online !== null) {
            var s = el('div', 'sec');
            var r = el('div', 'row');
            var left = el('span');
            left.appendChild(el('span', 'dot'));
            left.appendChild(
                document.createTextNode(
                    d.labels.online +
                        ': ' +
                        d.online +
                        (d.max ? ' / ' + d.max : ''),
                ),
            );
            r.appendChild(left);
            if (d.peak)
                r.appendChild(el('span', 'm', d.labels.peak + ' ' + d.peak));
            s.appendChild(r);
            if (d.max) {
                var bar = el('div', 'bar');
                var fill = el('b');
                fill.style.width =
                    Math.min(100, Math.round((d.online / d.max) * 100)) + '%';
                bar.appendChild(fill);
                s.appendChild(bar);
            }
            w.appendChild(s);
        }
        if (show.indexOf('families') >= 0 && d.families && d.families.length) {
            var fs = el('div', 'sec');
            fs.appendChild(el('div', 'm', d.labels.families));
            d.families.forEach(function (f, i) {
                var row = el('div', 'fam');
                row.appendChild(el('span', '', i + 1 + '. ' + f.name));
                row.appendChild(
                    el('span', 'm', f.points + ' ' + d.labels.points),
                );
                fs.appendChild(row);
            });
            w.appendChild(fs);
        }
        var btns = el('div', 'btns');
        if (show.indexOf('vote') >= 0) {
            var vote = el(
                'a',
                'btn p',
                d.labels.vote + (d.votes ? ' · ' + d.votes : ''),
            );
            vote.href = d.vote_url;
            vote.target = '_blank';
            vote.rel = 'noopener';
            btns.appendChild(vote);
        }
        if (show.indexOf('discord') >= 0 && d.discord) {
            var ds = el('a', 'btn g', 'Discord');
            ds.href = d.discord;
            ds.target = '_blank';
            ds.rel = 'noopener';
            btns.appendChild(ds);
        }
        if (btns.childNodes.length) w.appendChild(btns);
        var foot = el('div', 'f');
        var link = el('a', '', d.labels.on_gamecon);
        link.href = d.href;
        link.target = '_blank';
        link.rel = 'noopener';
        foot.appendChild(link);
        w.appendChild(foot);
        root.appendChild(w);
    }

    function load() {
        fetch(endpoint, { credentials: 'omit' })
            .then(function (r) {
                return r.json();
            })
            .then(render)
            .catch(function () {});
    }
    load();
    setInterval(load, 120000);
})();

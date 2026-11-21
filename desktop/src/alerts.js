'use strict';

/**
 * Чиста логіка оверлею тривог (без Electron — перевіряється тестами).
 * Дані — `prefs` з GET /alerts/state сайту GameCon: обране місце й тривоги в ньому.
 */

/** Що показати в оверлеї: null — тривоги немає (оверлей ховається). */
function alertView(prefs, now = new Date()) {
    const status = Array.isArray(prefs?.status) ? prefs.status : [];
    if (status.length === 0) return null;
    const main = status[0];
    const place = prefs?.unit?.name || (prefs?.region ? 'Уся область' : 'Ваше місце');
    const since = main.since ? new Date(main.since) : null;
    const minutes = since && !Number.isNaN(since.getTime()) ? Math.max(0, Math.round((now - since) / 60000)) : null;
    const level = main.level === 'red' ? 'червоний рівень' : main.level === 'yellow' ? 'жовтий рівень' : null;

    return {
        key: status.map((s) => `${s.name}|${s.since || ''}`).join(';'),
        title: [main.name || 'Повітряна тривога', level].filter(Boolean).join(' · ') + (status.length > 1 ? ` +${status.length - 1}` : ''),
        place,
        duration: minutes === null ? '' : minutes >= 60 ? `Триває ${Math.floor(minutes / 60)} год ${String(minutes % 60).padStart(2, '0')} хв` : `Триває ${minutes} хв`,
        color: /^#[0-9a-f]{6}$/i.test(main.accent || '') ? main.accent : '#EF4444',
        shelter: prefs?.shelter === true,
    };
}

/**
 * Що змінилося між двома опитуваннями: 'start' — почалась нова тривога (сповіщення й звук),
 * 'end' — відбій, null — без змін.
 */
function transition(prev, next) {
    if (!prev && next) return 'start';
    if (prev && !next) return 'end';
    if (prev && next && prev.key !== next.key) return 'start';
    return null;
}

/** Laravel кладе CSRF-токен у cookie XSRF-TOKEN (url-кодований); заголовок X-XSRF-TOKEN — те саме значення. */
function xsrfHeader(cookieValue) {
    return cookieValue ? decodeURIComponent(cookieValue) : null;
}

module.exports = { alertView, transition, xsrfHeader };

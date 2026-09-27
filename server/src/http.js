// Small helpers shared by the API routers.
import { translate } from './i18n.js';

export class HttpError extends Error {
  constructor(status, message, code, params) {
    super(message);
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

/** Throws an HTTP error; `message` is a translation key (Russian source), `params` fill its {placeholders}. */
export const fail = (status, message, code, params) => {
  throw new HttpError(status, message, code, params);
};

export const intParam = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const PAGE = 20;

export const beforeParam = (req) => intParam(req.query.before) ?? Number.MAX_SAFE_INTEGER;

export function page(items) {
  return { items, nextCursor: items.length === PAGE ? items[items.length - 1].id : null };
}

/** JSON error handler for a router. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: translate('Файл слишком большой', null, req.lang) });
  const status = err.status || 500;
  const expected = err instanceof HttpError || (err.status && err.status < 500);
  if (!expected) console.error(err);
  res.status(status).json({ error: translate(expected ? err.message : 'Внутренняя ошибка сервера', err.params, req.lang), code: err.code });
}

/** Throws 403 unless the member level allows `flag` (can_post, can_comment, ...). */
export function need(req, flag, message) {
  if (!req.level[flag]) fail(403, message || 'Ваш уровень доступа не позволяет это действие', 'forbidden');
}

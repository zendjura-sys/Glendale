// Small helpers shared by the API routers.

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
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
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл слишком большой (макс. 15 МБ)' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Внутренняя ошибка сервера' : err.message, code: err.code });
}

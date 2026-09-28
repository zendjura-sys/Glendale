import { lazy, type ComponentType } from 'react';

/**
 * React.lazy, але стійкий до деплою: якщо код-спліт чанк не завантажився
 * (типовий випадок — вкладка відкрита зі старим index.html, а Vite вже
 * перезаписав файли новими хешами після нового білда), пробуємо один раз
 * перезавантажити сторінку — вона підтягне свіжий HTML із чинними хешами.
 * Прапорець у sessionStorage не дає піти в нескінченний цикл: якщо
 * завантаження не вдалось і на свіжій сторінці, це вже не «старий кеш»,
 * а справжня помилка мережі — кидаємо її далі, в ErrorBoundary.
 */
export function lazyRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>, key: string) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const flag = `chunk-retry:${key}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // перезавантаження вже в дорозі — просто чекаємо.
      }
      sessionStorage.removeItem(flag);
      throw error;
    }
  });
}

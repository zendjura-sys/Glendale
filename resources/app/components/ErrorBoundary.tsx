import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { tr } from '../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Без цього будь-яка помилка рендеру (найчастіше — невдале довантаження
 * code-split чанка сторінки після деплою, коли в людини у вкладці лишився
 * старий index.html з посиланням на вже видалений хеш файлу) прибирала
 * геть увесь застосунок: React розмонтовує все дерево аж до кореня, коли
 * ловити помилку нема кому, і людина бачить порожній чорний екран замість
 * шапки й меню.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="offline-screen">
          <RefreshCw size={44} />
          <h2>{tr('Щось пішло не так')}</h2>
          <p className="muted">{tr('Спробуйте оновити сторінку — зазвичай після оновлення сайту це допомагає.')}</p>
          <button className="btn" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> {tr('Оновити сторінку')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

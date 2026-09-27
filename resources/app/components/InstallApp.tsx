import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Share, SquarePlus } from 'lucide-react';
import { tr } from '../lib/i18n';
import { canPrompt, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/install';

export function useInstallState() {
  const [, rerender] = useState(0);
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), []);
  return { installed: isStandalone(), available: canPrompt(), ios: isIos() };
}

/** "App" card for Settings: install button, iOS steps, or "already installed". */
export function InstallAppCard() {
  const { installed, available, ios } = useInstallState();
  return (
    <div className="install-card">
      <img src="/icons/icon-192.png" alt="" width={56} height={56} />
      <div className="install-card-body">
        {installed ? (
          <>
            <b>
              <CheckCircle2 size={16} /> {tr('Приложение установлено')}
            </b>
            <div className="meta">{tr('Вы открыли сайт как приложение.')}</div>
          </>
        ) : available ? (
          <>
            <b>{tr('Установите приложение')}</b>
            <div className="meta">{tr('Иконка на главном экране, полноэкранный режим и быстрый запуск.')}</div>
            <button className="btn" onClick={() => promptInstall()}>
              <Download size={16} /> {tr('Установить')}
            </button>
          </>
        ) : ios ? (
          <>
            <b>{tr('Установите приложение')}</b>
            <ol className="install-steps">
              <li>
                {tr('Нажмите')} <Share size={15} /> {tr('«Поделиться» в Safari')}
              </li>
              <li>
                {tr('Выберите')} <SquarePlus size={15} /> {tr('«На экран «Домой»»')}
              </li>
            </ol>
          </>
        ) : (
          <>
            <b>{tr('Установите приложение')}</b>
            <div className="meta">{tr('Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».')}</div>
          </>
        )}
      </div>
    </div>
  );
}

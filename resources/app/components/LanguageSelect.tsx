import { Languages } from 'lucide-react';
import { LANGUAGES, getLang, setLang, tr, type Lang } from '../lib/i18n';

/** Language picker (native names), used on the sign-in page, in the profile menu and in settings. */
export function LanguageSelect({ compact }: { compact?: boolean }) {
  return (
    <label className={`lang-select${compact ? ' compact' : ''}`} title={tr('Язык')}>
      <Languages size={16} />
      <select value={getLang()} onChange={(e) => setLang(e.target.value as Lang)} aria-label={tr('Язык')}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

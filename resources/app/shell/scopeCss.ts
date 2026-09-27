/**
 * Стилі соцмережі (styles.css тощо) написані для сторінки, якою цілком
 * володіє React: скидання для a/button/body, класи .card, .btn… На
 * сторінках Vue ті самі правила зламали б вміст, тому для оболонки вони
 * «замикаються» у її корені: кожен селектор отримує префікс `.gc-shell`,
 * а :root (токени кольорів) лишається глобальним — спільна палітра.
 *
 * Розбирає CSS сам браузер (CSSOM), тож тут лише переписування
 * selectorText — без ризику зламати синтаксис власним парсером.
 */
const SCOPE = '.gc-shell';

function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function scopeSelector(sel: string): string {
  // Токени й тема — глобально, для Vue-сторінок теж.
  if (/^:root\b/.test(sel)) return sel;
  // html/body → сам корінь оболонки (шрифт, колір тексту).
  const m = /^(html|body)(?=$|[\s.:[>+~])/.exec(sel);
  if (m) {
    const rest = sel.slice(m[0].length);
    // «html[data-theme=dark] .x» → «:root[data-theme=dark] .gc-shell .x».
    if (m[1] === 'html' && /^[[:.]/.test(rest)) {
      const attr = /^((?:\[[^\]]*\]|:[\w-]+(?:\([^)]*\))?|\.[\w-]+)+)/.exec(rest)?.[0] ?? '';
      const tail = rest.slice(attr.length).trim();
      return `:root${attr} ${SCOPE}${tail ? ' ' + tail : ''}`;
    }
    return `${SCOPE}${rest}`;
  }
  return `${SCOPE} ${sel}`;
}

function rewrite(rules: CSSRuleList) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      rule.selectorText = splitSelectors(rule.selectorText).map(scopeSelector).join(', ');
      if (rule.cssRules?.length) rewriteNested(rule.cssRules);
    } else if ('cssRules' in rule && !(rule instanceof CSSKeyframesRule)) {
      rewrite((rule as CSSGroupingRule).cssRules);
    }
  }
}

/** Вкладені правила (CSS nesting) уже відносні до батька — не чіпаємо. */
function rewriteNested(_rules: CSSRuleList) {}

export function adoptScoped(cssText: string) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  rewrite(sheet.cssRules);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

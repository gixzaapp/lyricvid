import af from '@/i18n/locales/af.json';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import fil from '@/i18n/locales/fil.json';
import fr from '@/i18n/locales/fr.json';
import hi from '@/i18n/locales/hi.json';
import id from '@/i18n/locales/id.json';
import it from '@/i18n/locales/it.json';
import ja from '@/i18n/locales/ja.json';
import kn from '@/i18n/locales/kn.json';
import ko from '@/i18n/locales/ko.json';
import ml from '@/i18n/locales/ml.json';
import nl from '@/i18n/locales/nl.json';
import pt from '@/i18n/locales/pt.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import si from '@/i18n/locales/si.json';
import ta from '@/i18n/locales/ta.json';
import te from '@/i18n/locales/te.json';
import th from '@/i18n/locales/th.json';
import ur from '@/i18n/locales/ur.json';
import xh from '@/i18n/locales/xh.json';
import zu from '@/i18n/locales/zu.json';
import { isLocaleCode, type LocaleCode } from '@/i18n/languages';

export type { LocaleCode } from '@/i18n/languages';
export { LANGUAGES, LOCALE_CODES } from '@/i18n/languages';

export type TranslationKey = keyof typeof en;
type Dictionary = Record<TranslationKey, string>;

const DICTS: Record<LocaleCode, Dictionary> = {
  en,
  ml: ml as Dictionary,
  hi: hi as Dictionary,
  ur: ur as Dictionary,
  ta: ta as Dictionary,
  si: si as Dictionary,
  te: te as Dictionary,
  kn: kn as Dictionary,
  id: id as Dictionary,
  it: it as Dictionary,
  fr: fr as Dictionary,
  de: de as Dictionary,
  pt: pt as Dictionary,
  'pt-BR': ptBR as Dictionary,
  nl: nl as Dictionary,
  ko: ko as Dictionary,
  th: th as Dictionary,
  ja: ja as Dictionary,
  fil: fil as Dictionary,
  zu: zu as Dictionary,
  xh: xh as Dictionary,
  af: af as Dictionary,
};

export type TranslateVars = Record<string, string | number>;

export type KeyedError = Error & { vars?: TranslateVars };

export function keyedError(key: TranslationKey, vars?: TranslateVars): KeyedError {
  const error = new Error(key) as KeyedError;
  if (vars) error.vars = vars;
  return error;
}

export function translate(code: LocaleCode | null, key: TranslationKey, vars?: TranslateVars) {
  const locale = isLocaleCode(code) ? code : 'en';
  let text = DICTS[locale][key] ?? DICTS.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }
  return text;
}

export function isTranslationKey(value: string): value is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, value);
}

export const LOCALE_CODES = [
  'zu',
  'xh',
  'af',
  'nl',
  'en',
  'fr',
  'de',
  'it',
  'pt',
  'pt-BR',
  'hi',
  'kn',
  'ml',
  'ta',
  'si',
  'te',
  'ur',
  'fil',
  'id',
  'th',
  'ja',
  'ko',
] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

export type ContinentId = 'africa' | 'europe' | 'americas' | 'asia';

export type LanguageOption = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  mark: string;
  continent: ContinentId;
};

export const CONTINENTS: { id: ContinentId; titleKey: 'language.continent.africa' | 'language.continent.europe' | 'language.continent.americas' | 'language.continent.asia' }[] = [
  { id: 'africa', titleKey: 'language.continent.africa' },
  { id: 'europe', titleKey: 'language.continent.europe' },
  { id: 'americas', titleKey: 'language.continent.americas' },
  { id: 'asia', titleKey: 'language.continent.asia' },
];

export const LANGUAGES: LanguageOption[] = [
  { code: 'zu', nativeName: 'isiZulu', englishName: 'Zulu', mark: 'Zu', continent: 'africa' },
  { code: 'xh', nativeName: 'isiXhosa', englishName: 'Xhosa', mark: 'Xh', continent: 'africa' },
  { code: 'af', nativeName: 'Afrikaans', englishName: 'Afrikaans', mark: 'Af', continent: 'africa' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', mark: 'Nl', continent: 'europe' },
  { code: 'en', nativeName: 'English', englishName: 'English', mark: 'Aa', continent: 'europe' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', mark: 'Fr', continent: 'europe' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', mark: 'De', continent: 'europe' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', mark: 'It', continent: 'europe' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', mark: 'Pt', continent: 'europe' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Brazilian Portuguese', mark: 'Br', continent: 'americas' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', mark: 'अ', continent: 'asia' },
  { code: 'kn', nativeName: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1', englishName: 'Kannada', mark: '\u0c85', continent: 'asia' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', mark: 'അ', continent: 'asia' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', mark: 'அ', continent: 'asia' },
  { code: 'si', nativeName: 'සිංහල', englishName: 'Sinhala', mark: 'අ', continent: 'asia' },
  { code: 'te', nativeName: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41', englishName: 'Telugu', mark: '\u0c05', continent: 'asia' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', mark: 'ا', continent: 'asia' },
  { code: 'fil', nativeName: 'Filipino', englishName: 'Filipino', mark: 'Fi', continent: 'asia' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', mark: 'In', continent: 'asia' },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', mark: 'ก', continent: 'asia' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', mark: 'あ', continent: 'asia' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', mark: '한', continent: 'asia' },
];

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return Boolean(value && (LOCALE_CODES as readonly string[]).includes(value));
}

export const LOCALE_CODES = ['en', 'ml', 'hi', 'ur', 'ta', 'te', 'kn', 'id', 'it', 'fil'] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

export type LanguageOption = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  mark: string;
};

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', mark: 'Aa' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', mark: 'അ' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', mark: 'अ' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', mark: 'ا' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', mark: 'அ' },
  { code: 'te', nativeName: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41', englishName: 'Telugu', mark: '\u0c05' },
  { code: 'kn', nativeName: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1', englishName: 'Kannada', mark: '\u0c85' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', mark: 'In' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', mark: 'It' },
  { code: 'fil', nativeName: 'Filipino', englishName: 'Filipino', mark: 'Fi' },
];

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return Boolean(value && (LOCALE_CODES as readonly string[]).includes(value));
}

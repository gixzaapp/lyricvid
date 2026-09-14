import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { create } from 'zustand';

import { isLocaleCode, type LocaleCode } from '@/i18n/languages';
import { isTranslationKey, translate, type KeyedError, type TranslationKey, type TranslateVars } from '@/i18n';

const FILE = `${documentDirectory ?? ''}lyricvid-locale.json`;

type LocaleState = {
  hydrated: boolean;
  code: LocaleCode | null;
  hydrate: () => Promise<void>;
  setLocale: (code: LocaleCode) => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set, get) => ({
  hydrated: false,
  code: null,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      if (documentDirectory) {
        const info = await getInfoAsync(FILE);
        if (info.exists) {
          const parsed = JSON.parse(await readAsStringAsync(FILE)) as { code?: string };
          if (isLocaleCode(parsed.code)) {
            set({ code: parsed.code, hydrated: true });
            return;
          }
        }
      }
    } catch {
      // First launch or unreadable file — show the picker.
    }
    set({ hydrated: true, code: null });
  },
  setLocale: async (code) => {
    set({ code });
    if (!documentDirectory) return;
    await writeAsStringAsync(FILE, JSON.stringify({ code }));
  },
}));

export function useT() {
  const code = useLocaleStore((s) => s.code);
  return (key: TranslationKey, vars?: TranslateVars) => translate(code, key, vars);
}

export function errorText(error: unknown, fallback: TranslationKey) {
  const code = useLocaleStore.getState().code;
  if (error instanceof Error && isTranslationKey(error.message)) {
    return translate(code, error.message, (error as KeyedError).vars);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return translate(code, fallback);
}

import { useRouter } from 'expo-router';

import { LanguageSelect } from '@/components/LanguageSelect';
import { useLocaleStore } from '@/store/locale';

export default function LanguageScreen() {
  const router = useRouter();
  const code = useLocaleStore((s) => s.code);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <LanguageSelect
      selected={code}
      onSelect={(next) => {
        void setLocale(next).then(() => {
          if (router.canGoBack()) {
            router.back();
          }
        });
      }}
    />
  );
}

import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import {
  checkAppUpdate,
  dismissOptionalUpdate,
  openStoreListing,
  type AppUpdateStatus,
} from '@/lib/appUpdate';
import { colors } from '@/theme';

export function UpdatePrompt() {
  const [update, setUpdate] = useState<AppUpdateStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkAppUpdate()
      .then((next) => {
        if (!cancelled) setUpdate(next);
      })
      .catch(() => {
        // Offline or missing manifest — leave the user in the current build.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const openStore = () => {
    void openStoreListing(update.storeUrl).catch(() => undefined);
  };

  const later = () => {
    void dismissOptionalUpdate(update.latest);
    setUpdate(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={update.required ? undefined : later}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{update.required ? 'Update required' : 'Update available'}</Text>
          <Text style={styles.title}>Version {update.latest} is ready</Text>
          <Text style={styles.copy}>{update.message}</Text>
          <Text style={styles.meta}>You have {update.installed}</Text>
          <Button label="Update" onPress={openStore} />
          {update.required ? null : (
            <Button label="Later" variant="secondary" onPress={later} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 4,
  },
});

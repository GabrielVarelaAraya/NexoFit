import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, textStyles } from '@nexofit/core';
import { Button } from './Button';
import {
  setDialogListener,
  type ConfirmRequest,
  type ToastRequest,
  type ToastTone,
} from '../../utils/dialogStore';

const TOAST_MS = 4000;

const TONE: Record<ToastTone, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  info: { icon: 'information-circle', color: colors.azulNexo },
  success: { icon: 'checkmark-circle', color: colors.textSuccess },
  error: { icon: 'alert-circle', color: colors.textError },
};

/**
 * Muestra los avisos (toast) y confirmaciones pedidos con notify /
 * confirmAction. Se monta una vez en App; sin él, alerts.ts usa el
 * diálogo del navegador.
 */
export function DialogHost() {
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  useEffect(
    () =>
      setDialogListener((request) => {
        if (request.kind === 'confirm') {
          setConfirm(request);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        setToast(request);
        timer.current = setTimeout(() => setToast(null), TOAST_MS);
      }),
    []
  );

  useEffect(() => () => hideToast(), [hideToast]);

  const closeConfirm = () => {
    if (!busy) setConfirm(null);
  };

  const accept = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.onConfirm();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const tone = toast ? TONE[toast.tone] : null;

  return (
    <>
      {toast && tone && (
        <View pointerEvents="box-none" style={styles.toastLayer}>
          <View
            style={[styles.toast, { borderLeftColor: tone.color }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Ionicons name={tone.icon} size={22} color={tone.color} />
            <View style={styles.toastBody}>
              {toast.title ? <Text style={styles.toastTitle}>{toast.title}</Text> : null}
              <Text style={styles.toastMessage}>{toast.message}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso"
              onPress={hideToast}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={confirm !== null}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <Pressable
          style={styles.overlay}
          onPress={closeConfirm}
          accessibilityLabel="Cerrar diálogo"
        >
          {/* Pressable interno: los toques en la tarjeta no cierran el diálogo. */}
          <Pressable style={styles.card} onPress={() => undefined} accessibilityRole="none">
            {confirm && (
              <>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  {confirm.title}
                </Text>
                <Text style={styles.cardMessage}>{confirm.message}</Text>
                <View style={styles.actions}>
                  <Button
                    title={confirm.cancelLabel}
                    variant="ghost"
                    style={styles.action}
                    disabled={busy}
                    onPress={closeConfirm}
                  />
                  <Button
                    title={confirm.confirmLabel}
                    variant={confirm.destructive ? 'danger' : 'primary'}
                    style={styles.action}
                    loading={busy}
                    onPress={() => void accept()}
                  />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    boxShadow: '0px 8px 24px rgba(6, 53, 78, 0.16)',
  },
  toastBody: { flex: 1, gap: 2 },
  toastTitle: { ...textStyles.bodyStrong, color: colors.azulNexo },
  toastMessage: { ...textStyles.body, color: colors.textSecondary },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  cardTitle: { ...textStyles.title, color: colors.azulNexo },
  cardMessage: { ...textStyles.body, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  action: { flex: 1, paddingHorizontal: 12 },
});

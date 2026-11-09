import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors, textStyles } from '@nexofit/core';
import { Button } from './Button';
import { FadeIn } from './FadeIn';
import {
  setDialogListener,
  type ConfirmRequest,
  type MessageRequest,
  type ToastRequest,
  type ToastTone,
} from '../../utils/dialogStore';

const TOAST_MS = 4000;

type IconName = keyof typeof Ionicons.glyphMap;

const TONE: Record<ToastTone, { icon: IconName; color: string }> = {
  info: { icon: 'information-circle', color: colors.azulNexo },
  success: { icon: 'checkmark-circle', color: colors.textSuccess },
  error: { icon: 'alert-circle', color: colors.textError },
};

type ModalRequest = ConfirmRequest | MessageRequest;

/**
 * Muestra los avisos de NexoFit: toast (aviso corto que se cierra solo) y
 * tarjetas con ícono para mensajes y confirmaciones, en web y en el teléfono
 * (antes en nativo salía el Alert del sistema, de texto plano). Se monta una
 * vez en App; si llegan varias tarjetas seguidas se muestran una tras otra.
 */
export function DialogHost() {
  const insets = useContext(SafeAreaInsetsContext);
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const [queue, setQueue] = useState<ModalRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = queue[0] ?? null;

  const hideToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  useEffect(
    () =>
      setDialogListener((request) => {
        if (request.kind === 'toast') {
          if (timer.current) clearTimeout(timer.current);
          setToast(request);
          timer.current = setTimeout(() => setToast(null), TOAST_MS);
          return;
        }
        setQueue((items) => [...items, request]);
      }),
    []
  );

  useEffect(() => () => hideToast(), [hideToast]);

  const dismiss = () => {
    if (busy || !current) return;
    setQueue((items) => items.slice(1));
    if (current.kind === 'message') current.onClose?.();
  };

  const accept = async () => {
    if (!current || current.kind !== 'confirm') return;
    setBusy(true);
    try {
      await current.onConfirm();
    } finally {
      setBusy(false);
      setQueue((items) => items.slice(1));
    }
  };

  const toastTone = toast ? TONE[toast.tone] : null;
  const dialogTone =
    current?.kind === 'message'
      ? TONE[current.tone]
      : current?.destructive
        ? { icon: 'warning' as IconName, color: colors.textError }
        : { icon: 'help-circle' as IconName, color: colors.textAccent };

  return (
    <>
      {toast && toastTone && (
        <View
          pointerEvents="box-none"
          style={[styles.toastLayer, { top: (insets?.top ?? 0) + 12 }]}
        >
          <View
            style={[styles.toast, { borderLeftColor: toastTone.color }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Ionicons name={toastTone.icon} size={22} color={toastTone.color} />
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

      <Modal visible={current !== null} transparent animationType="fade" onRequestClose={dismiss}>
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityLabel="Cerrar diálogo">
          {/* Pressable interno: los toques en la tarjeta no cierran el diálogo. */}
          <Pressable style={styles.cardWrap} onPress={() => undefined} accessibilityRole="none">
            {current && (
              // key: cada tarjeta de la cola vuelve a animar su entrada.
              <FadeIn key={queue.length + current.kind + current.message} rise={14} duration={220}>
                <View style={styles.card}>
                  <View style={[styles.iconWrap, { backgroundColor: dialogTone.color + '1A' }]}>
                    <Ionicons name={dialogTone.icon} size={32} color={dialogTone.color} />
                  </View>
                  {current.title ? (
                    <Text style={styles.cardTitle} accessibilityRole="header">
                      {current.title}
                    </Text>
                  ) : null}
                  <Text style={styles.cardMessage}>{current.message}</Text>

                  {current.kind === 'message' ? (
                    <Button
                      title={current.buttonLabel}
                      fullWidth
                      style={styles.singleAction}
                      onPress={dismiss}
                    />
                  ) : (
                    <View style={styles.actions}>
                      <Button
                        title={current.cancelLabel}
                        variant="ghost"
                        style={styles.action}
                        disabled={busy}
                        onPress={dismiss}
                      />
                      <Button
                        title={current.confirmLabel}
                        variant={current.destructive ? 'danger' : 'primary'}
                        style={styles.action}
                        loading={busy}
                        onPress={() => void accept()}
                      />
                    </View>
                  )}
                </View>
              </FadeIn>
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
  cardWrap: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 10,
    boxShadow: '0px 16px 40px rgba(6, 53, 78, 0.22)',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cardTitle: { ...textStyles.h2, color: colors.azulNexo, textAlign: 'center' },
  cardMessage: {
    ...textStyles.bodyLg,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  singleAction: { marginTop: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14, alignSelf: 'stretch' },
  action: { flex: 1, paddingHorizontal: 12 },
});

import { Alert, Platform } from 'react-native';
import { showDialog, toneForTitle } from './dialogStore';

/**
 * Aviso simple (éxito/error). En web se muestra como toast de la app
 * (<DialogHost />); sin host, cae a window.alert porque RN-Web ignora
 * Alert.alert. En nativo se mantiene el diálogo nativo.
 */
export function notify(message: string, title?: string): void {
  if (Platform.OS === 'web') {
    if (showDialog({ kind: 'toast', title, message, tone: toneForTitle(title) })) return;
    window.alert(title ? `${title}\n\n${message}` : message);
    return;
  }
  Alert.alert(title ?? '', message);
}

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Etiqueta del botón de confirmación. */
  confirmLabel: string;
  cancelLabel?: string;
  /** Botón en estilo destructivo (rojo). Por defecto sí. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmación de dos botones. En web usa el diálogo de la app (o
 * window.confirm si no hay host); en nativo, el diálogo nativo.
 */
export function confirmAction(options: ConfirmOptions): void {
  const {
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancelar',
    destructive = true,
    onConfirm,
  } = options;

  if (Platform.OS === 'web') {
    const shown = showDialog({
      kind: 'confirm',
      title,
      message,
      confirmLabel,
      cancelLabel,
      destructive,
      onConfirm,
    });
    if (shown) return;
    if (window.confirm(`${title}\n\n${message}`)) {
      void onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    {
      text: confirmLabel,
      ...(destructive ? { style: 'destructive' as const } : {}),
      onPress: () => void onConfirm(),
    },
  ]);
}

import { Alert, Platform } from 'react-native';

/**
 * Aviso simple (éxito/error). En web RN-Web ignora Alert.alert, así que
 * usamos window.alert; en nativo se mantiene el diálogo nativo.
 */
export function notify(message: string, title?: string): void {
  if (Platform.OS === 'web') {
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
  /** Botón en estilo destructivo (rojo en iOS). Por defecto sí. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmación de dos botones. En web usa window.confirm (Alert.alert es
 * no-op en RN-Web); en nativo, el diálogo nativo.
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

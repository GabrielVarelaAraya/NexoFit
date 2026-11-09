import { Alert, Platform } from 'react-native';
import { isLongMessage, showDialog, toneForTitle, type ToastTone } from './dialogStore';

/**
 * Los avisos y confirmaciones se muestran con el diálogo de NexoFit
 * (<DialogHost />) en web y en el teléfono. Solo si el host aún no está
 * montado se recurre al diálogo del sistema: window.alert en web (RN-Web
 * ignora Alert.alert) y Alert.alert en nativo.
 */

function systemAlert(title: string | undefined, message: string, onClose?: () => void): void {
  if (Platform.OS === 'web') {
    window.alert(title ? `${title}\n\n${message}` : message);
    onClose?.();
    return;
  }
  Alert.alert(title ?? '', message, onClose ? [{ text: 'OK', onPress: onClose }] : undefined);
}

/**
 * Aviso simple (éxito/error/información). Corto → toast que se cierra solo;
 * largo → tarjeta con botón, para poder leerlo con calma.
 */
export function notify(message: string, title?: string): void {
  const tone = toneForTitle(title);
  if (isLongMessage(message)) {
    if (showDialog({ kind: 'message', title, message, tone, buttonLabel: 'Entendido' })) return;
  } else if (showDialog({ kind: 'toast', title, message, tone })) {
    return;
  }
  systemAlert(title, message);
}

export interface MessageOptions {
  title?: string;
  message: string;
  /** Define el ícono y el color: éxito (check verde), error o información. */
  tone?: ToastTone;
  buttonLabel?: string;
  /** Se ejecuta al cerrar la tarjeta (p. ej. volver a la pantalla anterior). */
  onClose?: () => void;
}

/**
 * Mensaje que hay que reconocer con un botón antes de seguir: «Entrenamiento
 * guardado», «Clase creada»… Reemplaza a Alert.alert con un solo botón.
 */
export function showMessage(options: MessageOptions): void {
  const { title, message, tone = toneForTitle(options.title), buttonLabel = 'Entendido' } = options;
  if (showDialog({ kind: 'message', title, message, tone, buttonLabel, onClose: options.onClose }))
    return;
  systemAlert(title, message, options.onClose);
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

/** Confirmación de dos botones con el diálogo de la app (o el del sistema como respaldo). */
export function confirmAction(options: ConfirmOptions): void {
  const {
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancelar',
    destructive = true,
    onConfirm,
  } = options;

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

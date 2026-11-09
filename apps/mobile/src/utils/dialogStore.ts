/**
 * Puente entre funciones sin React (notify / confirmAction / showMessage) y el
 * <DialogHost /> montado en App. Si no hay host montado, showDialog devuelve
 * false y el llamador usa su respaldo (diálogo del navegador o nativo).
 */

export type ToastTone = 'info' | 'success' | 'error';

/** Aviso corto que se cierra solo. */
export interface ToastRequest {
  kind: 'toast';
  title?: string;
  message: string;
  tone: ToastTone;
}

/** Tarjeta con ícono, texto y un botón (éxito, error o información). */
export interface MessageRequest {
  kind: 'message';
  title?: string;
  message: string;
  tone: ToastTone;
  buttonLabel: string;
  /** Se ejecuta al cerrar (p. ej. volver a la pantalla anterior). */
  onClose?: () => void;
}

/** Pregunta con dos botones. */
export interface ConfirmRequest {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  onConfirm: () => void | Promise<void>;
}

export type DialogRequest = ToastRequest | MessageRequest | ConfirmRequest;

type Listener = (request: DialogRequest) => void;

let listener: Listener | null = null;

/** Registra el host. Devuelve la función para desregistrarlo. */
export function setDialogListener(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function showDialog(request: DialogRequest): boolean {
  if (!listener) return false;
  listener(request);
  return true;
}

const ERROR_TITLE = /error|no se pudo|sin conexi|sin permiso|atenci/i;
const SUCCESS_TITLE = /listo|éxito|exito|guardad|enviad|cread|reservad|complet|registrad/i;

/** Tono del aviso a partir del título que ya usan las pantallas. */
export function toneForTitle(title?: string): ToastTone {
  if (!title) return 'info';
  if (ERROR_TITLE.test(title)) return 'error';
  if (SUCCESS_TITLE.test(title)) return 'success';
  return 'info';
}

/** A partir de este largo un aviso no cabe en un toast que se cierra solo. */
export const LONG_MESSAGE_CHARS = 90;

/**
 * ¿El aviso merece una tarjeta (que se lee con calma y se cierra con un
 * botón) en vez de un toast de 4 s? Textos largos como «Acerca de NexoFit» o
 * la ayuda no se alcanzan a leer en un toast.
 */
export function isLongMessage(message: string): boolean {
  return message.length > LONG_MESSAGE_CHARS || message.includes('\n');
}

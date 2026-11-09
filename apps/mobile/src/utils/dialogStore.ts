/**
 * Puente entre funciones sin React (notify / confirmAction) y el <DialogHost />
 * montado en App. Si no hay host montado, showDialog devuelve false y el
 * llamador usa su respaldo (diálogo del navegador o nativo).
 */

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastRequest {
  kind: 'toast';
  title?: string;
  message: string;
  tone: ToastTone;
}

export interface ConfirmRequest {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  onConfirm: () => void | Promise<void>;
}

export type DialogRequest = ToastRequest | ConfirmRequest;

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
const SUCCESS_TITLE = /listo|éxito|exito|guardad|enviad|cread|reservad/i;

/** Tono del toast a partir del título que ya usan las pantallas. */
export function toneForTitle(title?: string): ToastTone {
  if (!title) return 'info';
  if (ERROR_TITLE.test(title)) return 'error';
  if (SUCCESS_TITLE.test(title)) return 'success';
  return 'info';
}

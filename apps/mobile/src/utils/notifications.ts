// Lógica pura del centro de notificaciones: orden, conteo de no leídas y
// actualización local. Vive separada de los hooks para poder probarla sin
// montar React Native.

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

/** Máximo de notificaciones que carga el centro. */
export const NOTIFICATIONS_LIMIT = 20;

/** Más recientes primero. No muta el arreglo recibido. */
export function sortNotificationsDesc(items: AppNotification[]): AppNotification[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/** Cantidad de notificaciones sin leer. */
export function countUnread(items: AppNotification[]): number {
  return items.reduce((total, item) => (item.read ? total : total + 1), 0);
}

/** Copia con todas marcadas como leídas. No muta el arreglo recibido. */
export function markAllReadLocally(items: AppNotification[]): AppNotification[] {
  return items.map((item) => (item.read ? item : { ...item, read: true }));
}

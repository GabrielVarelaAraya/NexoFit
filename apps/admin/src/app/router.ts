import { useCallback, useEffect, useState } from 'react';

// Router mínimo para la consola web: cada sección tiene su URL, el botón
// atrás del navegador funciona y recargar conserva la página. Sin
// dependencias: History API (pushState + popstate).

export type ViewName = 'dashboard' | 'agenda' | 'members' | 'payments';

export const ROUTES: Record<ViewName, string> = {
  dashboard: '/',
  agenda: '/agenda',
  members: '/miembros',
  payments: '/pagos',
};

export const VIEW_TITLES: Record<ViewName, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  members: 'Miembros',
  payments: 'Pagos',
};

export type Navigate = (view: ViewName, params?: Record<string, string>, replace?: boolean) => void;

/** Props comunes de las pantallas de la consola. */
export interface ScreenProps {
  organizationId: string;
  navigate: Navigate;
  params: Record<string, string>;
  /** auth.uid() del admin conectado (p. ej. para no cambiar su propio rol). */
  currentUserId: string;
}

export interface Route {
  view: ViewName;
  params: Record<string, string>;
}

/** '/miembros?m=abc' → { view: 'members', params: { m: 'abc' } }. Desconocido → dashboard. */
export function parseLocation(pathname: string, search = ''): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const view =
    (Object.entries(ROUTES).find(([, path]) => path === clean)?.[0] as ViewName | undefined) ??
    'dashboard';
  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    params[key] = value;
  });
  return { view, params };
}

export function buildPath(view: ViewName, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== '')
  ).toString();
  return query ? `${ROUTES[view]}?${query}` : ROUTES[view];
}

export function documentTitle(view: ViewName): string {
  return `${VIEW_TITLES[view]} · NexoFit Admin`;
}

const hasWindow = () => typeof window !== 'undefined' && typeof window.history !== 'undefined';

function currentRoute(): Route {
  if (!hasWindow()) return { view: 'dashboard', params: {} };
  return parseLocation(window.location.pathname, window.location.search);
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    if (!hasWindow()) return;
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = documentTitle(route.view);
  }, [route.view]);

  /** `replace` cambia la URL sin agregar una entrada al historial (p. ej. filtros). */
  const navigate = useCallback(
    (view: ViewName, params: Record<string, string> = {}, replace = false) => {
      const next = { view, params };
      if (hasWindow()) {
        const path = buildPath(view, params);
        if (replace) window.history.replaceState(null, '', path);
        else window.history.pushState(null, '', path);
      }
      setRoute(next);
    },
    []
  );

  return { route, navigate };
}

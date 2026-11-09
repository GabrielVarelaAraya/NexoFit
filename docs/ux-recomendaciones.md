# NexoFit: auditoría de UI/UX y recomendaciones

Fecha: 8 nov 2026. Revisado en vivo en web: app móvil (`localhost:8081`, viewport 375×812) con
cuentas de miembro, profesional y admin, y consola de administración (`localhost:8082`,
1366×850 y 375×812). También se revisó el código de `apps/mobile`, `apps/admin` y
`packages/core/src/theme`.

## Cómo leer las prioridades

| Prioridad | Significado                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| **P0**    | Algo se ve roto, confunde o puede causar una acción no deseada. Corregir primero. |
| **P1**    | Fricción alta o falta algo que el usuario espera en ese flujo.                    |
| **P2**    | Pulido, consistencia y deuda de diseño.                                           |

Esfuerzo estimado: **S** (< 1 h), **M** (medio día), **L** (1 día o más).

---

## 1. Transversal (sistema de diseño)

| #   | Hallazgo                                                                                                                                                               | Recomendación                                                                                                                                                                                              | Prio | Esf. |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| T1  | La consola admin no carga fuentes: `fontFamily` pide `Inter_*` / `Nunito_*` pero `apps/admin/src/app/App.tsx` no llama `useFonts`, así que todo sale en serif (Times). | Cargar Inter y Nunito igual que `apps/mobile/src/app/App.tsx` (o vía `<link>` de Google Fonts en web) y mostrar un splash hasta que estén listas.                                                          | P0   | S    |
| T2  | 122 colores hex sueltos en pantallas (`#F59E0B`, `#EF4444`, `#F3F4F6`…). `colors` solo tiene marca y texto.                                                            | Agregar tokens semánticos en `packages/core/src/theme/colors.ts`: `surface`, `surfaceMuted`, `border`, `warning`, `danger`, `success`, `info` (+ variantes `*Bg`) y reemplazar los literales.              | P2   | M    |
| T3  | 15 tamaños de fuente distintos (10–32) escritos a mano.                                                                                                                | Escala tipográfica en `typography.ts` (`caption 12`, `body 14`, `bodyLg 16`, `title 18`, `h2 22`, `h1 28`) y estilos `text.*` reutilizables.                                                               | P2   | M    |
| T4  | Faltan componentes base: cada pantalla arma sus chips, badges, modales, listas de ajustes y estados vacíos.                                                            | Crear en `components/ui`: `Badge`, `Chip/SegmentedControl`, `Modal/Sheet`, `ListItem`, `EmptyState`, `StatCard`, `Toast`. Hoy `ClientsScreen`, `ProfileScreen` y `BookAppointmentScreen` duplican estilos. | P1   | L    |
| T5  | `utils/alerts.ts` usa `window.alert` / `window.confirm` en web: diálogos nativos del navegador, sin marca, bloqueantes.                                                | Reemplazar `notify` por un `Toast` y `confirmAction` por un `ConfirmDialog` in-app (misma API, promesa), con variante destructiva.                                                                         | P1   | M    |
| T6  | Accesibilidad: solo 29 `accessibilityLabel` para 167 elementos tocables; los inputs de admin web no tienen etiqueta (el nombre accesible es el placeholder).           | Pasada de a11y: `accessibilityRole`/`Label` en todo `TouchableOpacity`, `label` real en inputs, objetivos táctiles ≥ 44 px, contraste AA en textos secundarios.                                            | P1   | M    |
| T7  | Enter no envía el login (ni en móvil web ni en admin).                                                                                                                 | `onSubmitEditing` + `returnKeyType` en todos los formularios (`Login`, `SignUp`, `NewPassword`, admin `LoginScreen`); en web, envolver en `<form>`.                                                        | P1   | S    |
| T8  | Placeholders casi del mismo color que el texto real (`sofia@email.com` parece un valor ya escrito).                                                                    | `placeholderTextColor` con token (`#94A3B8` aprox.) en `Input`.                                                                                                                                            | P1   | S    |
| T9  | Sin mostrar/ocultar contraseña.                                                                                                                                        | Ícono de ojo en `Input` cuando `secureTextEntry`.                                                                                                                                                          | P2   | S    |
| T10 | Formatos de fecha mezclados: "6/10/2026", "6 OCT", "12 oct 2026", "10/11/2026 11:00".                                                                                  | Un helper en `packages/core` (`formatDate`, `formatDateTime`, `formatRelative`) y usarlo en todo, incluso en las notificaciones SQL.                                                                       | P2   | S    |
| T11 | Título de pestaña del navegador "undefined" en varias pantallas móviles y "Mas" sin tilde.                                                                             | Definir `title` en cada screen (`options.title`) y `documentTitle` del `NavigationContainer`.                                                                                                              | P2   | S    |
| T12 | Advertencias de deprecación `shadow*` y `pointerEvents` en web.                                                                                                        | Migrar a `boxShadow` y `style.pointerEvents`.                                                                                                                                                              | P2   | S    |

## 2. App móvil

### 2.1 Autenticación y onboarding

| #   | Hallazgo                                                                                                                                                              | Recomendación                                                                                                                               | Prio | Esf. |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| A1  | Se pide elegir rol **antes** de iniciar sesión, también al que ya tiene cuenta. El rol real lo da la membresía, así que la elección no cambia nada para quien vuelve. | Pantalla de bienvenida con logo, "Iniciar sesión" y "Crear cuenta". Pedir el tipo de uso solo en el registro.                               | P0   | M    |
| A2  | Selección de rol: "Continuar" tocaba la última tarjeta; "Represento un gimnasio" lleva a registro y las otras a login (inconsistente).                                | Con A1 se resuelve; si se mantiene: estado seleccionado claro (borde + check), botón deshabilitado hasta elegir y mismo destino para todas. | P1   | S    |
| A3  | No hay marca: ni logo ni color en la primera pantalla.                                                                                                                | Logo NexoFit + tagline en bienvenida/login.                                                                                                 | P2   | S    |
| A4  | Registro sin requisitos de contraseña ni botón atrás.                                                                                                                 | Mostrar reglas en vivo (mín. 8) y un back en el header.                                                                                     | P1   | S    |

### 2.2 Miembro

| #   | Pantalla         | Hallazgo                                                                                                                       | Recomendación                                                                                                                                      | Prio | Esf. |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| M1  | Inicio           | Saluda "Hola, gabovarela373" (parte del correo) aunque el perfil tiene "Gabriel Varela" (`HomeScreen.tsx:105`).                | Usar `profile.full_name` (primer nombre) y caer al correo solo si no hay nombre.                                                                   | P0   | S    |
| M2  | Inicio           | Solo lista clases; no hay resumen personal.                                                                                    | Tarjetas arriba: próxima reserva/cita (con acceso directo), estado de membresía y último progreso. "Clases de hoy" debería ocultar las ya pasadas. | P1   | M    |
| M3  | Barra inferior   | Citas usa ícono `people` (parece "comunidad").                                                                                 | Clases → `barbell`, Citas → `calendar`/`calendar-clear`.                                                                                           | P2   | S    |
| M4  | Clases           | Tira de días sin indicar que hay más (scroll horizontal oculto); mucho espacio vacío bajo las tarjetas.                        | Mostrar mes/semana, fade o flecha al borde; estado vacío útil ("No hay clases el domingo → ver lunes").                                            | P2   | S    |
| M5  | Progreso         | ~~Color por signo~~ Descartado: el código ya colorea por indicador (`trendColorFor`); bajar masa muscular en rojo es correcto. | Nada que hacer.                                                                                                                                    | —    | —    |
| M6  | Progreso         | Las 4 tarjetas de arriba repiten valores de "Medidas corporales"; no hay gráfico de evolución.                                 | Arriba: 2–3 KPIs con mini-gráfico (sparkline) y la tendencia; quitar la duplicación.                                                               | P1   | M    |
| M7  | Progreso         | Toda la fila del historial era el botón de borrar ("Tocar para eliminar"); pedía confirmación, pero la affordance confundía.   | Fila informativa y borrado con ícono de papelera + confirmación que explica el alcance.                                                            | P1   | S    |
| M8  | Progreso         | Dos botones con la misma acción ("+ Añadir" y "Añadir medidas").                                                               | Dejar uno (el del encabezado de la sección).                                                                                                       | P2   | S    |
| M9  | Citas            | Canceladas y activas mezcladas, ordenadas por fecha.                                                                           | Segmento Próximas / Anteriores; canceladas atenuadas y al final.                                                                                   | P1   | S    |
| M10 | Citas            | El profesional aparece con el nombre del perfil ("Gym") y especialidad "Por definir".                                          | Validar que el profesional complete nombre y especialidad antes de aparecer en la lista de reserva (o mostrar "Profesional" + avatar).             | P2   | S    |
| M11 | Reservar cita    | Con un solo profesional, el paso 1 desaparece y la numeración arranca en "1. Servicio" sin explicar a quién se reserva.        | Mantener el resumen del profesional con foto/especialidad; resumen sticky de la selección justo encima de "Confirmar".                             | P2   | S    |
| M12 | Perfil           | "Salir del gimnasio" (rojo, destructivo) mezclado con opciones normales.                                                       | Moverlo a una "Zona de riesgo" al final, separado de "Cerrar sesión", con confirmación que diga las consecuencias.                                 | P1   | S    |
| M13 | Mis pagos y plan | "Consulta las membresías disponibles" sin enlace ni botón.                                                                     | CTA "Ver planes" o texto que diga a quién acudir; listar el historial en una pantalla propia, no en un modal.                                      | P2   | S    |

### 2.3 Profesional

| #   | Hallazgo                                                                               | Recomendación                                                                                           | Prio | Esf. |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---- | ---- |
| P1  | El aviso al cancelar dice "El paciente verá esta cita como cancelada".                 | Usar "cliente" de forma consistente.                                                                    | P2   | S    |
| P2  | Si la ficha (especialidad, bio) está vacía no hay aviso.                               | Banner "Completa tu ficha para aparecer en Reservas" con atajo.                                         | P1   | S    |
| P3  | La agenda muestra fecha larga y hora en líneas separadas; no hay vista por día/semana. | Agrupar por día con encabezados ("Hoy", "Mañana", "mar 10 nov") y añadir datos de contacto del cliente. | P2   | M    |

### 2.4 Admin / staff en el móvil

| #   | Hallazgo                                                                                                                                      | Recomendación                                                                               | Prio | Esf. |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | ---- |
| S1  | Dashboard: textos de acciones rápidas cortados ("Publicar programa", "Crear tipo de clase"); colores de cada botón distintos sin significado. | Grid de 2 columnas con ícono arriba y texto en 2 líneas; un solo estilo (outline turquesa). | P1   | S    |
| S2  | Dashboard: 5 KPIs con la quinta sola en su fila.                                                                                              | 4 KPIs (o 6) para que el grid quede parejo; la tarjeta debe llevar a su detalle al tocarla. | P2   | S    |
| S3  | "Más" repite las acciones rápidas del Dashboard.                                                                                              | Dejar en "Más" solo configuración/cuenta; las operaciones en el Dashboard.                  | P2   | S    |
| S4  | Clientes: "Cambiar rol" se muestra en la propia fila del admin, aunque está bloqueado; chips de filtro cortados ("Profesio…").                | Ocultar la acción sobre uno mismo; chips que hagan wrap o scroll con fade.                  | P2   | S    |
| S5  | Agenda: la tarjeta de clase no abre detalle (asistentes, check-in).                                                                           | Tocar abre la sesión con lista de reservas y asistencia.                                    | P1   | M    |
| S6  | El staff no ve ni gestiona las citas 1-a-1.                                                                                                   | Sección "Citas" (por profesional/día) en Agenda.                                            | P1   | M    |

## 3. Consola de administración (web)

| #   | Hallazgo                                                                                                                                                                     | Recomendación                                                                                                      | Prio | Esf. |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| W1  | Fuente serif por falta de carga (ver T1).                                                                                                                                    | Ver T1.                                                                                                            | P0   | S    |
| W2  | El menú lateral está centrado verticalmente: entre el logo y "Dashboard" queda un hueco grande.                                                                              | Navegación pegada arriba, con íconos y agrupada (Operación / Finanzas / Configuración).                            | P1   | S    |
| W3  | La consola web tiene **menos** funciones que el admin móvil: solo Dashboard, Miembros y Pagos. Falta Agenda/Clases, Citas, Profesionales, Notificaciones, Planes y Espacios. | Paridad progresiva, empezando por Agenda + Citas y Planes/Registrar pago (las tareas de escritorio típicas).       | P1   | L    |
| W4  | La URL siempre es `/`: no hay deep links, recargar vuelve al Dashboard y el botón atrás no funciona.                                                                         | Rutas por sección (`/miembros`, `/pagos`, `/agenda`) con Expo Router o `linking` de React Navigation.              | P1   | M    |
| W5  | Miembros: sin filtro por rol, sin correo, sin paginación ni detalle; el rol se cambia desde un dropdown en la tabla.                                                         | Columnas Nombre, Correo, Rol, Alta, Estado de pago; filtros; panel lateral de detalle; confirmar al dar rol admin. | P1   | M    |
| W6  | Pagos: solo lectura, sin "Registrar pago", filtros por fecha/método ni exportar.                                                                                             | Botón primario "Registrar pago", filtros y exportar CSV.                                                           | P1   | M    |
| W7  | KPIs sin ícono, sin comparación con el periodo anterior y sin enlace; "Miembros registrados" vs "Miembros activos" en móvil.                                                 | Mismo nombre y definición en ambas apps; delta vs mes anterior; clic lleva al listado filtrado.                    | P2   | S    |
| W8  | "Próximas clases" muestra hora sin fecha; "Actividad reciente" no incluye citas 1-a-1 ni pagos.                                                                              | Fecha relativa ("hoy 07:00") y eventos de citas/pagos en el feed.                                                  | P2   | S    |
| W9  | Login: "Enter" no envía (T7) y los inputs no tienen etiqueta (T6).                                                                                                           | Ver T6/T7.                                                                                                         | P1   | S    |
| W10 | En ventanas angostas la barra superior se rompe en 2 líneas y la tabla de Pagos corta columnas sin aviso.                                                                    | Menú hamburguesa < 768 px; tablas → tarjetas apiladas en móvil.                                                    | P2   | M    |
| W11 | "Actualizar" como texto suelto arriba a la derecha.                                                                                                                          | Botón ícono con estado de carga + "Actualizado hace X min", o auto-refresco vía Realtime.                          | P2   | S    |

---

## 4. Plan sugerido de implementación

Cada lote se puede revisar y commitear por separado.

1. **Lote 1 – Arreglos rápidos (P0/P1, S):** T1, T7, T8, M1, M7, M9, M12, S1, W2, P1. ✅ Hecho
   (8 nov 2026). W2 quedó en "pegada arriba"; íconos y grupos del menú pasan al Lote 5.
2. **Lote 2 – Base del sistema de diseño:** T4 (componentes), T5 (Toast/ConfirmDialog), T2/T3 (tokens), T9, T10, T11. ✅ Hecho
   (8 nov 2026), con pendientes:
   - T2: tokens semánticos en `colors.ts`; de 122 hex sueltos quedan 28 (colores de categoría/marca).
   - T3: escala `textStyles` creada; se usa en los componentes nuevos, falta migrar pantallas.
   - T4: `DialogHost`, `Badge`, `SegmentedControl`, `EmptyState`. Faltan `ListItem`, `StatCard` y `Sheet`.
   - T10: `formatDate*` en `@nexofit/core`, usado en móvil; falta la consola web y las notificaciones SQL.
   - T11: títulos «Pantalla · NexoFit»; justo después de iniciar sesión muestra solo «NexoFit».
3. **Lote 3 – Onboarding:** A1–A4. ✅ Hecho (8 nov 2026): pantalla de bienvenida con marca
   («Iniciar sesión» / «Crear cuenta»), el tipo de uso se pregunta solo en el registro,
   requisitos de contraseña en vivo y «Volver» en login y registro. El login ahora dice
   «Hola de nuevo» (antes «Bienvenida de vuelta», con género asumido).
4. **Lote 4 – Contenido de valor para el miembro:** M2, M6, M11, M13, P2. ✅ Hecho (8 nov 2026):
   - M2: Inicio con tarjeta «Tu próxima cita», accesos rápidos y sin clases de hoy ya terminadas.
     No muestra estado de membresía (eso vive en «Mis pagos y plan»).
   - M6/M8: card «Evolución» (peso, grasa, masa muscular) con mini-gráfico y cambio en el
     periodo; se quitaron las 4 tarjetas duplicadas y el botón «Añadir medidas» repetido.
   - M11: «Tu cita será con…» (inicial, especialidad, bio), pasos numerados siempre y pie que
     dice qué falta elegir.
   - M13: sin plan, dice que se activa en recepción; con plan, avisa si vence en ≤ 7 días.
   - P2: lista «Completa tu perfil para recibir reservas» en la agenda del profesional.
   - Sin verificar en vivo: tarjeta de próxima cita, banner del profesional en Reservar y la
     lista del profesional (no hay profesional ni citas de prueba en la base).
5. **Lote 5 – Consola web:** W4 (rutas), W5, W6, W7, W8, W10, W11, luego W3 (paridad).
6. **Lote 6 – Staff móvil:** S2–S6, P3. ✅ Hecho (8 nov 2026):
   - S2: 4 KPIs (2×2) tocables; al coach se le muestra «Reservas este mes» en vez de ingresos,
     y la acción «Registrar pago» es solo admin (RLS de pagos).
   - S3: «Más» con solo configuración (Espacios y clases, Planes y pagos) y cuenta.
   - S4: sin «Cambiar rol» en la fila propia («Tú»), filtros con wrap y filtro «Admin».
   - S5: la tarjeta de clase abre «Lista de la clase» con conteos y «Asistió / No vino /
     Deshacer» desde 15 min antes. Usa el estado de la reserva (reversible), no la tabla
     `attendance`, que no permite borrar.
   - S6: Agenda con pestañas «Clases | Citas 1-a-1»; el admin ve las citas del día con cliente y
     profesional y puede cancelarlas (el miembro recibe aviso). El coach ve un aviso: la RLS no
     le da acceso a citas.
   - P3: agenda del profesional agrupada por día («Hoy», «Mañana», fecha) con la hora al frente.
   - Sin verificar en vivo: marcar asistencia (no había reservas activas) y la lista de citas con
     datos (no hay citas en la base).
7. **Transversal continuo:** T6 (accesibilidad) y T12 en cada pantalla que se toque.

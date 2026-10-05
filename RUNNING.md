# Running NexoFit Locally

Step-by-step guide to run the NexoFit mobile app on your machine or device.

## Prerequisites

| Tool    | Version | Install                                    |
| ------- | ------- | ------------------------------------------ |
| Node.js | ≥ 20    | [nodejs.org](https://nodejs.org)           |
| pnpm    | ≥ 11    | `npm install -g pnpm`                      |
| Expo Go | latest  | App Store / Play Store (for phone testing) |

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project** and choose a name + database password
3. Wait for the project to initialize (~1 minute)
4. Go to **Project Settings → API** and copy:
   - **Project URL** — `https://XXXXXXXX.supabase.co`
   - **Anon key** — under `Project API keys → anon public`

> The anon key is safe to use in the client. Never expose the `service_role` key.

## 2. Run Database Migrations

In the Supabase dashboard, go to **SQL Editor** and run each file in order.

Open each file, copy its contents, paste into the SQL Editor, and click **Run**:

```
packages/db/migrations/000001_create_schema.sql
packages/db/migrations/000002_create_functions.sql
packages/db/migrations/000003_create_rls_policies.sql
```

Wait for each to complete before running the next. You should see "Success" after each.

> **Idempotent:** the three files only create what's missing
> (`IF NOT EXISTS`, `CREATE OR REPLACE`, and they recreate only their own
> policies), so it is safe to re-run them. A project already set up with the
> previous 8-file layout does **not** need to re-run anything — the final
> state is identical.
>
> **Upgrading an existing project:** re-run all three files in order after
> pulling new changes. That's how you get the Stage 5 additions (the
> `membership_plans`/`payments` tables, their RLS policies, and the updated
> `cancel_booking` with the waitlist-promotion notification).

### What each migration does

| Migration | Purpose                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `000001`  | Creates all 29 tables, 7 enums, 23 indexes, and the timestamp/user triggers            |
| `000002`  | Creates RPCs: `book_session`, `cancel_booking`, `create_organization`, and RLS helpers |
| `000003`  | Enables RLS on every table and creates the 101 final policies                          |

## 3. Disable Email Confirmation (optional, for faster testing)

By default Supabase requires email confirmation. To skip this during development:

1. Go to **Authentication → Providers → Email**
2. Toggle **Confirm email** OFF

This lets you sign up and log in immediately without checking your inbox.

## 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://XXXXXXXX.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> Never commit `.env` to git. It's already in `.gitignore`.

## 5. Install Dependencies

```bash
pnpm install
```

## 6. Start the Dev Server

```bash
pnpm --filter @nexofit/mobile start
```

You'll see a QR code in the terminal.

### Running on different platforms

| Platform                     | How                                 |
| ---------------------------- | ----------------------------------- |
| **Your phone (iOS)**         | Open Expo Go → Scan QR              |
| **Your phone (Android)**     | Open Expo Go → Scan QR              |
| **Web browser**              | Press `w`                           |
| **iOS Simulator** (Mac only) | Press `i`                           |
| **Android Emulator**         | Press `a` (requires Android Studio) |

> For web, the app runs at `http://localhost:8081`.

## 7. Test the App

### Sign up

1. Open the app → you'll see the **Sign Up** screen
2. Enter name, email, and password (min 8 characters)
3. Tap **Sign Up**
4. If email confirmation is on, check your inbox and click the link
5. You'll be redirected to login

### Join or create a gym (real flow)

After logging in without a gym you land on **Inicio**. If your account has
no gym yet you get two real options (no mocks):

- **Buscar un gimnasio** → directory of real organizations → _Unirme a este
  gimnasio_ enrolls you instantly as a `member` (client tabs).
- **Registrar mi gimnasio** → creates the organization via the
  `create_organization()` RPC, makes you its `admin` and drops you straight
  into the **admin panel** (Dashboard / Agenda / Clientes / Más).

Either action refreshes your membership immediately — no app restart needed.
The role decides the tabs: `admin`/`coach` → admin tabs (create classes,
publish programs, notifications, payments); everyone else → client tabs.

> A brand-new gym starts with **no venues, spaces or class types**. Your
> first stop as admin is **Más → Espacios y clases**: create a sede, its
> spaces (with cupo) and your class types — then **Nueva clase** works end
> to end. No SQL needed.

### Create test data (via SQL)

After signing up, run this seed in the Supabase **SQL Editor**. It is
**idempotent** (safe to re-run) and does not require editing any IDs — it
picks the most recent profile automatically.

```sql
-- ============================================================
-- NexoFit · seed de prueba (idempotente: puedes re-ejecutarlo)
-- ============================================================

-- 1) Tu perfil. Ojo: profiles NO tiene columna email
--    (los correos viven en auth.users).
SELECT u.id, u.email, p.full_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id;

-- Si tienes varios usuarios y quieres fijar uno, sustituye
--   (SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1)
-- por tu id exacto en los pasos 2, 7 y 8.

-- 2) Gimnasio + tu membresía como admin
INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Gym', 'test-gym')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (organization_id, profile_id, role)
SELECT '11111111-1111-1111-1111-111111111111', id, 'admin'
FROM profiles
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (organization_id, profile_id) DO NOTHING;

-- 3) Sede y espacio (cupo 20)
INSERT INTO venues (id, organization_id, name)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Main Box')
ON CONFLICT (id) DO NOTHING;

INSERT INTO spaces (id, venue_id, name, capacity)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Floor A', 20)
ON CONFLICT (id) DO NOTHING;

-- 4) Tipo de clase (class_types NO tiene columna emoji)
INSERT INTO class_types (id, organization_id, name, color, description)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'CrossFit WOD', '#0B9B91', 'WOD funcional')
ON CONFLICT (id) DO NOTHING;

-- 5) Coach (sessions.coach_id apunta a coaches.id, no a profiles.id;
--    coaches.membership_id enlaza con tu membresía)
INSERT INTO coaches (id, membership_id, specialization)
SELECT
  '88888888-8888-8888-8888-888888888888',
  m.id,
  'Fuerza y acondicionamiento'
FROM memberships m
WHERE m.organization_id = '11111111-1111-1111-1111-111111111111'
ORDER BY m.created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 6) Sesiones (sessions NO tiene organization_id/venue_id;
--    los horarios son starts_at/ends_at)
--    · Hoy en +2h → Inicio ("Clases de hoy") y Horario muestran algo ya
INSERT INTO sessions (id, class_type_id, space_id, coach_id, starts_at, ends_at)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  (SELECT id FROM coaches WHERE id = '88888888-8888-8888-8888-888888888888'),
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '3 hours'
)
ON CONFLICT (id) DO NOTHING;

--    · Mañana (la que usa el flujo "Book a session")
INSERT INTO sessions (id, class_type_id, space_id, coach_id, starts_at, ends_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  (SELECT id FROM coaches WHERE id = '88888888-8888-8888-8888-888888888888'),
  NOW() + INTERVAL '1 day' + INTERVAL '7 hours',
  NOW() + INTERVAL '1 day' + INTERVAL '8 hours'
)
ON CONFLICT (id) DO NOTHING;

-- 7) Profesional + servicio (para la pestaña Citas). Como solo hay un
--    usuario de prueba, el profesional y el cliente son la misma persona.
INSERT INTO professionals (id, membership_id, specialization)
SELECT
  '99999999-9999-9999-9999-999999999999',
  m.id,
  'Fisioterapia deportiva'
FROM memberships m
WHERE m.organization_id = '11111111-1111-1111-1111-111111111111'
ORDER BY m.created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, organization_id, professional_id, name, description, duration_minutes)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999999',
  'Valoración inicial',
  'Sesión 1-a-1 de valoración',
  45
ON CONFLICT (id) DO NOTHING;

-- 8) Citas: una próxima (mañana) y una pasada ("Finalizada")
INSERT INTO appointments (id, organization_id, service_id, professional_id, profile_id, starts_at, ends_at, status)
SELECT
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '99999999-9999-9999-9999-999999999999',
  p.id,
  NOW() + INTERVAL '1 day' + INTERVAL '3 hours',
  NOW() + INTERVAL '1 day' + INTERVAL '3 hours 45 minutes',
  'confirmed'
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, organization_id, service_id, professional_id, profile_id, starts_at, ends_at, status)
SELECT
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '99999999-9999-9999-9999-999999999999',
  p.id,
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '45 minutes',
  'confirmed'
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 9) Biblioteca de ejercicios (para registrar entrenamientos en Progreso)
INSERT INTO exercise_library (id, organization_id, name, category, primary_muscle, equipment)
VALUES
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sentadilla', 'Fuerza', 'Piernas', ARRAY['Barra']),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Press de banca', 'Fuerza', 'Pecho', ARRAY['Barra', 'Banco']),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Peso muerto', 'Fuerza', 'Espalda', ARRAY['Barra']),
  ('dddddddd-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Dominadas', 'Calistenia', 'Espalda', ARRAY['Barra de dominadas']),
  ('dddddddd-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Carrera continua', 'Cardio', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 10) Programa del coach para la sesión de hoy (se ve en el detalle de la clase)
INSERT INTO workout_programs (id, session_id, content, published_by)
VALUES (
  'eeeeeeee-0000-0000-0000-000000000001',
  '66666666-6666-6666-6666-666666666666',
  E'Warm-up\n• 500 m remo\n• 10 flexiones\n• 10 sentadillas\n\nWOD\n• 5 rondas: 10 sentadillas con peso (30 kg) y 200 m carrera\n\nCool-down\n• Estiramiento 5 min',
  (SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- 11) Planes de membresía (Stage 5 · Pagos)
INSERT INTO membership_plans (id, organization_id, name, description, price_cents, currency, duration_days)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Plan mensual', 'Acceso ilimitado a clases grupales', 2500, 'USD', 30),
  ('eeeeeeee-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Plan anual', '12 meses de acceso con descuento', 24000, 'USD', 365)
ON CONFLICT (id) DO NOTHING;

-- 12) Un pago de ejemplo (hoy) para el perfil más reciente: alimenta el
--     "Ingresos del mes" del Dashboard y Perfil → "Mis pagos y plan".
INSERT INTO payments (id, organization_id, profile_id, plan_id, amount_cents, currency, method, status, created_by)
SELECT
  'eeeeeeee-0000-0000-0000-000000000013',
  '11111111-1111-1111-1111-111111111111',
  p.id,
  'eeeeeeee-0000-0000-0000-000000000011',
  2500, 'USD', 'cash', 'paid',
  p.id
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;
```

### Book a session

1. **Inicio** tab → "Clases de hoy" should show the session seeded at now +2h
2. Go to the **Clases** tab
3. Select tomorrow's date in the horizontal date picker
4. You should see "CrossFit WOD" with "20 cupos" and the coach name
5. Tap **Reservar** → confirm; back in **Clases** the button now reads
   **"Ya reservada"** and the badge shows 19 cupos
6. Go to **Mis reservas** (Inicio → "Ver todas") → see your confirmed booking
7. Tap **Cancelar** → the booking is removed and the class shows
   **20 cupos** again (spots are returned immediately)

### Test waitlist (needs a second account)

A single profile can't queue behind itself — a confirmed booking returns
"Ya reservada". Use two signups:

1. Seed a full class (capacity 1):

   ```sql
   INSERT INTO sessions (id, class_type_id, space_id, starts_at, ends_at, capacity_override)
   VALUES (
     '77777777-7777-7777-7777-777777777777',
     '44444444-4444-4444-4444-444444444444',
     '33333333-3333-3333-3333-333333333333',
     NOW() + INTERVAL '1 day',
     NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
     1
   )
   ON CONFLICT (id) DO NOTHING;
   ```

2. Sign up a second account (email confirmation OFF makes this fast) and add
   it to Test Gym:

   ```sql
   SELECT id, email FROM auth.users;  -- copia el id de la 2da cuenta

   INSERT INTO memberships (organization_id, profile_id, role)
   VALUES ('11111111-1111-1111-1111-111111111111', '<ID_SEGUNDA_CUENTA>', 'member')
   ON CONFLICT (organization_id, profile_id) DO NOTHING;
   ```

3. From the second account book `77777777-…` → confirmed (1/1, "Completo")
4. From the first account open the same class → **Unirse a lista de espera**
   → waitlist #1 (re-tapping returns your position, not an error)
5. Cancel the confirmed booking → the waitlist auto-promotes to confirmed

### Log a workout (Stage 4)

1. Run the seed above — steps 9–10 add an exercise library and a coach
   program for today's session.
2. **Progreso** tab → **+ Entrenamiento** → _+ Añadir_ → pick "Sentadilla"
   → enter reps/peso per serie → **Guardar entrenamiento**.
3. The log appears under **Mis entrenamientos** (tap it to expand the sets)
   and, if you beat your best weight, a new row shows under
   **Récords personales**.
4. From **Clases → detalle de la clase** you can also tap
   **Registrar entrenamiento**: the log stays linked to that session (and its
   program), and when the coach published one you'll see the card
   **Entrenamiento de la sesión**.

### Admin flows (Stage 6)

1. Log in with the seed user (step 2 makes the latest profile **admin** of
   Test Gym). You land on the admin tabs: Dashboard / Agenda / Clientes / Más.
2. **Dashboard** — metrics are real: miembros activos, ingresos del mes,
   clases hoy, ocupación media (próximos 7 días) y reservas este mes;
   _Actividad reciente_ shows real bookings/cancellations/signups and
   _Próximas clases_ the next sessions with their cupos. Pull to refresh.
3. **Agenda** — pick a day → real sessions with occupancy bars. Tap the **+**
   FAB → _Nueva clase_ (tipo, espacio, fecha, horario, cupo opcional) → the
   class shows up on that day (and in the member schedule).
4. **Clientes** — search by nombre/teléfono, filter by rol. As **admin**,
   _Cambiar rol_ writes to `memberships` (confirmation dialog; you cannot
   change your own role).
5. **Más → Espacios y clases** — el gimnasio carga su contenido sin SQL:
   _Tipos de clase_ (nombre, color, descripción) y _Sedes y espacios_
   (sede con dirección + espacios con cupo). Eliminar un tipo o espacio con
   clases programadas está bloqueado (los CASCADE borrarían esas clases).
   Sedes/espacios solo los ve el admin; los entrenadores gestionan tipos.
6. **Dashboard → Acciones rápidas / Más**:
   - _Publicar programa_ → pick an upcoming class, write the WOD → the member
     sees it in the class detail as **Entrenamiento de la sesión**.
   - _Enviar notificación_ → title + message → every member receives it under
     **Perfil → Notificaciones**.
   - _Pagos_ → planes, historial y registro de cobros (flujo Stage 5 abajo).
   - _Crear tipo de clase_ / _Crear sedes/espacios_ → abren **Espacios y
     clases** con el formulario listo (si aún no hay sede abre la de sede;
     si ya existe, la de espacio).

### Payments & scheduling intelligence (Stage 5)

1. **Role-based tabs:** sign in as the Test Gym admin (seed step 2) → you
   land on the **admin tabs** (Dashboard / Agenda / Clientes / Más). Creating
   your own gym (_Registrar mi gimnasio_) also drops you straight into the
   admin panel; plain members land on the client tabs.
2. **Payments (admin)** — Más → **Pagos** (or Dashboard → action 💰):
   - _Historial_ shows "Ingresos de {mes}" (seed step 12) and the last
     payments.
   - **Registrar pago** → member picker (search), plan chip (prefills the
     amount), método → **Registrar pago**.
   - _Planes_ tab → **Nuevo plan** (nombre, precio, moneda, días) and
     **Archivar** on each active plan.
3. **Payments (member)** — Perfil → **Mis pagos y plan** → plan vigente
   ("Válido hasta el …") + historial de pagos.
4. **Conflict detection** — Agenda/**Nueva clase**: program a class that
   overlaps another one in the same space → blocked with
   **"Espacio ocupado"**.
5. **¡Casi lleno! badge** — with a class at ≥75 % occupancy, Inicio and
   Clases show an amber **"¡Casi lleno! · N cupos"** badge (red **Completo**
   at 100 %).
6. **Waitlist promotion notification** — run the 2-account waitlist flow and
   cancel the confirmed booking → the promoted member receives a
   **"¡Cupo confirmado!"** notification (_Perfil → Notificaciones_).
7. **Recommendations** — book/attend a couple of classes of the same type →
   Inicio shows **"Recomendadas para ti"** with upcoming unbooked classes of
   that type. No history → no section (nothing is invented).

## Troubleshooting

| Problem                            | Solution                                                               |
| ---------------------------------- | ---------------------------------------------------------------------- |
| "Cannot find module @nexofit/core" | Run `pnpm install` from project root                                   |
| Expo Go can't connect              | Ensure phone and computer are on the same network, or use `--tunnel`   |
| "RLS policy violation"             | Make sure you have a membership for the org in the `memberships` table |
| Empty schedule                     | Create sessions from the admin Agenda (FAB +) or via SQL               |
| Type errors after pulling          | Run `pnpm install` then `pnpm typecheck`                               |

## Useful Commands

```bash
# Full quality check
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check

# Start admin dashboard (web only)
pnpm --filter @nexofit/admin start

# Format all files
pnpm format

# Reset database (re-run migrations)
# Drop all tables in Supabase SQL Editor, then re-run migrations
```

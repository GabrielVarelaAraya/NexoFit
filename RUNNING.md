# Running NexoFit Locally

Step-by-step guide to run the NexoFit mobile app on your machine or device.

The app currently displays its interface in Spanish. Screen and button names in
this guide are translated into English.

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
packages/db/migrations/000004_check_email_exists.sql
packages/db/migrations/000005_professional_access.sql
```

Wait for each to complete before running the next. You should see "Success" after each.

> **Idempotent:** the five files can be re-run on an existing project.
>
> **Existing projects:** if you already applied `000001`, `000002` and `000003`,
> run **`000004_check_email_exists.sql`** to enable the email check before registration.
> This check returns only a boolean for the submitted address and includes
> accounts pending email confirmation. It uses the existing public client key.

### What each migration does

| Migration | Purpose                                                                                    |
| --------- | ------------------------------------------------------------------------------------------ |
| `000001`  | Creates all 29 tables, 7 enums, 23 indexes, and the timestamp/user triggers                |
| `000002`  | Creates RPCs: `book_session`, `cancel_booking`, `create_organization`, and RLS helpers     |
| `000003`  | Enables RLS on every table and creates the 101 final policies                              |
| `000004`  | Adds `email_exists` to reject existing emails before registration                          |
| `000005`  | Provisions professional profiles and scopes appointment/availability access to their owner |

> **Professional workspace:** if `000001` through `000004` are already applied,
> run **`000005_professional_access.sql`**. It creates missing professional
> profiles while preserving existing data. Apply it after `000003` whenever
> you re-run the policy migrations, because `000003` replaces every policy.

## 3. Configure Email Confirmation

Supabase requires custom SMTP before you can edit email templates. Open
**Authentication → Email → SMTP Settings**, or click **Set up SMTP** in the
confirmation template. Configure the sender email/name and your provider's
SMTP host, port, username and password directly in the Supabase dashboard.

The built-in email service only sends to project team addresses and is limited
to 2 messages per hour. See the [custom SMTP setup guide](https://supabase.com/docs/guides/auth/auth-smtp).

For Expo Go, confirm with the email code inside the app. In Supabase, open
**Authentication → Email Templates → Confirm signup** and use this template:

```html
<h2>Confirm your email in NexoFit</h2>
<p>Enter this code in the app:</p>
<p><strong>{{ .Token }}</strong></p>
<p>If you did not request this account, ignore this email.</p>
```

Save the template, then request a new email with **Resend email** in the app.
Existing emails are not updated. When login returns `email_not_confirmed`, the
app opens the confirmation screen for that email; you can resend and enter the
latest code without creating another account.

The code is verified directly with Supabase, so Expo Go does not need a browser
redirect. `otp_expired` means the token is invalid or expired. A redirect to
`http://localhost:3000` comes from Supabase's default Site URL; changing that URL
does not make an expired token valid again.

See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
and [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).
Optionally disable **Confirm email** in the Email provider for local testing.
New signups then enter the app directly; existing accounts should still verify.

### Password recovery

In **Authentication → Email Templates → Reset password**, set the subject to
**Recover your NexoFit account** and use this body in the **Source** tab:

```html
<h2>Recover your NexoFit account</h2>
<p>Enter this code in the app to create a new password:</p>
<p><strong>{{ .Token }}</strong></p>
<p>If you did not request a password reset, ignore this email.</p>
```

Save the template before requesting a new email. The `{{ .Token }}` variable
contains the code generated by Supabase; do not enter a fixed code.
This template requires the SMTP configuration described above. No SQL changes
are needed.

In Expo Go, enter the code inside the app. To use links in a native build with
the `nexofit` scheme, add `nexofit://auth/reset-password` and
`nexofit://auth/verify` to **Authentication → URL Configuration → Redirect URLs**.
The app handles sessions in URL fragments, PKCE codes, and verification tokens.
The code flow does not require a link.

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
3. Tap **Sign Up**. An existing email shows **"This email is already registered"**
   below the email field; uppercase letters and surrounding spaces are ignored.
   Use **Log in** for an existing account, including one awaiting confirmation.
4. If email confirmation is on, enter the code from the latest email in the app
5. A successful confirmation signs you in automatically; **Resend email** requests a new email if needed

### Recover your password

1. On **Log in**, tap **Forgot your password?**.
2. Enter the email address of an existing account and tap **Send code**.
3. Copy the code from the latest email into **Recovery code** and tap
   **Verify code**. Check your spam folder if it does not arrive;
   **Resend email** becomes available after the displayed waiting period.
4. The app opens **Create a new password**. The main dashboard remains
   unavailable during recovery, even though Supabase has created a session.
5. Enter the new password (at least 8 characters and one uppercase letter)
   and repeat it.
6. Tap **Save password**; you will see **Password updated**. Tap
   **Enter NexoFit** to continue with your session.
7. Log out and confirm that you can log in with the new password.

An incorrect, expired, or previously used code displays an error and lets you
request another code. Supabase does not reveal whether an account exists when
you request recovery: no email is sent for an unregistered address. If you
cancel after verifying the code, the app closes the local recovery session.

### Join or create a gym (real flow)

After logging in without a gym, you land on **Home**. If your account does
not belong to a gym yet, you get two options:

- **Find a gym** → directory of organizations → _Join this gym_
  enrolls you immediately as a `member` (client tabs).
- **Register my gym** → creates the organization through the
  `create_organization()` RPC, makes you its `admin`, and takes you directly
  to the **admin panel** (Dashboard / Schedule / Clients / More).

Either action refreshes your membership immediately — no app restart needed.
The role decides the tabs: `admin`/`coach` → admin tabs (create classes,
publish programs, notifications, payments); `professional` → professional tabs
(Agenda / Availability / Profile); `member` or no gym → client tabs.

> A new gym starts with **no venues, spaces, or class types**. Your first
> stop as an admin is **More → Spaces and classes**: create a venue, its
> spaces (with capacity), and your class types. Then use **New class**
> to schedule a session. No SQL is needed.

### Professional workspace

1. Create a separate account for the professional and join the gym as a member.
2. Sign in as the gym administrator. Open **Clients → Change role** and select
   **Professional** for that account. The professional entry is created
   automatically by migration `000005`; existing specialties and biographies
   are preserved. Choosing **I am a professional** on the login screen does
   not assign privileges.
3. Return to the professional account. Bringing the app back to the foreground
   refreshes its membership; alternatively, log out and log in again.
4. The account opens **Agenda / Availability / Profile**:
   - **Agenda** lists only that professional's assigned appointments. Switch
     between upcoming appointments and history. Cancel future appointments,
     mark attendance after the start, or mark absence after the end.
   - **Availability** adds weekly blocks using 24-hour `HH:mm` times. Invalid
     or overlapping blocks on the same day are rejected; adjacent blocks are
     allowed. Removing a block leaves existing appointments intact.
   - **Profile** edits specialty and biography, alongside account settings,
     notifications, and logout.
5. Test with a second professional: each should see and manage only their own
   appointments. Organization administrators retain access within their gym.
6. Change the first account back to **Member**. Refresh or foreground the app:
   client tabs return and professional management permissions are revoked.
   Existing professional records and appointment history remain stored.

Client appointment creation is still pending. The professional agenda displays
appointments already present in `appointments`, such as SQL test data. The
single-user seed below is for the client/admin demo; use separate accounts and
assign the correct professional membership when testing the professional flow.

### Session persistence

The mobile Supabase client stores the session in AsyncStorage and refreshes
tokens while the app is active. This requires no dashboard setting.

1. Log in, fully close the app, and reopen the same NexoFit project in Expo Go
   or your native build. The session and role should restore without login.
2. Log out, close the app, and reopen it. The login flow should remain visible.
3. Verify a password recovery code, then close the app before changing your
   password. On reopening, **Create a new password** should remain the active
   screen. Main tabs stay inaccessible until you finish or cancel recovery.
4. Complete recovery and tap **Enter NexoFit**, or cancel recovery. After
   closing and reopening, recovery should no longer appear.
5. If session storage or membership loading fails, the app shows an error and
   **Retry**, rather than opening tabs with an unresolved role.

Clearing app data, uninstalling the app, or signing out removes local session
data. Use `pnpm test` to run the session restoration, logout, recovery, and
professional RLS checks without sending emails or modifying hosted data.

### Create test data (via SQL)

After signing up, run this seed in the Supabase **SQL Editor**. It is
**idempotent** (safe to re-run) and does not require editing any IDs — it
picks the most recent profile automatically.

```sql
-- ============================================================
-- NexoFit · test seed (idempotent: safe to run again)
-- ============================================================

-- 1) Your profile. The profiles table has no email column;
--    email addresses are stored in auth.users.
SELECT u.id, u.email, p.full_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id;

-- If you have multiple users and want to select a specific one, replace
--   (SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1)
-- with that user's exact ID in steps 2, 7, and 8.

-- 2) Gym and your admin membership
INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Gym', 'test-gym')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (organization_id, profile_id, role)
SELECT '11111111-1111-1111-1111-111111111111', id, 'admin'
FROM profiles
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (organization_id, profile_id) DO NOTHING;

-- 3) Venue and space (capacity: 20)
INSERT INTO venues (id, organization_id, name)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Main Box')
ON CONFLICT (id) DO NOTHING;

INSERT INTO spaces (id, venue_id, name, capacity)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Floor A', 20)
ON CONFLICT (id) DO NOTHING;

-- 4) Class type (class_types has no emoji column)
INSERT INTO class_types (id, organization_id, name, color, description)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'CrossFit WOD', '#0B9B91', 'Functional WOD')
ON CONFLICT (id) DO NOTHING;

-- 5) Coach (sessions.coach_id references coaches.id, not profiles.id;
--    coaches.membership_id references your membership)
INSERT INTO coaches (id, membership_id, specialization)
SELECT
  '88888888-8888-8888-8888-888888888888',
  m.id,
  'Strength and conditioning'
FROM memberships m
WHERE m.organization_id = '11111111-1111-1111-1111-111111111111'
ORDER BY m.created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 6) Sessions (sessions has no organization_id or venue_id columns;
--    start and end times use starts_at and ends_at)
--    · Today, in 2 hours → Home ("Today's classes") and Schedule show a session
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

--    · Tomorrow (used by the "Book a session" flow)
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

-- 7) Professional and service (for the Appointments tab). With only one
--    test user, the professional and the client are the same person.
INSERT INTO professionals (id, membership_id, specialization)
SELECT
  '99999999-9999-9999-9999-999999999999',
  m.id,
  'Sports physiotherapy'
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
  'Initial assessment',
  'One-to-one assessment session',
  45
ON CONFLICT (id) DO NOTHING;

-- 8) Appointments: one upcoming (tomorrow) and one past ("Completed")
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

-- 9) Exercise library (for logging workouts in Progress)
INSERT INTO exercise_library (id, organization_id, name, category, primary_muscle, equipment)
VALUES
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Squat', 'strength', 'quadriceps', ARRAY['Barbell']),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Bench press', 'strength', 'chest', ARRAY['Barbell', 'Bench']),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Deadlift', 'strength', 'back', ARRAY['Barbell']),
  ('dddddddd-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Pull-ups', 'gymnastics', 'back', ARRAY['Pull-up bar']),
  ('dddddddd-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Steady running', 'cardio', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 10) Coach's program for today's session (shown in the class details)
INSERT INTO workout_programs (id, session_id, content, published_by)
VALUES (
  'eeeeeeee-0000-0000-0000-000000000001',
  '66666666-6666-6666-6666-666666666666',
  E'Warm-up\n• 500 m row\n• 10 push-ups\n• 10 squats\n\nWOD\n• 5 rounds: 10 weighted squats (30 kg) and a 200 m run\n\nCool-down\n• 5 minutes of stretching',
  (SELECT id FROM profiles ORDER BY created_at DESC LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- 11) Membership plans (Stage 5 · Payments)
INSERT INTO membership_plans (id, organization_id, name, description, price_cents, currency, duration_days)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Monthly plan', 'Unlimited access to group classes', 2500, 'USD', 30),
  ('eeeeeeee-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'Annual plan', '12 months of access at a discounted price', 24000, 'USD', 365)
ON CONFLICT (id) DO NOTHING;

-- 12) A sample payment (today) for the latest profile: used by
--     "Monthly revenue" on Dashboard and Profile → "My payments and plan".
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

1. **Home** tab → "Today's classes" should show the session seeded at now +2h
2. Go to the **Classes** tab
3. Select tomorrow's date in the horizontal date picker
4. You should see "CrossFit WOD" with "20 spots" and the coach's name
5. Tap **Book** → confirm; back in **Classes**, the button now reads
   **"Already booked"** and the badge shows 19 spots
6. Go to **My bookings** (Home → "View all") → see your confirmed booking
7. Tap **Cancel** → the booking is removed and the class shows
   **20 spots** again (spots are returned immediately)

### Test waitlist (needs a second account)

A single profile can't queue behind itself — a confirmed booking returns
"Already booked". Use two signups:

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
   SELECT id, email FROM auth.users;  -- copy the second account's ID

   INSERT INTO memberships (organization_id, profile_id, role)
   VALUES ('11111111-1111-1111-1111-111111111111', '<SECOND_ACCOUNT_ID>', 'member')
   ON CONFLICT (organization_id, profile_id) DO NOTHING;
   ```

3. From the second account book `77777777-…` → confirmed (1/1, "Full")
4. From the first account open the same class → **Join waitlist**
   → waitlist #1 (re-tapping returns your position, not an error)
5. Cancel the confirmed booking → the waitlist auto-promotes to confirmed

### Log a workout (Stage 4)

1. Run the seed above — steps 9–10 add an exercise library and a coach
   program for today's session.
2. **Progress** tab → **+ Workout** → _+ Add_ → pick "Squat"
   → enter repetitions and weight for each set → **Save workout**.
3. The log appears under **My workouts** (tap it to expand the sets)
   and, if you beat your best weight, a new row appears under
   **Personal records**.
4. From **Classes → Class details**, you can also tap
   **Log workout**: the log remains linked to that session and its program.
   If the coach has published a program, you will see the
   **Session workout** card.

### Admin flows (Stage 6)

1. Log in with the seed user (step 2 makes the latest profile **admin** of
   Test Gym). You land on the admin tabs: Dashboard / Schedule / Clients / More.
2. **Dashboard** — metrics show active members, monthly revenue, today's
   classes, average occupancy for the next 7 days, and bookings this month.
   _Recent activity_ shows bookings, cancellations, and signups;
   _Upcoming classes_ shows the next sessions with their available spots.
   Pull to refresh.
3. **Schedule** — pick a day → sessions with occupancy bars. Tap the **+**
   button → _New class_ (type, space, date, time, and optional capacity) →
   the class appears on that day and in the member schedule.
4. **Clients** — search by name or phone number and filter by role. As
   **admin**, _Change role_ updates `memberships` after a confirmation
   dialog. You cannot change your own role.
5. **More → Spaces and classes** — the gym manages its content without SQL:
   _Class types_ (name, color, and description) and _Venues and spaces_
   (venue with address, plus spaces with capacity). Deleting a type or space
   with scheduled classes is blocked because cascading deletes would remove
   those classes. Only admins manage venues and spaces; coaches manage
   class types.
6. **Dashboard → Quick actions / More**:
   - _Publish program_ → select an upcoming class and write the WOD →
     members see it in the class details as **Session workout**.
   - _Send notification_ → enter a title and message → every member receives
     it under **Profile → Notifications**.
   - _Payments_ → plans, payment history, and payment recording
     (see the Stage 5 flow below).
   - _Create class type_ / _Create venues/spaces_ → open **Spaces and classes**
     with the relevant form ready. If no venue exists, the venue form opens;
     otherwise, the space form opens.

### Payments & scheduling intelligence (Stage 5)

1. **Role-based tabs:** sign in as the Test Gym admin (seed step 2) → you
   land on the **admin tabs** (Dashboard / Schedule / Clients / More).
   Creating your own gym (_Register my gym_) also takes you directly to
   the admin panel; members land on the client tabs.
2. **Payments (admin)** — More → **Payments** (or the 💰 action on Dashboard):
   - _History_ shows "Revenue for {month}" (seed step 12) and recent payments.
   - **Record payment** → select a member (search), select a plan
     (prepopulates the amount), choose a payment method → **Record payment**.
   - _Plans_ tab → **New plan** (name, price, currency, and duration in days)
     and **Archive** on each active plan.
3. **Payments (member)** — Profile → **My payments and plan** → current plan
   ("Valid until …") and payment history.
4. **Conflict detection** — Schedule/**New class**: schedule a class that
   overlaps another one in the same space → blocked with
   **"Space occupied"**.
5. **Almost full! badge** — at ≥75% occupancy, Home and Classes show an
   amber **"Almost full! · N spots"** badge (red **Full** at 100%).
6. **Waitlist promotion notification** — run the two-account waitlist flow
   and cancel the confirmed booking → the promoted member receives a
   **"Spot confirmed!"** notification (_Profile → Notifications_).
7. **Recommendations** — book or attend a couple of classes of the same type →
   Home shows **"Recommended for you"** with upcoming unbooked classes of
   that type. The section is hidden when there is no booking history.

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

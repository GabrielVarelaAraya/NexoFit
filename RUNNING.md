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
packages/db/migrations/000001_create_all_tables.sql
packages/db/migrations/000002_create_rls_policies.sql
packages/db/migrations/000003_create_booking_functions.sql
packages/db/migrations/000004_create_triggers.sql
```

Wait for each to complete before running the next. You should see "Success" after each.

### What each migration does

| Migration | Purpose                                                          |
| --------- | ---------------------------------------------------------------- |
| `000001`  | Creates all 21 tables, enums, and indexes                        |
| `000002`  | Enables RLS on every table with per-org policies                 |
| `000003`  | Creates `book_session()` and `cancel_booking()` atomic functions |
| `000004`  | Creates triggers for auto-updating timestamps and booking counts |

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

### Create test data (via SQL)

After signing up, find your profile ID and seed some test data:

```sql
-- Find your profile
SELECT id, email FROM profiles;

-- Replace YOUR_PROFILE_ID below with your actual ID

-- Create an organization
INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Test Gym', 'test-gym');

-- Add yourself as admin
INSERT INTO memberships (organization_id, profile_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'YOUR_PROFILE_ID', 'admin');

-- Create a venue
INSERT INTO venues (id, organization_id, name)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Main Box');

-- Create a space with capacity
INSERT INTO spaces (id, venue_id, name, capacity)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Floor A', 20);

-- Create a class type
INSERT INTO class_types (id, organization_id, name, color, emoji)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'CrossFit WOD', '#0B9B91', '🏋️');

-- Create a session for tomorrow at 7am
INSERT INTO sessions (id, organization_id, class_type_id, venue_id, space_id, coach_id, start_at, end_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'YOUR_PROFILE_ID',
  (NOW() + INTERVAL '1 day' + INTERVAL '7 hours')::timestamptz,
  (NOW() + INTERVAL '1 day' + INTERVAL '8 hours')::timestamptz
);
```

### Book a session

1. Go to the **Schedule** tab
2. Select tomorrow's date in the horizontal date picker
3. You should see "CrossFit WOD" with "20 spots"
4. Tap **Book Now** → confirm
5. Go to **My Bookings** → see your confirmed booking
6. Tap **Cancel** → booking is removed, spots freed

### Test waitlist

1. Create a session with capacity 2
2. Book it twice (2 confirmations)
3. Book a third time → you'll be placed on the waitlist (#1)
4. Cancel one confirmed booking → waitlist auto-promotes

## Troubleshooting

| Problem                            | Solution                                                               |
| ---------------------------------- | ---------------------------------------------------------------------- |
| "Cannot find module @nexofit/core" | Run `pnpm install` from project root                                   |
| Expo Go can't connect              | Ensure phone and电脑 are on the same network, or use `--tunnel`        |
| "RLS policy violation"             | Make sure you have a membership for the org in the `memberships` table |
| Empty schedule                     | You need to create sessions via SQL or admin UI (not built yet)        |
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

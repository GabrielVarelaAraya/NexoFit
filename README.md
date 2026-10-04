# NexoFit

> Multi-tenant mobile platform for gyms, CrossFit boxes, and wellness studios.
> **Reserva · Entrena · Progresa**

![Expo](https://img.shields.io/badge/Expo-57-000020?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-2.45-3FCF8E?logo=supabase)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm)

## Overview

NexoFit is a mobile-first platform that lets fitness businesses manage their operations while giving members a seamless booking and training experience.

### For Members

- Browse daily/weekly class schedules
- Book sessions with instant confirmation
- Join waitlists when classes are full
- Cancel bookings (auto-promotes waitlist)
- Track workouts and progress

### For Admins & Coaches

- Manage organization, venues, and spaces
- Create class types (CrossFit, yoga, zumba, functional, custom)
- Schedule recurring sessions with coach assignment
- Set capacity per space
- View attendance and member progress

## Architecture

```
NexoFit/
├── apps/
│   ├── mobile/          # Member & coach app (React Native + Expo)
│   └── admin/           # Admin dashboard (Expo Web, landscape)
│
├── packages/
│   ├── core/            # Shared: theme, types, Supabase client
│   └── db/              # SQL migrations, RLS policies, seed data
```

**Multi-tenancy** is enforced at the database level via PostgreSQL Row Level Security (RLS). Every query is scoped to the user's organization — no data leaks between tenants.

**Atomic bookings** use a Postgres function (`book_session`) that handles capacity checks, waitlist insertion, and confirmation in a single transaction — no race conditions.

## Tech Stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Mobile   | React Native 0.86, Expo SDK 57, React Navigation 7 |
| Auth     | Supabase Auth (email/password, magic link)         |
| Database | PostgreSQL 15 (via Supabase)                       |
| API      | Supabase PostgREST + Edge Functions                |
| Realtime | Supabase Realtime (bookings, notifications)        |
| Styling  | React Native StyleSheet, brand tokens              |
| Monorepo | pnpm workspaces                                    |
| CI       | GitHub Actions (typecheck → lint → test → build)   |

## Brand Palette

| Color         | Hex       | Usage                        |
| ------------- | --------- | ---------------------------- |
| Azul Nexo     | `#06354E` | Primary dark, headers, text  |
| Turquesa      | `#0B9B91` | CTAs, links, active states   |
| Menta Activa  | `#16B9A9` | Secondary accent, highlights |
| Lima Progreso | `#A9F56F` | Success, progress indicators |
| Crema         | `#F8F6EF` | Background, cards            |

**Fonts:** Nextra ExtraBold (brand), Inter SemiBold/Regular (UI)

## Database Schema

27 tables across 3 idempotent SQL files (run in order via the Supabase SQL Editor):

- **Organizations** — multi-tenant root
- **Venues & Spaces** — locations with capacity
- **Profiles & Memberships** — users with roles (admin, coach, professional, member)
- **Class Types** — configurable per org (name, color, description)
- **Sessions** — scheduled classes with coach, time, space
- **Bookings & Waitlist** — atomic capacity enforcement, waitlist positions, attendance
- **Workout Programs** — per-session workout content
- **Workout Tracking** — logs, exercises, sets, personal records, templates
- **Body Metrics** — measurements over time
- **Appointments & Services** — 1-on-1 with professionals
- **Availability** — professional schedules
- **Access Permissions & Notifications** — member access and in-app alerts

## Getting Started

See [RUNNING.md](./RUNNING.md) for the full setup guide.

**Quick start:**

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/nexofit.git
cd nexofit

# 2. Install
pnpm install

# 3. Configure
cp .env.example .env
# Edit .env with your Supabase URL + anon key

# 4. Run migrations in Supabase SQL Editor (see RUNNING.md)

# 5. Start
pnpm --filter @nexofit/mobile start
```

## Scripts

| Command             | Description             |
| ------------------- | ----------------------- |
| `pnpm typecheck`    | Type-check all packages |
| `pnpm lint`         | Lint all packages       |
| `pnpm test`         | Run all tests           |
| `pnpm format`       | Format with Prettier    |
| `pnpm format:check` | Check formatting        |

## Implementation Status

**Overall: ≈60%** — 4 of 7 stages complete; stages 4 and 6 started.

| Stage | Description                                            | Status                                                            |
| ----- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| 0     | Foundation (monorepo, tooling, tokens)                 | ✅ Done                                                           |
| 1     | Data platform & auth (Supabase, RLS, migrations)       | ✅ Done                                                           |
| 2     | Core booking engine (schedule, book, cancel, waitlist) | ✅ Done                                                           |
| 3     | Core app shell + onboarding                            | ✅ Done                                                           |
| 4     | Member workout experience                              | 🔶 In progress — body metrics done; workout logs UI still pending |
| 5     | Payments & scheduling intelligence                     | 🔲 Pending                                                        |
| 6     | Admin web dashboard, analytics, notifications          | 🔶 In progress — admin shell exists, screens still use mock data  |

## Project Context

**Course:** EIF409 — Universidad Nacional, Costa Rica
**Team:** Gabriel Varela, Jose Mora, Fernanda Segura Largaespada, Maria Valeria Oviedo
**Docente:** Jose Vindas Quiros

## License

Private — academic use only.

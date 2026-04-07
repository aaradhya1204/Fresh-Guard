# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## What this app is
FreshGuard ("Smart Label Checker") is a demo full-stack app for smart grocery shopping:
- Admins create/manage products and generate printable QR codes.
- Shoppers scan a product QR code (camera or manual entry), get expiry warnings, and add items to a trolley.
- Checkout records purchases; the user dashboard shows purchase history with expiry/freshness status.

## Common dev commands
All commands are run from the repo root.

- Start dev server (Express API + Vite dev middleware on the same port):
  - `npm run dev`

- Typecheck:
  - `npm run check`

- Build production artifacts (Vite client build + bundled server):
  - `npm run build`

- Run production server (serves `dist/public` and API):
  - `npm run start`

- Push Drizzle schema to DB:
  - `npm run db:push`

Notes:
- This repo currently does not define dedicated `lint` or `test` scripts.

## High-level architecture
This repo is a single full-stack TypeScript app with three main areas:

- `client/`: React (Vite) frontend
  - Routing via `wouter` (`client/src/App.tsx`).
  - Server state via React Query.
  - UI via Tailwind + shadcn/ui components (`client/src/components/ui/*`).

- `server/`: Express backend
  - `server/index.ts` boots Express and mounts API routes, then:
    - in dev: mounts Vite as middleware (`server/vite.ts`) and serves the SPA HTML.
    - in prod: serves static files from `dist/public` (`server/static.ts`).
  - API is cookie-session based using `express-session` + `memorystore` (`server/routes.ts`).

- `shared/`: code shared by client and server
  - `shared/schema.ts`: Drizzle tables + inferred TS types + insert schemas.
  - `shared/routes.ts`: a small “API contract” (paths + zod schemas) imported by both server and client.

Vite/TS path aliases:
- `@/*` -> `client/src/*`
- `@shared/*` -> `shared/*`

## Data model (Postgres + Drizzle)
Defined in `shared/schema.ts`:
- `users`: `username`, `password` (demo), `role` (`admin`/`user`), `customId`.
- `products`: name, price (stored in smallest unit; UI divides by 100), manufacturing/expiry dates, nutritional info (string), ingredients (string[]), `qrCodeId`.
- `purchases`: join table between users and products, with `purchasedAt`.

DB connection is in `server/db.ts` (requires `DATABASE_URL`).

## Auth model (demo-oriented)
Implemented in `server/routes.ts`:
- Admin login is hardcoded to `admin@gmail.com` / `admin`.
- User login is by `customId` only; if the user doesn’t exist, it is auto-created.
- Session cookie stores `userId` and `role`; frontend requests use `credentials: 'include'`.

## Key user flows (where to look)
- Login + role-based routing:
  - `client/src/pages/Auth.tsx`, `client/src/App.tsx`, `client/src/hooks/use-auth.ts`
- Admin inventory + QR generation:
  - `client/src/pages/AdminDashboard.tsx`
  - API: `POST/PUT/DELETE /api/products` (admin-only)
- Smart trolley scanning + checkout:
  - `client/src/pages/Trolley.tsx` (camera scanner via `html5-qrcode` + manual QR lookup)
  - API: `GET /api/products/qr/:qrCodeId`, `POST /api/purchases`
- User purchase history + expiry status:
  - `client/src/pages/UserDashboard.tsx`, `client/src/components/ProductCard.tsx`, `client/src/components/ExpiryAlert.tsx`
  - API: `GET /api/purchases`

## API surface area (single source of truth)
Prefer editing `shared/routes.ts` first:
- Add/update a route contract there.
- Implement it in `server/routes.ts`.
- Consume it from the client via the existing hooks in `client/src/hooks/*`.

## Seed data
On server startup, `server/routes.ts` seeds 3 demo products if the products table is empty, including:
- `prod_milk_001`, `prod_bread_002`, `prod_yogurt_003` (expired)

This is useful for validating expiry alerts and the trolley flow quickly.

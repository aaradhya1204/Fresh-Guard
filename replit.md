# Smart Label Checker (FreshGuard)

A QR-based smart shopping ecosystem that helps users make informed purchasing decisions by showing nutritional data, expiry alerts, ingredients, and post-purchase reminders.

## Overview

**Purpose**: Production-grade smart shopping application for grocery safety and management.

**Features**:
- Admin Dashboard: Add/edit products, generate QR codes, manage inventory
- User App: View purchase history with expiry alerts
- Smart Trolley: QR scanning simulation with camera or manual entry, real-time expiry warnings

## User Roles

### Admin
- Email: `admin@gmail.com`
- Password: `admin`
- Capabilities: Full product CRUD, QR code generation

### User
- Login with any Custom ID (e.g., `user123`)
- View personal purchase history
- Receive expiry alerts for purchased items

## Architecture

### Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + Shadcn UI

### Key Files
- `shared/schema.ts`: Database models (users, products, purchases)
- `shared/routes.ts`: API contract definitions
- `server/routes.ts`: Express route handlers with session auth
- `client/src/pages/`: Page components (Auth, AdminDashboard, UserDashboard, Trolley)
- `client/src/hooks/`: Data fetching hooks (use-auth, use-products, use-purchases)

## Demo QR Codes

Pre-seeded products with QR IDs:
- `prod_milk_001` - Fresh Milk
- `prod_bread_002` - Organic Bread
- `prod_yogurt_003` - Expired Yogurt (for testing expiry alerts)

## Running the App

The app runs via `npm run dev` which starts both backend and frontend on port 5000.

## User Preferences

- Clean, minimal retail-grade UI
- Mobile-first design for user app
- Green theme for freshness, red for expired items

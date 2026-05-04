# Implementation Plan

## Phases at a glance
| Phase | What | Est. complexity |
|-------|------|-----------------|
| 1 | Docker + monorepo scaffold | Low |
| 2 | Database schema + Prisma | Low-Medium |
| 3 | Backend foundation (Express + Socket.io) | Medium |
| 4 | Shared types package | Low |
| 5 | Ordering view | High |
| 6 | Coffee Preparation view | Medium |
| 7 | Coordinator view | Medium |
| 8 | Pickup Display view | Low |
| 9 | Management view | High |
| 10 | QR / mobile polish | Medium |
| 11 | Production Docker + hardening | Medium |

---

## Phase 1 — Docker + monorepo scaffold

**Goal:** `docker-compose -f docker-compose.dev.yml up` starts three containers and all three hot-reload.

Tasks:
- [ ] `docker-compose.dev.yml` with services: `db`, `server`, `client`
- [ ] `docker-compose.yml` (production, no volumes, compiled builds)
- [ ] `client/` — Vite + React + TypeScript scaffold (`npm create vite`)
- [ ] `server/` — Node.js + TypeScript with `tsx` for hot reload
- [ ] `packages/shared/` — empty TypeScript package, referenced by both
- [ ] Root `package.json` with npm workspaces
- [ ] `.env.example` with all required env vars
- [ ] Vite proxy config: `/api` and `/socket.io` → server

**Env vars needed:**
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
APP_URL=http://localhost:5173
ADMIN_PASSWORD=...   # single-credential auth for v1
```

**Deliverable:** All three containers run, frontend shows Vite default page, backend responds to `GET /health`.

---

## Phase 2 — Database schema + Prisma

**Goal:** Schema matches `ARCHITECTURE.md`, migrations run cleanly, seed script populates a sample menu.

Tasks:
- [ ] `server/prisma/schema.prisma` — all models from architecture doc
- [ ] Initial migration: `prisma migrate dev`
- [ ] `server/prisma/seed.ts` — seed categories (Hot Drinks, Cold Drinks, Food), ~10 menu items, 5 tables
- [ ] Prisma client exported from `server/src/db.ts` (singleton)
- [ ] `DailyCounter` model for order numbers

**Do not skip the seed script.** Every developer on this project will thank you. It removes the "I have an empty database" problem on first run.

---

## Phase 3 — Backend foundation

**Goal:** Express server + Socket.io running, auth middleware, basic order flow wired.

Tasks:
- [ ] `server/src/index.ts` — Express + Socket.io init
- [ ] `server/src/middleware/auth.ts` — JWT verification middleware
- [ ] `POST /api/v1/auth/login` — validate `ADMIN_PASSWORD`, return JWT
- [ ] `GET /api/v1/health` — returns `{ ok: true, db: "connected" }`
- [ ] `GET /api/v1/menu` — full menu snapshot
- [ ] `POST /api/v1/orders` — place order, emit `order:placed` to kitchen room
- [ ] Socket.io room join handler (`view:join` event)
- [ ] Socket.io handlers: `order:item:start`, `order:item:done`, `order:picked_up`
- [ ] Order status transition logic in `server/src/services/order.service.ts`
- [ ] Zod schemas for all incoming payloads

**Order status machine (enforce in service, not in handlers):**
```
PLACED → IN_PROGRESS (first item started)
IN_PROGRESS → READY (last item done)
READY → PICKED_UP (barista or customer confirms)
Any → CANCELLED (management only)
```

---

## Phase 4 — Shared types package

**Goal:** One source of truth for `Order`, `MenuItem`, `SocketEvent` etc.

Tasks:
- [ ] `packages/shared/src/types.ts` — all domain types
- [ ] `packages/shared/src/events.ts` — typed Socket.io event map
- [ ] Both client and server import from `@coffee/shared`

This phase is small but must come before any frontend work. Skipping it means two weeks of type drift.

---

## Phase 5 — Ordering view

The most complex view. Customers use this — it must be good on both a 27" kiosk and a 390px phone screen.

Tasks:
- [ ] Route: `/order` (kiosk) and `/order?table={token}` (mobile)
- [ ] Resolve table token on load (show table number in header)
- [ ] Category tabs / horizontal scroll navigation
- [ ] Menu item grid — image, name, price, add button
- [ ] Cart drawer/panel — items, quantities, notes field, total
- [ ] Order submission → `POST /api/v1/orders`
- [ ] Post-submission: order confirmation screen with order number
- [ ] Socket subscription to `order:{id}` room → live status updates
- [ ] Status progression shown to customer: Placed → Being Made → Ready!
- [ ] Responsive: MUI Grid, test at 390px, 768px, 1280px

**UX note:** The ordering flow must be completable in under 60 seconds. Anything that adds friction will cause abandonment.

---

## Phase 6 — Coffee Preparation view

The barista's "what to make" screen. Typically a tablet mounted near the espresso machine.

Tasks:
- [ ] Route: `/prep`
- [ ] Join `kitchen` socket room on mount
- [ ] Display incoming orders as cards (ordered by time received)
- [ ] Each card shows: order number, items with quantities and notes
- [ ] Each item has a "Start" button → emits `order:item:start`
- [ ] Each item has a "Done" button (visible after Start) → emits `order:item:done`
- [ ] Order card auto-removes when all items are DONE
- [ ] Visual urgency indicator: orders waiting >5 min highlight in amber, >10 min in red
- [ ] Sound notification on new order (optional, user-toggleable)

---

## Phase 7 — Coordinator/Barista Overview view

A global dashboard. Not for making drinks — for seeing the whole picture.

Tasks:
- [ ] Route: `/coordinator`
- [ ] Join `kitchen` socket room on mount
- [ ] All live orders in a kanban-style layout: columns by status
  - **Placed** | **In Progress** | **Ready**
- [ ] Each card: order number, table if applicable, age, item count, item statuses
- [ ] Can manually mark order as PICKED_UP (management action)
- [ ] Can cancel an order
- [ ] Read-only view of what prep screen is doing
- [ ] Auto-refreshes via Socket — no polling

---

## Phase 8 — Pickup Display view

The big screen customers watch. Minimal UI, maximum legibility.

Tasks:
- [ ] Route: `/pickup`
- [ ] Join `display` socket room on mount
- [ ] Show order numbers in READY state as large cards
- [ ] Animate new number appearing
- [ ] Remove number when `order:removed` event received
- [ ] No interaction needed — purely display
- [ ] High contrast, large font (readable from 3m away)
- [ ] Option: two columns (Ready for pickup / Being prepared) for better UX

---

## Phase 9 — Management view

Protected by JWT. Staff manage menu and view order history.

Tasks:
- [ ] Route: `/management` — redirect to `/management/login` if no token
- [ ] Login page: password field → POST auth → store JWT in localStorage
- [ ] **Menu management:**
  - Category CRUD (reorderable)
  - Item CRUD (name, description, price, image upload or URL, availability toggle)
  - Drag-to-reorder items within category (nice-to-have, Phase 2)
- [ ] **Table management:**
  - List tables with QR download button
  - Add/remove tables
  - Rotate QR token
- [ ] **Order history:**
  - Filterable list: date range, status
  - Order detail: items, time, table
- [ ] All mutations broadcast `menu:updated` via Socket so ordering screens refresh

---

## Phase 10 — QR / Mobile polish

Tasks:
- [ ] Server-side QR PNG generation (`qrcode` package) at `GET /api/v1/management/tables/:id/qr`
- [ ] Management page renders QR inline + download button
- [ ] Mobile ordering: test full flow on real device
- [ ] PWA manifest for "Add to Home Screen" (optional but nice for table QR use)
- [ ] Prevent kiosk view from being scrollable/zoomable (viewport lock)

---

## Phase 11 — Production hardening

Tasks:
- [ ] `docker-compose.yml` (prod): client builds to `dist/`, served by nginx
- [ ] Nginx config: serve static, proxy `/api` and `/socket.io` to server
- [ ] Environment variable validation on server startup (fail fast if missing)
- [ ] Rate limiting on order submission endpoint
- [ ] PostgreSQL container with named volume for data persistence
- [ ] Health check endpoints for all containers
- [ ] `.env.example` complete and documented

---

## What's explicitly out of scope (v1)

- Payment processing
- Order modifiers (size, milk type) — use notes field
- Multi-user admin accounts
- Printer/receipt integration
- Analytics dashboard
- Customer accounts / loyalty
- Multiple locations
